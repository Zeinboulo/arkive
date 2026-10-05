//! Collects files and folders to be archived.

use crate::util::normalize_name;
use crate::Result;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use walkdir::WalkDir;

/// A file or directory that will be written into an archive.
#[derive(Debug, Clone)]
pub struct InputItem {
    /// Absolute path on disk.
    pub abs: PathBuf,
    /// Name inside the archive (forward slashes, no trailing slash).
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: Option<SystemTime>,
}

/// Expands the user's selection into a flat, deterministic list of items.
///
/// Each input keeps its own name as the top-level entry (like WinRAR), so
/// adding `C:\data\logs` produces `logs/...` inside the archive.
/// `exclude` (typically the output archive itself) is skipped.
pub fn collect(inputs: &[PathBuf], exclude: Option<&Path>) -> Result<Vec<InputItem>> {
    let exclude = exclude.and_then(|p| std::fs::canonicalize(p).ok());
    let mut items = Vec::new();
    for input in inputs {
        let input = std::fs::canonicalize(input)?;
        let base = input.parent().map(Path::to_path_buf).unwrap_or_default();
        for entry in WalkDir::new(&input).follow_links(true).sort_by_file_name() {
            let entry = entry?;
            let path = entry.path();
            if exclude.as_deref() == Some(path) {
                continue;
            }
            let rel = path.strip_prefix(&base).unwrap_or(path);
            let name = normalize_name(&rel.to_string_lossy());
            if name.is_empty() {
                continue;
            }
            let meta = entry.metadata()?;
            items.push(InputItem {
                abs: path.to_path_buf(),
                name,
                is_dir: meta.is_dir(),
                size: if meta.is_file() { meta.len() } else { 0 },
                modified: meta.modified().ok(),
            });
        }
    }
    Ok(items)
}

pub fn total_size(items: &[InputItem]) -> u64 {
    items.iter().map(|i| i.size).sum()
}
