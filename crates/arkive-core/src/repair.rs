//! ZIP repair: rebuilds an archive whose central directory is missing or
//! damaged (e.g. truncated downloads) by scanning for local file headers.
//!
//! Every recovered entry whose data can be verified (Stored, Deflate, Bzip2,
//! Zstd) is decompressed and its CRC-32 checked; entries that fail are
//! dropped. Encrypted entries are kept but reported as unverifiable.
//! Limitation: ZIP64 entries / archives larger than 4 GiB are not supported.

use crate::{Error, Result};
use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use std::path::Path;

const LFH_SIG: u32 = 0x0403_4b50;
const CDH_SIG: u32 = 0x0201_4b50;
const EOCD_SIG: u32 = 0x0605_4b50;
const DD_SIG: u32 = 0x0807_4b50;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepairReport {
    pub found: usize,
    pub recovered: usize,
    pub verified: usize,
    pub unverifiable: usize,
    pub dropped: Vec<String>,
    pub output: String,
}

#[derive(Debug, Clone)]
struct Recovered {
    version: u16,
    flags: u16,
    method: u16,
    time: u16,
    date: u16,
    crc: u32,
    csize: u32,
    usize_: u32,
    name: Vec<u8>,
    extra: Vec<u8>,
    data: std::ops::Range<usize>,
    end: usize,
}

fn u16_at(d: &[u8], o: usize) -> Option<u16> {
    d.get(o..o + 2).map(|b| u16::from_le_bytes([b[0], b[1]]))
}
fn u32_at(d: &[u8], o: usize) -> Option<u32> {
    d.get(o..o + 4)
        .map(|b| u32::from_le_bytes([b[0], b[1], b[2], b[3]]))
}

fn find_sig(d: &[u8], from: usize, sig: u32) -> Option<usize> {
    let s = sig.to_le_bytes();
    d.get(from..)?
        .windows(4)
        .position(|w| w == s)
        .map(|p| p + from)
}

fn parse_local(d: &[u8], off: usize) -> Option<Recovered> {
    let version = u16_at(d, off + 4)?;
    let flags = u16_at(d, off + 6)?;
    let method = u16_at(d, off + 8)?;
    let time = u16_at(d, off + 10)?;
    let date = u16_at(d, off + 12)?;
    let mut crc = u32_at(d, off + 14)?;
    let mut csize = u32_at(d, off + 18)?;
    let mut usize_ = u32_at(d, off + 22)?;
    let nlen = u16_at(d, off + 26)? as usize;
    let xlen = u16_at(d, off + 28)? as usize;
    let name_start = off + 30;
    let extra_start = name_start + nlen;
    let data_start = extra_start + xlen;
    if nlen == 0 || data_start > d.len() || csize == u32::MAX || usize_ == u32::MAX {
        return None;
    }
    let name = d[name_start..extra_start].to_vec();
    if name.contains(&0) {
        return None;
    }
    let extra = d[extra_start..data_start].to_vec();

    let (data_end, end) = if flags & 0x0008 != 0 {
        // Sizes live in a trailing data descriptor; find one whose size matches.
        let mut p = data_start;
        loop {
            let s = find_sig(d, p, DD_SIG)?;
            if u32_at(d, s + 8)? as usize == s - data_start {
                crc = u32_at(d, s + 4)?;
                csize = u32_at(d, s + 8)?;
                usize_ = u32_at(d, s + 12)?;
                break (s, s + 16);
            }
            p = s + 1;
        }
    } else {
        let e = data_start.checked_add(csize as usize)?;
        if e > d.len() {
            return None; // truncated entry
        }
        (e, e)
    };
    Some(Recovered {
        version,
        flags,
        method,
        time,
        date,
        crc,
        csize,
        usize_,
        name,
        extra,
        data: data_start..data_end,
        end,
    })
}

enum Verify {
    Ok,
    Unverifiable,
    Bad,
}

fn verify(e: &Recovered, d: &[u8]) -> Verify {
    if e.flags & 0x0001 != 0 || e.method == 99 {
        return Verify::Unverifiable;
    }
    let raw = &d[e.data.clone()];
    let mut out = Vec::with_capacity(e.usize_ as usize);
    let res = match e.method {
        0 => {
            out.extend_from_slice(raw);
            Ok(0)
        }
        8 => flate2::read::DeflateDecoder::new(raw).read_to_end(&mut out),
        12 => bzip2::read::BzDecoder::new(raw).read_to_end(&mut out),
        93 => zstd::Decoder::new(raw).and_then(|mut z| z.read_to_end(&mut out)),
        _ => return Verify::Unverifiable,
    };
    if res.is_ok() && out.len() == e.usize_ as usize && crc32fast::hash(&out) == e.crc {
        Verify::Ok
    } else {
        Verify::Bad
    }
}

/// Scans `input` for recoverable entries and writes a clean archive to `output`.
pub fn repair_zip(input: &Path, output: &Path) -> Result<RepairReport> {
    let d = std::fs::read(input)?;
    if d.len() > u32::MAX as usize {
        return Err(Error::Other(
            "repair of archives larger than 4 GiB is not supported".into(),
        ));
    }

    let mut found = Vec::new();
    let mut pos = 0;
    while let Some(off) = find_sig(&d, pos, LFH_SIG) {
        match parse_local(&d, off) {
            Some(e) => {
                pos = e.end;
                found.push(e);
            }
            None => pos = off + 4,
        }
    }

    let mut report = RepairReport {
        found: found.len(),
        recovered: 0,
        verified: 0,
        unverifiable: 0,
        dropped: Vec::new(),
        output: output.display().to_string(),
    };
    let mut keep = Vec::new();
    for e in found {
        match verify(&e, &d) {
            Verify::Ok => report.verified += 1,
            Verify::Unverifiable => report.unverifiable += 1,
            Verify::Bad => {
                report
                    .dropped
                    .push(String::from_utf8_lossy(&e.name).into_owned());
                continue;
            }
        }
        keep.push(e);
    }
    if keep.is_empty() {
        return Err(Error::Corrupt("no recoverable entries found".into()));
    }
    report.recovered = keep.len();

    let mut out: Vec<u8> = Vec::with_capacity(d.len());
    let mut offsets = Vec::with_capacity(keep.len());
    for e in &keep {
        offsets.push(out.len() as u32);
        let flags = e.flags & !0x0008; // sizes are now in the header
        out.extend_from_slice(&LFH_SIG.to_le_bytes());
        for v in [e.version, flags, e.method, e.time, e.date] {
            out.extend_from_slice(&v.to_le_bytes());
        }
        for v in [e.crc, e.csize, e.usize_] {
            out.extend_from_slice(&v.to_le_bytes());
        }
        out.extend_from_slice(&(e.name.len() as u16).to_le_bytes());
        out.extend_from_slice(&(e.extra.len() as u16).to_le_bytes());
        out.extend_from_slice(&e.name);
        out.extend_from_slice(&e.extra);
        out.extend_from_slice(&d[e.data.clone()]);
    }

    let cd_start = out.len() as u32;
    for (e, &off) in keep.iter().zip(&offsets) {
        let flags = e.flags & !0x0008;
        let is_dir = e.name.ends_with(b"/");
        out.extend_from_slice(&CDH_SIG.to_le_bytes());
        out.extend_from_slice(&e.version.to_le_bytes()); // version made by
        for v in [e.version, flags, e.method, e.time, e.date] {
            out.extend_from_slice(&v.to_le_bytes());
        }
        for v in [e.crc, e.csize, e.usize_] {
            out.extend_from_slice(&v.to_le_bytes());
        }
        for v in [e.name.len() as u16, e.extra.len() as u16, 0, 0, 0] {
            out.extend_from_slice(&v.to_le_bytes()); // name, extra, comment, disk, int attrs
        }
        out.extend_from_slice(&(if is_dir { 0x10u32 } else { 0 }).to_le_bytes());
        out.extend_from_slice(&off.to_le_bytes());
        out.extend_from_slice(&e.name);
        out.extend_from_slice(&e.extra);
    }
    let cd_size = out.len() as u32 - cd_start;
    let n = keep.len().min(u16::MAX as usize) as u16;
    out.extend_from_slice(&EOCD_SIG.to_le_bytes());
    for v in [0u16, 0, n, n] {
        out.extend_from_slice(&v.to_le_bytes());
    }
    out.extend_from_slice(&cd_size.to_le_bytes());
    out.extend_from_slice(&cd_start.to_le_bytes());
    out.extend_from_slice(&0u16.to_le_bytes());

    std::fs::File::create(output)?.write_all(&out)?;
    Ok(report)
}

/// Suggests `name.repaired.zip` next to the input.
pub fn suggest_output(input: &Path) -> std::path::PathBuf {
    let stem = input.file_stem().unwrap_or_default().to_string_lossy();
    input.with_file_name(format!("{stem}.repaired.zip"))
}
