//! # arkive-core
//!
//! The archive engine behind Arkive. It exposes one format-agnostic API
//! ([`list`], [`create`], [`extract`], [`test`], [`read_entry`]) on top of:
//!
//! * **ZIP**: Deflate / Bzip2 / Zstd, AES-256, parallel compression
//! * **7z**: LZMA2, AES-256 with encrypted headers
//! * **TAR**: plain, Gzip, Bzip2, XZ (multi-threaded), Zstandard (multi-threaded)
//! * **RAR**: extraction only
//!
//! plus a ZIP [`repair`] tool and a compression [`bench`]mark engine.
//!
//! ```no_run
//! use arkive_core::{create, extract, CreateOptions, ExtractOptions, Format, NoProgress};
//! use std::path::{Path, PathBuf};
//!
//! let opts = CreateOptions { format: Format::TarZst, level: 6, ..Default::default() };
//! create(Path::new("logs.tar.zst"), &[PathBuf::from("logs")], &opts, &NoProgress)?;
//! extract(Path::new("logs.tar.zst"), Path::new("out"), &ExtractOptions::default(), &NoProgress)?;
//! # Ok::<(), arkive_core::Error>(())
//! ```

pub mod archive;
pub mod bench;
pub mod codec;
pub mod error;
pub mod format;
mod formats;
pub mod inputs;
pub mod progress;
pub mod repair;
pub mod util;
pub mod video;

pub use archive::{
    create, detect, extract, info, list, read_entry, suggest_extract_dir, suggest_output, test,
    ArchiveInfo, CreateOptions, Entry, ExtractOptions, OperationStats, TestFailure, TestReport,
};
pub use error::{Error, Result};
pub use format::{Format, ZipMethod};
pub use progress::{CancelToken, NoProgress, Progress};
pub use repair::RepairReport;
pub use video::{
    compress as compress_video, probe as probe_video, suggest_output as suggest_video_output,
    VideoCodec, VideoCompressOptions, VideoCompressStats, VideoMetadata, VideoPreset,
    VideoResolution,
};
