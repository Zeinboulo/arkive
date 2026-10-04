//! 7z backend (LZMA2, optional AES-256 with encrypted headers).

use crate::archive::{Counts, CreateOptions, Entry, ExtractOptions, TestFailure};
use crate::error::{cancelled_io, is_cancel};
use crate::inputs::InputItem;
use crate::progress::{copy_with_progress, ProgressReader, Tracker};
use crate::util::{fmt_unix, is_selected, normalize_name, safe_join, set_mtime};
use crate::{Error, Result};
use sevenz_rust::lzma::LZMA2Options;
use sevenz_rust::{
    AesEncoderOptions, Password, SevenZArchiveEntry, SevenZMethodConfiguration, SevenZReader,
    SevenZWriter,
};
use std::fs::File;
use std::io::{self, BufReader, BufWriter, Read, Write};
use std::path::Path;

fn map_err(e: sevenz_rust::Error, had_password: bool) -> Error {
    use sevenz_rust::Error as E;
    match e {
        E::PasswordRequired => Error::PasswordRequired,
        E::MaybeBadPassword(_) => Error::WrongPassword,
        E::Io(io, _) | E::FileOpen(io, _) if is_cancel(&io) => Error::Cancelled,
        E::ChecksumVerificationFailed if had_password => Error::WrongPassword,
        E::ChecksumVerificationFailed | E::NextHeaderCrcMismatch => {
            Error::Corrupt("checksum verification failed".into())
        }
        E::BadSignature(_) => Error::Corrupt("not a valid 7z archive".into()),
        other => Error::Other(format!("{other:?}")),
    }
}

fn password(p: Option<&str>) -> Password {
    p.map(Password::from).unwrap_or_else(Password::empty)
}

pub fn create(output: &Path, items: &[InputItem], opts: &CreateOptions, t: &Tracker) -> Result<()> {
    let pw = opts.password();
    let mut w = SevenZWriter::create(output).map_err(|e| map_err(e, false))?;
    let mut methods: Vec<SevenZMethodConfiguration> = Vec::new();
    if let Some(p) = pw {
        methods.push(AesEncoderOptions::new(Password::from(p)).into());
    }
    methods.push(LZMA2Options::with_preset(opts.level.min(9)).into());
    w.set_content_methods(methods);
    w.set_encrypt_header(pw.is_some() && opts.encrypt_headers);

    for item in items {
        t.check_cancel()?;
        let entry = SevenZArchiveEntry::from_path(&item.abs, item.name.clone());
        if item.is_dir {
            w.push_archive_entry::<File>(entry, None)
                .map_err(|e| map_err(e, false))?;
        } else {
            let reader = ProgressReader::new(BufReader::new(File::open(&item.abs)?), t, &item.name);
            w.push_archive_entry(entry, Some(reader))
                .map_err(|e| map_err(e, false))?;
        }
    }
    w.finish().map_err(Error::from_io)?;
    Ok(())
}

fn open(path: &Path, pw: Option<&str>) -> Result<SevenZReader<File>> {
    SevenZReader::open(path, password(pw)).map_err(|e| map_err(e, pw.is_some()))
}

pub fn list(path: &Path, pw: Option<&str>) -> Result<Vec<Entry>> {
    let r = open(path, pw)?;
    Ok(r.archive()
        .files
        .iter()
        .map(|f| Entry {
            path: normalize_name(f.name()).trim_end_matches('/').to_string(),
            size: f.size(),
            compressed_size: None,
            is_dir: f.is_directory(),
            modified: if f.has_last_modified_date {
                fmt_unix(f.last_modified_date().to_unix_time())
            } else {
                None
            },
            encrypted: pw.is_some(),
            crc32: f.has_crc.then_some(f.crc as u32),
        })
        .collect())
}

/// Runs `f` for every entry; our own errors are smuggled out of the
/// sevenz-rust callback through `slot`.
fn for_each<F>(path: &Path, pw: Option<&str>, mut f: F) -> Result<()>
where
    F: FnMut(&SevenZArchiveEntry, &mut dyn Read) -> Result<()>,
{
    let mut r = open(path, pw)?;
    let mut slot: Option<Error> = None;
    let res = r.for_each_entries(|entry, reader| match f(entry, reader) {
        Ok(()) => Ok(true),
        Err(e) => {
            slot = Some(e);
            Ok(false)
        }
    });
    if let Some(e) = slot {
        return Err(e);
    }
    res.map_err(|e| map_err(e, pw.is_some()))
}

pub fn extract(path: &Path, dest: &Path, opts: &ExtractOptions, t: &Tracker) -> Result<Counts> {
    let pw = opts.password();
    let total = list(path, pw)?
        .iter()
        .filter(|e| is_selected(&e.path, &opts.selection))
        .map(|e| e.size)
        .sum();
    t.set_total(total);
    let mut c = Counts::default();

    for_each(path, pw, |entry, reader| {
        t.check_cancel()?;
        let name = normalize_name(entry.name());
        if !is_selected(&name, &opts.selection) {
            io::copy(reader, &mut io::sink()).map_err(Error::from_io)?;
            return Ok(());
        }
        let Some(out) = safe_join(dest, &name) else {
            c.skipped += 1;
            return Ok(());
        };
        if entry.is_directory() {
            std::fs::create_dir_all(&out)?;
            c.dirs += 1;
            return Ok(());
        }
        if out.exists() && !opts.overwrite {
            c.skipped += 1;
            let n = io::copy(reader, &mut io::sink()).map_err(Error::from_io)?;
            t.add(n, &name);
            return Ok(());
        }
        if let Some(parent) = out.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let mut w = BufWriter::new(File::create(&out)?);
        c.bytes += copy_with_progress(reader, &mut w, t, &name)?;
        w.flush()?;
        drop(w);
        if entry.has_last_modified_date {
            set_mtime(&out, Some(entry.last_modified_date().to_unix_time()));
        }
        c.files += 1;
        Ok(())
    })?;
    Ok(c)
}

pub fn test(path: &Path, pw: Option<&str>, t: &Tracker) -> Result<(u64, Vec<TestFailure>)> {
    let total = list(path, pw)?.iter().map(|e| e.size).sum();
    t.set_total(total);
    let mut tested = 0;
    let mut failures = Vec::new();
    let res = for_each(path, pw, |entry, reader| {
        let name = entry.name().to_string();
        tested += 1;
        match copy_with_progress(reader, &mut io::sink(), t, &name) {
            Ok(_) => Ok(()),
            Err(Error::Cancelled) => Err(Error::Cancelled),
            Err(e) => {
                failures.push(TestFailure { path: name, error: e.to_string() });
                Ok(())
            }
        }
    });
    match res {
        Ok(()) => {}
        Err(e @ (Error::Cancelled | Error::PasswordRequired | Error::WrongPassword)) => return Err(e),
        Err(e) => failures.push(TestFailure { path: "<archive>".into(), error: e.to_string() }),
    }
    Ok((tested, failures))
}

pub fn read_entry(path: &Path, name: &str, pw: Option<&str>, max: usize) -> Result<Vec<u8>> {
    let want = normalize_name(name);
    let mut found: Option<Vec<u8>> = None;
    for_each(path, pw, |entry, reader| {
        if found.is_none() && normalize_name(entry.name()) == want {
            let mut buf = Vec::new();
            reader.take(max as u64).read_to_end(&mut buf)?;
            found = Some(buf);
            // Stop iterating: signal with a cancel error we swallow below.
            return Err(Error::from_io(cancelled_io()));
        }
        io::copy(reader, &mut io::sink())?;
        Ok(())
    })
    .or_else(|e| if matches!(e, Error::Cancelled) { Ok(()) } else { Err(e) })?;
    found.ok_or_else(|| Error::EntryNotFound(name.into()))
}
