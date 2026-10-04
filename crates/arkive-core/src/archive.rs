//! Public, format-agnostic API. Every frontend (CLI, desktop) goes through here.

use crate::format::{Format, ZipMethod};
use crate::formats::{rarfmt, sevenz, tarfmt, zipfmt};
use crate::inputs::{self, InputItem};
use crate::progress::{Progress, Tracker};
use crate::util::effective_threads;
use crate::{Error, Result};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// One entry (file or directory) inside an archive.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub path: String,
    pub size: u64,
    pub compressed_size: Option<u64>,
    pub is_dir: bool,
    /// `YYYY-MM-DD HH:MM` (UTC) when known.
    pub modified: Option<String>,
    pub encrypted: bool,
    pub crc32: Option<u32>,
}

/// Options for creating a new archive.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CreateOptions {
    pub format: Format,
    /// 0 = store, 1 = fastest … 9 = ultra. Mapped onto each codec's native scale.
    pub level: u32,
    pub password: Option<String>,
    /// Worker threads; 0 = all logical CPUs.
    pub threads: usize,
    pub zip_method: ZipMethod,
    /// 7z only: also encrypt file names.
    pub encrypt_headers: bool,
}

impl Default for CreateOptions {
    fn default() -> Self {
        Self {
            format: Format::Zip,
            level: 6,
            password: None,
            threads: 0,
            zip_method: ZipMethod::Deflate,
            encrypt_headers: true,
        }
    }
}

impl CreateOptions {
    pub(crate) fn threads(&self) -> usize {
        effective_threads(self.threads)
    }
    pub(crate) fn password(&self) -> Option<&str> {
        self.password.as_deref().filter(|p| !p.is_empty())
    }
}

/// Options for extracting an archive.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ExtractOptions {
    pub password: Option<String>,
    pub overwrite: bool,
    /// Entry paths to extract. Empty = everything. Folders include their contents.
    pub selection: Vec<String>,
}

impl ExtractOptions {
    pub(crate) fn password(&self) -> Option<&str> {
        self.password.as_deref().filter(|p| !p.is_empty())
    }
}

/// Counters filled in by the backends while extracting.
#[derive(Debug, Default, Clone, Copy)]
pub(crate) struct Counts {
    pub files: u64,
    pub dirs: u64,
    pub skipped: u64,
    pub bytes: u64,
}

/// Summary of a finished create/extract operation.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationStats {
    pub files: u64,
    pub dirs: u64,
    pub skipped: u64,
    /// Uncompressed bytes processed.
    pub bytes: u64,
    /// Size of the archive on disk.
    pub archive_bytes: u64,
    pub elapsed_ms: u64,
    pub throughput_mb_s: f64,
    pub output: String,
}

/// Result of an integrity test.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestReport {
    pub ok: bool,
    pub tested: u64,
    pub failures: Vec<TestFailure>,
    pub elapsed_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestFailure {
    pub path: String,
    pub error: String,
}

/// Aggregate information about an archive.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveInfo {
    pub path: String,
    pub format: Format,
    pub format_label: String,
    pub archive_size: u64,
    pub files: u64,
    pub dirs: u64,
    pub total_size: u64,
    pub packed_size: Option<u64>,
    /// Archive size / uncompressed size (lower is better).
    pub ratio: f64,
    pub encrypted: bool,
    pub can_add: bool,
}

pub fn detect(path: &Path) -> Result<Format> {
    Format::detect(path).ok_or_else(|| Error::UnsupportedFormat(path.display().to_string()))
}

/// Lists all entries of an archive.
pub fn list(archive: &Path, password: Option<&str>) -> Result<Vec<Entry>> {
    let password = password.filter(|p| !p.is_empty());
    match detect(archive)? {
        Format::Zip => zipfmt::list(archive),
        Format::SevenZ => sevenz::list(archive, password),
        Format::Rar => rarfmt::list(archive, password),
        f => tarfmt::list(archive, f),
    }
}

/// Lists an archive and computes aggregate statistics.
pub fn info(archive: &Path, password: Option<&str>) -> Result<ArchiveInfo> {
    let format = detect(archive)?;
    let entries = list(archive, password)?;
    let archive_size = std::fs::metadata(archive)?.len();
    let files = entries.iter().filter(|e| !e.is_dir).count() as u64;
    let total_size: u64 = entries.iter().map(|e| e.size).sum();
    let packed: Option<u64> = entries
        .iter()
        .filter(|e| !e.is_dir)
        .map(|e| e.compressed_size)
        .sum();
    Ok(ArchiveInfo {
        path: archive.display().to_string(),
        format,
        format_label: format.label().into(),
        archive_size,
        files,
        dirs: entries.len() as u64 - files,
        total_size,
        packed_size: packed,
        ratio: if total_size == 0 { 1.0 } else { archive_size as f64 / total_size as f64 },
        encrypted: entries.iter().any(|e| e.encrypted),
        can_add: format.can_create(),
    })
}

/// Creates a new archive from files and folders.
///
/// The archive is written to a temporary file first and atomically renamed on
/// success, so a cancelled or failed job never leaves a half-written archive.
pub fn create(
    output: &Path,
    inputs: &[PathBuf],
    opts: &CreateOptions,
    progress: &dyn Progress,
) -> Result<OperationStats> {
    let format = opts.format;
    if !format.can_create() {
        return Err(Error::ReadOnlyFormat(format.label().into()));
    }
    if opts.password().is_some() && !format.supports_encryption() {
        return Err(Error::EncryptionUnsupported(format.label().into()));
    }
    if inputs.is_empty() {
        return Err(Error::Other("nothing to add".into()));
    }
    let items = inputs::collect(inputs, Some(output))?;
    let total = inputs::total_size(&items);
    let tracker = Tracker::new(progress, total);

    let tmp = tmp_path(output);
    let result = write_archive(&tmp, &items, opts, &tracker);
    if let Err(e) = result {
        let _ = std::fs::remove_file(&tmp);
        return Err(e);
    }
    if output.exists() {
        std::fs::remove_file(output)?;
    }
    std::fs::rename(&tmp, output)?;

    let elapsed = tracker.started.elapsed();
    Ok(OperationStats {
        files: items.iter().filter(|i| !i.is_dir).count() as u64,
        dirs: items.iter().filter(|i| i.is_dir).count() as u64,
        skipped: 0,
        bytes: total,
        archive_bytes: std::fs::metadata(output)?.len(),
        elapsed_ms: elapsed.as_millis() as u64,
        throughput_mb_s: mb_per_s(total, elapsed.as_secs_f64()),
        output: output.display().to_string(),
    })
}

fn write_archive(tmp: &Path, items: &[InputItem], opts: &CreateOptions, t: &Tracker) -> Result<()> {
    match opts.format {
        Format::Zip => zipfmt::create(tmp, items, opts, t),
        Format::SevenZ => sevenz::create(tmp, items, opts, t),
        Format::Rar => Err(Error::ReadOnlyFormat("RAR".into())),
        f => tarfmt::create(tmp, items, f, opts, t),
    }
}

fn tmp_path(output: &Path) -> PathBuf {
    let mut name = output.file_name().unwrap_or_default().to_os_string();
    name.push(".arkive-tmp");
    output.with_file_name(name)
}

/// Extracts an archive (or a selection of entries) into `dest`.
pub fn extract(
    archive: &Path,
    dest: &Path,
    opts: &ExtractOptions,
    progress: &dyn Progress,
) -> Result<OperationStats> {
    let format = detect(archive)?;
    std::fs::create_dir_all(dest)?;
    let tracker = Tracker::new(progress, 0);
    let c = match format {
        Format::Zip => zipfmt::extract(archive, dest, opts, &tracker)?,
        Format::SevenZ => sevenz::extract(archive, dest, opts, &tracker)?,
        Format::Rar => rarfmt::extract(archive, dest, opts, &tracker)?,
        f => tarfmt::extract(archive, f, dest, opts, &tracker)?,
    };
    let elapsed = tracker.started.elapsed();
    Ok(OperationStats {
        files: c.files,
        dirs: c.dirs,
        skipped: c.skipped,
        bytes: c.bytes,
        archive_bytes: std::fs::metadata(archive)?.len(),
        elapsed_ms: elapsed.as_millis() as u64,
        throughput_mb_s: mb_per_s(c.bytes, elapsed.as_secs_f64()),
        output: dest.display().to_string(),
    })
}

/// Verifies every entry by fully decompressing it and checking CRCs.
pub fn test(archive: &Path, password: Option<&str>, progress: &dyn Progress) -> Result<TestReport> {
    let password = password.filter(|p| !p.is_empty());
    let format = detect(archive)?;
    let tracker = Tracker::new(progress, 0);
    let (tested, failures) = match format {
        Format::Zip => zipfmt::test(archive, password, &tracker)?,
        Format::SevenZ => sevenz::test(archive, password, &tracker)?,
        Format::Rar => rarfmt::test(archive, password, &tracker)?,
        f => tarfmt::test(archive, f, &tracker)?,
    };
    Ok(TestReport {
        ok: failures.is_empty(),
        tested,
        failures,
        elapsed_ms: tracker.started.elapsed().as_millis() as u64,
    })
}

/// Reads (up to `max_bytes` of) a single entry into memory, e.g. for previews.
pub fn read_entry(archive: &Path, name: &str, password: Option<&str>, max_bytes: usize) -> Result<Vec<u8>> {
    let password = password.filter(|p| !p.is_empty());
    match detect(archive)? {
        Format::Zip => zipfmt::read_entry(archive, name, password, max_bytes),
        Format::SevenZ => sevenz::read_entry(archive, name, password, max_bytes),
        Format::Rar => rarfmt::read_entry(archive, name, password, max_bytes),
        f => tarfmt::read_entry(archive, f, name, max_bytes),
    }
}

pub(crate) fn mb_per_s(bytes: u64, secs: f64) -> f64 {
    if secs <= 0.0 {
        0.0
    } else {
        bytes as f64 / 1_048_576.0 / secs
    }
}

/// Suggests an output archive path for a set of inputs, e.g. `C:\data\logs` → `C:\data\logs.zip`.
pub fn suggest_output(inputs: &[PathBuf], format: Format) -> PathBuf {
    let first = inputs.first().cloned().unwrap_or_else(|| PathBuf::from("archive"));
    let parent = first.parent().map(Path::to_path_buf).unwrap_or_default();
    let stem = if inputs.len() == 1 {
        let name = first.file_name().unwrap_or_default().to_string_lossy().to_string();
        if first.is_file() {
            Path::new(&name).file_stem().unwrap_or_default().to_string_lossy().to_string()
        } else {
            name
        }
    } else {
        parent
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "archive".into())
    };
    parent.join(format!("{stem}.{}", format.extension()))
}

/// Suggests an extraction folder, e.g. `C:\dl\photos.tar.gz` → `C:\dl\photos`.
pub fn suggest_extract_dir(archive: &Path) -> PathBuf {
    let name = archive.file_name().unwrap_or_default().to_string_lossy().to_string();
    let stem = match Format::from_path(archive) {
        Some(f) => {
            let ext = format!(".{}", f.extension());
            if name.to_lowercase().ends_with(&ext) {
                name[..name.len() - ext.len()].to_string()
            } else {
                Path::new(&name).file_stem().unwrap_or_default().to_string_lossy().to_string()
            }
        }
        None => Path::new(&name).file_stem().unwrap_or_default().to_string_lossy().to_string(),
    };
    archive.with_file_name(stem)
}
