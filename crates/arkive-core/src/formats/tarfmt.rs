//! TAR backend with Gzip, Bzip2, XZ (multi-threaded) and Zstandard (multi-threaded).

use crate::archive::{Counts, CreateOptions, Entry, ExtractOptions, TestFailure};
use crate::codec::zstd_level;
use crate::format::Format;
use crate::inputs::InputItem;
use crate::progress::{ProgressReader, Tracker};
use crate::util::{fmt_unix, is_selected, normalize_name, safe_join};
use crate::{Error, Result};
use std::fs::File;
use std::io::{self, BufReader, BufWriter, Read, Write};
use std::path::Path;

type Out = BufWriter<File>;

/// Compressing writer that can be finished explicitly (so errors aren't lost on drop).
enum TarWriter {
    Plain(Out),
    Gz(flate2::write::GzEncoder<Out>),
    Bz2(bzip2::write::BzEncoder<Out>),
    Xz(xz2::write::XzEncoder<Out>),
    Zst(zstd::Encoder<'static, Out>),
}

impl TarWriter {
    fn new(format: Format, out: Out, level: u32, threads: usize) -> Result<Self> {
        let level = level.min(9);
        Ok(match format {
            Format::Tar => TarWriter::Plain(out),
            Format::TarGz => {
                TarWriter::Gz(flate2::write::GzEncoder::new(out, flate2::Compression::new(level)))
            }
            Format::TarBz2 => TarWriter::Bz2(bzip2::write::BzEncoder::new(
                out,
                bzip2::Compression::new(level.max(1)),
            )),
            Format::TarXz => {
                let stream = if threads > 1 {
                    xz2::stream::MtStreamBuilder::new()
                        .threads(threads as u32)
                        .preset(level)
                        .check(xz2::stream::Check::Crc64)
                        .encoder()
                } else {
                    xz2::stream::Stream::new_easy_encoder(level, xz2::stream::Check::Crc64)
                }
                .map_err(|e| Error::Other(format!("xz: {e}")))?;
                TarWriter::Xz(xz2::write::XzEncoder::new_stream(out, stream))
            }
            Format::TarZst => {
                let mut enc = zstd::Encoder::new(out, zstd_level(level.max(1)))?;
                if threads > 1 {
                    enc.multithread(threads as u32)?;
                }
                enc.include_checksum(true)?;
                TarWriter::Zst(enc)
            }
            other => return Err(Error::UnsupportedFormat(other.label().into())),
        })
    }

    fn finish(self) -> io::Result<()> {
        match self {
            TarWriter::Plain(mut w) => w.flush(),
            TarWriter::Gz(e) => e.finish()?.flush(),
            TarWriter::Bz2(e) => e.finish()?.flush(),
            TarWriter::Xz(e) => e.finish()?.flush(),
            TarWriter::Zst(e) => e.finish()?.flush(),
        }
    }
}

impl Write for TarWriter {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        match self {
            TarWriter::Plain(w) => w.write(buf),
            TarWriter::Gz(w) => w.write(buf),
            TarWriter::Bz2(w) => w.write(buf),
            TarWriter::Xz(w) => w.write(buf),
            TarWriter::Zst(w) => w.write(buf),
        }
    }
    fn flush(&mut self) -> io::Result<()> {
        match self {
            TarWriter::Plain(w) => w.flush(),
            TarWriter::Gz(w) => w.flush(),
            TarWriter::Bz2(w) => w.flush(),
            TarWriter::Xz(w) => w.flush(),
            TarWriter::Zst(w) => w.flush(),
        }
    }
}

pub fn create(
    output: &Path,
    items: &[InputItem],
    format: Format,
    opts: &CreateOptions,
    t: &Tracker,
) -> Result<()> {
    let out = BufWriter::with_capacity(1 << 20, File::create(output)?);
    let writer = TarWriter::new(format, out, opts.level, opts.threads())?;
    let mut b = tar::Builder::new(writer);
    b.follow_symlinks(true);
    for item in items {
        t.check_cancel()?;
        if item.is_dir {
            b.append_dir(&item.name, &item.abs).map_err(Error::from_io)?;
        } else {
            let file = File::open(&item.abs)?;
            let meta = file.metadata()?;
            let mut header = tar::Header::new_gnu();
            header.set_metadata(&meta);
            header.set_size(meta.len());
            let reader = ProgressReader::new(BufReader::new(file), t, &item.name);
            b.append_data(&mut header, &item.name, reader)
                .map_err(Error::from_io)?;
        }
    }
    let writer = b.into_inner().map_err(Error::from_io)?;
    writer.finish().map_err(Error::from_io)?;
    Ok(())
}

/// Opens a decompressing reader. Progress is tracked on the *compressed*
/// stream, which gives accurate percentages without a pre-scan.
fn open<'t, 'a>(path: &Path, format: Format, t: &'t Tracker<'a>) -> Result<Box<dyn Read + 't>> {
    let f = File::open(path)?;
    t.set_total(f.metadata()?.len());
    let r = ProgressReader::new(BufReader::with_capacity(1 << 20, f), t, "");
    Ok(match format {
        Format::Tar => Box::new(r),
        Format::TarGz => Box::new(flate2::read::MultiGzDecoder::new(r)),
        Format::TarBz2 => Box::new(bzip2::read::MultiBzDecoder::new(r)),
        Format::TarXz => Box::new(xz2::read::XzDecoder::new_multi_decoder(r)),
        Format::TarZst => Box::new(zstd::Decoder::new(r)?),
        other => return Err(Error::UnsupportedFormat(other.label().into())),
    })
}

pub fn list(path: &Path, format: Format) -> Result<Vec<Entry>> {
    let sink = crate::progress::NoProgress;
    let t = Tracker::new(&sink, 0);
    let mut ar = tar::Archive::new(open(path, format, &t)?);
    let mut out = Vec::new();
    for e in ar.entries().map_err(Error::from_io)? {
        let e = e.map_err(Error::from_io)?;
        let h = e.header();
        let name = normalize_name(&e.path().map_err(Error::from_io)?.to_string_lossy());
        out.push(Entry {
            path: name.trim_end_matches('/').to_string(),
            size: h.size().unwrap_or(0),
            compressed_size: None,
            is_dir: h.entry_type().is_dir(),
            modified: h.mtime().ok().and_then(|m| fmt_unix(m as i64)),
            encrypted: false,
            crc32: None,
        });
    }
    Ok(out)
}

pub fn extract(path: &Path, format: Format, dest: &Path, opts: &ExtractOptions, t: &Tracker) -> Result<Counts> {
    let mut ar = tar::Archive::new(open(path, format, t)?);
    ar.set_preserve_mtime(true);
    ar.set_overwrite(true);
    let mut c = Counts::default();
    for e in ar.entries().map_err(Error::from_io)? {
        t.check_cancel()?;
        let mut e = e.map_err(Error::from_io)?;
        let name = normalize_name(&e.path().map_err(Error::from_io)?.to_string_lossy());
        if !is_selected(&name, &opts.selection) {
            continue;
        }
        let Some(out) = safe_join(dest, &name) else {
            c.skipped += 1;
            continue;
        };
        let is_dir = e.header().entry_type().is_dir();
        if !is_dir && out.exists() && !opts.overwrite {
            c.skipped += 1;
            continue;
        }
        t.add(0, &name);
        let size = e.header().size().unwrap_or(0);
        e.unpack_in(dest).map_err(Error::from_io)?;
        if is_dir {
            c.dirs += 1;
        } else {
            c.files += 1;
            c.bytes += size;
        }
    }
    Ok(c)
}

pub fn test(path: &Path, format: Format, t: &Tracker) -> Result<(u64, Vec<TestFailure>)> {
    let mut tested = 0;
    let mut failures = Vec::new();
    let mut ar = tar::Archive::new(open(path, format, t)?);
    let entries = match ar.entries() {
        Ok(e) => e,
        Err(e) => return Ok((0, vec![TestFailure { path: "<archive>".into(), error: e.to_string() }])),
    };
    for e in entries {
        t.check_cancel()?;
        match e {
            Ok(mut e) => {
                let name = e.path().map(|p| p.to_string_lossy().to_string()).unwrap_or_default();
                tested += 1;
                if let Err(err) = io::copy(&mut e, &mut io::sink()) {
                    let err = Error::from_io(err);
                    if matches!(err, Error::Cancelled) {
                        return Err(err);
                    }
                    failures.push(TestFailure { path: name, error: err.to_string() });
                    break; // a broken stream can't be resynchronized
                }
            }
            Err(err) => {
                let err = Error::from_io(err);
                if matches!(err, Error::Cancelled) {
                    return Err(err);
                }
                failures.push(TestFailure { path: "<stream>".into(), error: err.to_string() });
                break;
            }
        }
    }
    Ok((tested, failures))
}

pub fn read_entry(path: &Path, format: Format, name: &str, max: usize) -> Result<Vec<u8>> {
    let sink = crate::progress::NoProgress;
    let t = Tracker::new(&sink, 0);
    let want = normalize_name(name);
    let mut ar = tar::Archive::new(open(path, format, &t)?);
    for e in ar.entries().map_err(Error::from_io)? {
        let e = e.map_err(Error::from_io)?;
        let n = normalize_name(&e.path().map_err(Error::from_io)?.to_string_lossy());
        if n.trim_end_matches('/') == want {
            let mut buf = Vec::new();
            e.take(max as u64).read_to_end(&mut buf)?;
            return Ok(buf);
        }
    }
    Err(Error::EntryNotFound(name.into()))
}
