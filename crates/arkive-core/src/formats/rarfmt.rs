//! RAR backend — extraction only (the RAR compression format is proprietary).
//! Uses the official UnRAR library via the `unrar` crate.

use crate::archive::{Counts, Entry, ExtractOptions, TestFailure};
use crate::util::{dos_to_unix, fmt_unix, is_selected, normalize_name, safe_join};
use crate::progress::Tracker;
use crate::{Error, Result};
use std::path::Path;
use unrar::error::{Code, UnrarError};

fn map_err(e: UnrarError) -> Error {
    match e.code {
        Code::MissingPassword => Error::PasswordRequired,
        Code::BadPassword => Error::WrongPassword,
        Code::BadData | Code::BadArchive => Error::Corrupt(format!("{e}")),
        Code::UnknownFormat => Error::UnsupportedFormat("RAR (unknown version)".into()),
        _ => Error::Other(format!("unrar: {e}")),
    }
}

fn archive<'a>(path: &'a Path, pw: &'a Option<String>) -> unrar::Archive<'a> {
    match pw {
        Some(p) => unrar::Archive::with_password(path, p.as_str()),
        None => unrar::Archive::new(path),
    }
}

fn header_to_entry(h: &unrar::FileHeader) -> Entry {
    Entry {
        path: normalize_name(&h.filename.to_string_lossy()).trim_end_matches('/').to_string(),
        size: h.unpacked_size,
        compressed_size: None,
        is_dir: h.is_directory(),
        modified: dos_to_unix(h.file_time).and_then(fmt_unix),
        encrypted: h.is_encrypted(),
        crc32: Some(h.file_crc),
    }
}

pub fn list(path: &Path, pw: Option<&str>) -> Result<Vec<Entry>> {
    let pw = pw.map(str::to_string);
    let mut out = Vec::new();
    for h in archive(path, &pw).open_for_listing().map_err(map_err)? {
        out.push(header_to_entry(&h.map_err(map_err)?));
    }
    Ok(out)
}

pub fn extract(path: &Path, dest: &Path, opts: &ExtractOptions, t: &Tracker) -> Result<Counts> {
    let pw = opts.password().map(str::to_string);
    let total = list(path, pw.as_deref())?
        .iter()
        .filter(|e| is_selected(&e.path, &opts.selection))
        .map(|e| e.size)
        .sum();
    t.set_total(total);

    let mut c = Counts::default();
    let mut a = archive(path, &pw).open_for_processing().map_err(map_err)?;
    while let Some(h) = a.read_header().map_err(map_err)? {
        t.check_cancel()?;
        let e = header_to_entry(h.entry());
        let wanted = is_selected(&e.path, &opts.selection);
        let target = safe_join(dest, &e.path);
        a = if !wanted || target.is_none() {
            h.skip().map_err(map_err)?
        } else if e.is_dir {
            c.dirs += 1;
            std::fs::create_dir_all(target.unwrap())?;
            h.skip().map_err(map_err)?
        } else if target.as_ref().is_some_and(|p| p.exists()) && !opts.overwrite {
            c.skipped += 1;
            t.add(e.size, &e.path);
            h.skip().map_err(map_err)?
        } else {
            t.add(0, &e.path);
            let next = h.extract_with_base(dest).map_err(map_err)?;
            t.add(e.size, &e.path);
            c.files += 1;
            c.bytes += e.size;
            next
        };
    }
    Ok(c)
}

pub fn test(path: &Path, pw: Option<&str>, t: &Tracker) -> Result<(u64, Vec<TestFailure>)> {
    let pw = pw.map(str::to_string);
    let total = list(path, pw.as_deref())?.iter().map(|e| e.size).sum();
    t.set_total(total);
    let mut tested = 0;
    let mut failures = Vec::new();
    let mut a = archive(path, &pw).open_for_processing().map_err(map_err)?;
    while let Some(h) = a.read_header().map_err(map_err)? {
        t.check_cancel()?;
        let e = header_to_entry(h.entry());
        if e.is_dir {
            a = h.skip().map_err(map_err)?;
            continue;
        }
        tested += 1;
        match h.test() {
            Ok(next) => {
                t.add(e.size, &e.path);
                a = next;
            }
            Err(err) => {
                let err = map_err(err);
                if matches!(err, Error::WrongPassword | Error::PasswordRequired) {
                    return Err(err);
                }
                failures.push(TestFailure { path: e.path, error: err.to_string() });
                break;
            }
        }
    }
    Ok((tested, failures))
}

pub fn read_entry(path: &Path, name: &str, pw: Option<&str>, max: usize) -> Result<Vec<u8>> {
    let pw = pw.map(str::to_string);
    let want = normalize_name(name);
    let mut a = archive(path, &pw).open_for_processing().map_err(map_err)?;
    while let Some(h) = a.read_header().map_err(map_err)? {
        if header_to_entry(h.entry()).path == want {
            let (mut data, _) = h.read().map_err(map_err)?;
            data.truncate(max);
            return Ok(data);
        }
        a = h.skip().map_err(map_err)?;
    }
    Err(Error::EntryNotFound(name.into()))
}
