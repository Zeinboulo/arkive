//! ZIP backend with a parallel compression engine.
//!
//! Strategy: small/medium files are compressed concurrently on a rayon pool,
//! each into its own in-memory single-entry ZIP. The already-compressed
//! entries are then raw-copied (no recompression) into the output archive in
//! the original order. Large files are streamed directly to keep memory flat.

use crate::archive::{Counts, CreateOptions, Entry, ExtractOptions, TestFailure};
use crate::format::ZipMethod;
use crate::inputs::InputItem;
use crate::progress::{copy_with_progress, Tracker};
use crate::util::{fmt_ymdhm, is_selected, normalize_name, safe_join, set_mtime, ymdhms_to_unix};
use crate::{Error, Result};
use rayon::prelude::*;
use std::collections::HashSet;
use std::fs::File;
use std::io::{self, BufReader, BufWriter, Cursor, Read, Write};
use std::path::{Path, PathBuf};
use zip::write::{FileOptions, SimpleFileOptions};
use zip::{AesMode, CompressionMethod, ZipArchive, ZipWriter};

/// Files larger than this are streamed instead of compressed in parallel.
const PARALLEL_MAX_FILE: u64 = 64 * 1024 * 1024;
/// Maximum uncompressed bytes buffered per parallel batch.
const BATCH_BYTES: u64 = 512 * 1024 * 1024;
/// High-throughput 256 KiB I/O buffer size to minimize Windows NTFS syscall overhead.
const IO_BUF_SIZE: usize = 256 * 1024;

/// Returns `true` if the file extension is already compressed (media, archives, webfonts)
/// where running Deflate/Bzip2/Zstd wastes CPU cycles without meaningful size reduction.
fn is_precompressed(name: &str) -> bool {
    let Some((_, ext)) = name.rsplit_once('.') else {
        return false;
    };
    matches!(
        ext.to_ascii_lowercase().as_str(),
        "jpg"
            | "jpeg"
            | "png"
            | "webp"
            | "avif"
            | "heic"
            | "gif"
            | "mp4"
            | "mkv"
            | "mov"
            | "webm"
            | "avi"
            | "m4v"
            | "mp3"
            | "aac"
            | "flac"
            | "ogg"
            | "opus"
            | "m4a"
            | "wma"
            | "zip"
            | "7z"
            | "rar"
            | "gz"
            | "tgz"
            | "bz2"
            | "tbz2"
            | "xz"
            | "txz"
            | "zst"
            | "tzst"
            | "lz4"
            | "woff"
            | "woff2"
            | "apk"
            | "ipa"
            | "whl"
            | "nupkg"
    )
}

fn method_and_level(opts: &CreateOptions, item: &InputItem) -> (CompressionMethod, Option<i64>) {
    let l = opts.level.min(9) as i64;
    if l == 0 || (!item.is_dir && (item.size < 64 || is_precompressed(&item.name))) {
        return (CompressionMethod::Stored, None);
    }
    match opts.zip_method {
        ZipMethod::Store => (CompressionMethod::Stored, None),
        ZipMethod::Deflate => (CompressionMethod::Deflated, Some(l)),
        ZipMethod::Bzip2 => (CompressionMethod::Bzip2, Some(l)),
        ZipMethod::Zstd => (
            CompressionMethod::Zstd,
            Some(crate::codec::zstd_level(l as u32) as i64),
        ),
    }
}

fn zip_datetime(item: &InputItem) -> zip::DateTime {
    item.modified
        .map(time::OffsetDateTime::from)
        .and_then(|t| zip::DateTime::try_from(t).ok())
        .unwrap_or_default()
}

fn file_options_with_method<'a>(
    opts: &'a CreateOptions,
    item: &InputItem,
    method: CompressionMethod,
    level: Option<i64>,
) -> FileOptions<'a, ()> {
    let o: FileOptions<'a, ()> = SimpleFileOptions::default()
        .compression_method(method)
        .compression_level(level)
        .last_modified_time(zip_datetime(item))
        .large_file(item.size >= u32::MAX as u64)
        .unix_permissions(if item.is_dir { 0o755 } else { 0o644 });
    match opts.password() {
        Some(pw) => o.with_aes_encryption(AesMode::Aes256, pw),
        None => o,
    }
}

fn file_options<'a>(opts: &'a CreateOptions, item: &InputItem) -> FileOptions<'a, ()> {
    let (method, level) = method_and_level(opts, item);
    file_options_with_method(opts, item, method, level)
}

pub fn create(output: &Path, items: &[InputItem], opts: &CreateOptions, t: &Tracker) -> Result<()> {
    let file = File::create(output)?;
    let mut zw = ZipWriter::new(BufWriter::with_capacity(1 << 20, file));
    let threads = opts.threads();
    let pool = rayon::ThreadPoolBuilder::new()
        .num_threads(threads)
        .build()
        .map_err(|e| Error::Other(e.to_string()))?;

    let mut batch: Vec<&InputItem> = Vec::new();
    let mut batch_bytes = 0u64;

    for item in items {
        t.check_cancel()?;
        let parallel = threads > 1 && !item.is_dir && item.size <= PARALLEL_MAX_FILE;
        if parallel {
            batch.push(item);
            batch_bytes += item.size;
            if batch_bytes >= BATCH_BYTES {
                flush_batch(&mut zw, &mut batch, &pool, opts, t)?;
                batch_bytes = 0;
            }
            continue;
        }
        // Preserve entry order: drain pending parallel work first.
        flush_batch(&mut zw, &mut batch, &pool, opts, t)?;
        batch_bytes = 0;
        if item.is_dir {
            zw.add_directory(format!("{}/", item.name), file_options(opts, item))?;
        } else {
            zw.start_file(item.name.as_str(), file_options(opts, item))?;
            let f = BufReader::with_capacity(IO_BUF_SIZE, File::open(&item.abs)?);
            copy_with_progress(f, &mut zw, t, &item.name)?;
        }
    }
    flush_batch(&mut zw, &mut batch, &pool, opts, t)?;
    zw.finish()?.flush()?;
    Ok(())
}

fn flush_batch<W: Write + io::Seek>(
    zw: &mut ZipWriter<W>,
    batch: &mut Vec<&InputItem>,
    pool: &rayon::ThreadPool,
    opts: &CreateOptions,
    t: &Tracker,
) -> Result<()> {
    if batch.is_empty() {
        return Ok(());
    }
    let parts: Vec<Result<Vec<u8>>> = pool.install(|| {
        batch
            .par_iter()
            .map(|item| compress_one(item, opts, t))
            .collect()
    });
    for part in parts {
        let mut single = ZipArchive::new(Cursor::new(part?))?;
        let entry = single.by_index_raw(0)?;
        zw.raw_copy_file(entry)?;
    }
    batch.clear();
    Ok(())
}

/// Compresses one file into a standalone in-memory ZIP (runs on a worker thread).
/// If an unencrypted file does not shrink after compression, falls back to `Stored`
/// so no entry ever inflates larger than its uncompressed size.
fn compress_one(item: &InputItem, opts: &CreateOptions, t: &Tracker) -> Result<Vec<u8>> {
    let (method, level) = method_and_level(opts, item);
    let cap = (item.size as usize / 2).max(1024);
    let mut w = ZipWriter::new(Cursor::new(Vec::with_capacity(cap)));
    w.start_file(
        item.name.as_str(),
        file_options_with_method(opts, item, method, level),
    )?;
    let f = BufReader::with_capacity(IO_BUF_SIZE, File::open(&item.abs)?);
    copy_with_progress(f, &mut w, t, &item.name)?;
    let bytes = w.finish()?.into_inner();

    if method != CompressionMethod::Stored && opts.password().is_none() && item.size > 0 {
        if let Ok(mut single) = ZipArchive::new(Cursor::new(&bytes)) {
            if let Ok(entry) = single.by_index_raw(0) {
                if entry.compressed_size() >= item.size {
                    let mut sw = ZipWriter::new(Cursor::new(Vec::with_capacity(
                        item.size as usize + 256,
                    )));
                    sw.start_file(
                        item.name.as_str(),
                        file_options_with_method(opts, item, CompressionMethod::Stored, None),
                    )?;
                    let mut rf = BufReader::with_capacity(IO_BUF_SIZE, File::open(&item.abs)?);
                    io::copy(&mut rf, &mut sw)?;
                    return Ok(sw.finish()?.into_inner());
                }
            }
        }
    }
    Ok(bytes)
}

fn open(path: &Path) -> Result<ZipArchive<BufReader<File>>> {
    Ok(ZipArchive::new(BufReader::with_capacity(
        IO_BUF_SIZE,
        File::open(path)?,
    ))?)
}

fn dt_string(dt: zip::DateTime) -> String {
    fmt_ymdhm(
        dt.year() as i32,
        dt.month(),
        dt.day(),
        dt.hour(),
        dt.minute(),
    )
}

fn dt_unix(dt: zip::DateTime) -> Option<i64> {
    ymdhms_to_unix(
        dt.year() as i32,
        dt.month(),
        dt.day(),
        dt.hour(),
        dt.minute(),
        dt.second(),
    )
}

pub fn list(path: &Path) -> Result<Vec<Entry>> {
    let mut ar = open(path)?;
    let mut out = Vec::with_capacity(ar.len());
    for i in 0..ar.len() {
        let f = ar.by_index_raw(i)?;
        out.push(Entry {
            path: normalize_name(f.name()).trim_end_matches('/').to_string(),
            size: f.size(),
            compressed_size: Some(f.compressed_size()),
            is_dir: f.is_dir(),
            modified: f.last_modified().map(dt_string),
            encrypted: f.encrypted(),
            crc32: Some(f.crc32()),
        });
    }
    Ok(out)
}

/// Opens entry `i`, decrypting when a password is supplied.
fn open_entry<'a>(
    ar: &'a mut ZipArchive<BufReader<File>>,
    i: usize,
    password: Option<&str>,
) -> Result<zip::read::ZipFile<'a>> {
    let encrypted = ar.by_index_raw(i)?.encrypted();
    Ok(match (encrypted, password) {
        (true, Some(pw)) => ar.by_index_decrypt(i, pw.as_bytes())?,
        (true, None) => return Err(Error::PasswordRequired),
        (false, _) => ar.by_index(i)?,
    })
}

pub fn extract(path: &Path, dest: &Path, opts: &ExtractOptions, t: &Tracker) -> Result<Counts> {
    let mut ar = open(path)?;
    let mut total = 0;
    for i in 0..ar.len() {
        let f = ar.by_index_raw(i)?;
        if is_selected(f.name(), &opts.selection) {
            total += f.size();
        }
    }
    t.set_total(total);

    let mut c = Counts::default();
    let mut created_dirs: HashSet<PathBuf> = HashSet::new();
    for i in 0..ar.len() {
        t.check_cancel()?;
        let (name, is_dir, size) = {
            let f = ar.by_index_raw(i)?;
            (f.name().to_string(), f.is_dir(), f.size())
        };
        if !is_selected(&name, &opts.selection) {
            continue;
        }
        let Some(out) = safe_join(dest, &name) else {
            c.skipped += 1;
            continue;
        };
        if is_dir {
            if created_dirs.insert(out.clone()) {
                std::fs::create_dir_all(&out)?;
            }
            c.dirs += 1;
            continue;
        }
        if out.exists() && !opts.overwrite {
            c.skipped += 1;
            t.add(size, &name);
            continue;
        }
        let mut f = open_entry(&mut ar, i, opts.password())?;
        if let Some(parent) = out.parent() {
            if !created_dirs.contains(parent) {
                std::fs::create_dir_all(parent)?;
                created_dirs.insert(parent.to_path_buf());
            }
        }
        let mut w = BufWriter::with_capacity(IO_BUF_SIZE, File::create(&out)?);
        c.bytes += copy_with_progress(&mut f, &mut w, t, &name)?;
        w.flush()?;
        drop(w);
        set_mtime(&out, f.last_modified().and_then(dt_unix));
        c.files += 1;
    }
    Ok(c)
}

pub fn test(path: &Path, password: Option<&str>, t: &Tracker) -> Result<(u64, Vec<TestFailure>)> {
    let mut ar = open(path)?;
    let total = (0..ar.len())
        .map(|i| ar.by_index_raw(i).map(|f| f.size()).unwrap_or(0))
        .sum();
    t.set_total(total);
    let mut tested = 0;
    let mut failures = Vec::new();
    for i in 0..ar.len() {
        t.check_cancel()?;
        let name = ar.by_index_raw(i)?.name().to_string();
        let res = open_entry(&mut ar, i, password)
            .and_then(|mut f| copy_with_progress(&mut f, &mut io::sink(), t, &name));
        match res {
            Ok(_) => {}
            Err(e @ (Error::Cancelled | Error::PasswordRequired | Error::WrongPassword)) => {
                return Err(e)
            }
            Err(e) => failures.push(TestFailure {
                path: name,
                error: e.to_string(),
            }),
        }
        tested += 1;
    }
    Ok((tested, failures))
}

pub fn read_entry(path: &Path, name: &str, password: Option<&str>, max: usize) -> Result<Vec<u8>> {
    let mut ar = open(path)?;
    let want = normalize_name(name);
    let idx = (0..ar.len())
        .find(|&i| {
            ar.by_index_raw(i)
                .map(|f| normalize_name(f.name()).trim_end_matches('/') == want)
                .unwrap_or(false)
        })
        .ok_or_else(|| Error::EntryNotFound(name.into()))?;
    let f = open_entry(&mut ar, idx, password)?;
    let mut buf = Vec::new();
    f.take(max as u64).read_to_end(&mut buf)?;
    Ok(buf)
}
