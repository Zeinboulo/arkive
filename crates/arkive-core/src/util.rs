//! Small helpers shared by the format backends.

use std::path::{Component, Path, PathBuf};

/// Normalizes an archive entry name: forward slashes, no leading `./` or `/`.
pub fn normalize_name(name: &str) -> String {
    let mut s = name.replace('\\', "/");
    while let Some(rest) = s.strip_prefix("./") {
        s = rest.to_string();
    }
    s.trim_start_matches('/').to_string()
}

/// Joins an untrusted archive entry name onto `dest`, rejecting path traversal
/// (`..`), absolute paths and drive prefixes ("zip-slip" protection).
pub fn safe_join(dest: &Path, name: &str) -> Option<PathBuf> {
    let name = normalize_name(name);
    let mut out = dest.to_path_buf();
    let mut pushed = false;
    for part in name.split('/') {
        if part.is_empty() || part == "." {
            continue;
        }
        if part == ".." || part.contains(':') {
            return None;
        }
        let p = Path::new(part);
        if p.components().any(|c| !matches!(c, Component::Normal(_))) {
            return None;
        }
        out.push(part);
        pushed = true;
    }
    pushed.then_some(out)
}

/// `true` if `name` is selected by `selection` (empty selection = everything).
/// Selecting a folder selects everything below it.
pub fn is_selected(name: &str, selection: &[String]) -> bool {
    if selection.is_empty() {
        return true;
    }
    let name = normalize_name(name);
    let name = name.trim_end_matches('/');
    selection.iter().any(|s| {
        let s = normalize_name(s);
        let s = s.trim_end_matches('/');
        name == s || name.starts_with(&format!("{s}/"))
    })
}

/// Resolves `0` to the number of logical CPUs.
pub fn effective_threads(requested: usize) -> usize {
    if requested == 0 {
        std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(1)
    } else {
        requested
    }
}

/// Formats a calendar date/time as `YYYY-MM-DD HH:MM`.
pub fn fmt_ymdhm(y: i32, mo: u8, d: u8, h: u8, mi: u8) -> String {
    format!("{y:04}-{mo:02}-{d:02} {h:02}:{mi:02}")
}

/// Formats a unix timestamp (seconds, UTC) as `YYYY-MM-DD HH:MM`.
pub fn fmt_unix(ts: i64) -> Option<String> {
    let t = time::OffsetDateTime::from_unix_timestamp(ts).ok()?;
    Some(fmt_ymdhm(
        t.year(),
        t.month() as u8,
        t.day(),
        t.hour(),
        t.minute(),
    ))
}

/// Converts calendar fields (UTC) to a unix timestamp.
pub fn ymdhms_to_unix(y: i32, mo: u8, d: u8, h: u8, mi: u8, s: u8) -> Option<i64> {
    let month = time::Month::try_from(mo).ok()?;
    let date = time::Date::from_calendar_date(y, month, d).ok()?;
    let t = time::Time::from_hms(h, mi, s.min(59)).ok()?;
    Some(
        time::PrimitiveDateTime::new(date, t)
            .assume_utc()
            .unix_timestamp(),
    )
}

/// Decodes a packed MS-DOS date/time (as used by ZIP and RAR headers).
pub fn dos_to_unix(dos: u32) -> Option<i64> {
    let date = (dos >> 16) as u16;
    let tm = (dos & 0xFFFF) as u16;
    ymdhms_to_unix(
        1980 + (date >> 9) as i32,
        ((date >> 5) & 0x0F) as u8,
        (date & 0x1F) as u8,
        (tm >> 11) as u8,
        ((tm >> 5) & 0x3F) as u8,
        ((tm & 0x1F) * 2) as u8,
    )
}

/// Sets a file's modification time, ignoring failures (best effort).
pub fn set_mtime(path: &Path, unix: Option<i64>) {
    if let Some(ts) = unix {
        let _ = filetime::set_file_mtime(path, filetime::FileTime::from_unix_time(ts, 0));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn safe_join_blocks_traversal() {
        let d = Path::new("out");
        assert!(safe_join(d, "../evil.txt").is_none());
        assert!(safe_join(d, "a/../../evil.txt").is_none());
        assert!(safe_join(d, "C:/Windows/evil.txt").is_none());
        assert_eq!(
            safe_join(d, "/a/b.txt"),
            Some(Path::new("out").join("a").join("b.txt"))
        );
        assert_eq!(
            safe_join(d, "a\\b.txt"),
            Some(Path::new("out").join("a").join("b.txt"))
        );
    }

    #[test]
    fn selection_matches_folders() {
        let sel = vec!["docs".to_string()];
        assert!(is_selected("docs/a.txt", &sel));
        assert!(is_selected("docs/", &sel));
        assert!(!is_selected("docs2/a.txt", &sel));
        assert!(is_selected("anything", &[]));
    }

    #[test]
    fn dos_time_roundtrip() {
        // 2024-05-17 13:45:30
        let date: u32 = ((2024 - 1980) << 9) | (5 << 5) | 17;
        let tm: u32 = (13 << 11) | (45 << 5) | 15;
        let ts = dos_to_unix((date << 16) | tm).unwrap();
        assert_eq!(fmt_unix(ts).unwrap(), "2024-05-17 13:45");
    }
}
