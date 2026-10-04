use crate::error::cancelled_io;
use std::io::{self, Read, Write};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;

/// Receives progress updates from long-running operations.
///
/// Implementations must be thread-safe because parallel compression reports
/// from several worker threads at once.
pub trait Progress: Send + Sync {
    /// Called whenever more bytes have been processed. `done`/`total` are in bytes.
    fn update(&self, done: u64, total: u64, current: &str);
    /// Returning `true` aborts the operation as soon as possible.
    fn is_cancelled(&self) -> bool {
        false
    }
}

/// A progress sink that ignores everything.
pub struct NoProgress;
impl Progress for NoProgress {
    fn update(&self, _: u64, _: u64, _: &str) {}
}

/// Thread-safe byte counter shared by all readers of one operation.
pub struct Tracker<'a> {
    sink: &'a dyn Progress,
    done: AtomicU64,
    total: AtomicU64,
    pub started: Instant,
}

impl<'a> Tracker<'a> {
    pub fn new(sink: &'a dyn Progress, total: u64) -> Self {
        Self {
            sink,
            done: AtomicU64::new(0),
            total: AtomicU64::new(total),
            started: Instant::now(),
        }
    }

    pub fn set_total(&self, total: u64) {
        self.total.store(total, Ordering::Relaxed);
    }

    pub fn add(&self, n: u64, current: &str) {
        let done = self.done.fetch_add(n, Ordering::Relaxed) + n;
        self.sink
            .update(done, self.total.load(Ordering::Relaxed), current);
    }

    pub fn done(&self) -> u64 {
        self.done.load(Ordering::Relaxed)
    }

    pub fn check(&self) -> io::Result<()> {
        if self.sink.is_cancelled() {
            Err(cancelled_io())
        } else {
            Ok(())
        }
    }

    pub fn check_cancel(&self) -> crate::Result<()> {
        if self.sink.is_cancelled() {
            Err(crate::Error::Cancelled)
        } else {
            Ok(())
        }
    }
}

/// Wraps a reader and reports every chunk read to a [`Tracker`].
pub struct ProgressReader<'t, 'a, R> {
    inner: R,
    tracker: &'t Tracker<'a>,
    label: String,
}

impl<'t, 'a, R: Read> ProgressReader<'t, 'a, R> {
    pub fn new(inner: R, tracker: &'t Tracker<'a>, label: impl Into<String>) -> Self {
        Self {
            inner,
            tracker,
            label: label.into(),
        }
    }
}

impl<R: Read> Read for ProgressReader<'_, '_, R> {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        self.tracker.check()?;
        let n = self.inner.read(buf)?;
        if n > 0 {
            self.tracker.add(n as u64, &self.label);
        }
        Ok(n)
    }
}

/// Copies `r` into `w`, reporting progress and honoring cancellation.
pub fn copy_with_progress<R: Read, W: Write>(
    r: R,
    w: &mut W,
    tracker: &Tracker,
    label: &str,
) -> crate::Result<u64> {
    let mut pr = ProgressReader::new(r, tracker, label);
    io::copy(&mut pr, w).map_err(crate::Error::from_io)
}

/// A simple cancellation flag usable from UIs.
#[derive(Clone, Default)]
pub struct CancelToken(Arc<AtomicBool>);

impl CancelToken {
    pub fn new() -> Self {
        Self::default()
    }
    pub fn cancel(&self) {
        self.0.store(true, Ordering::SeqCst);
    }
    pub fn is_cancelled(&self) -> bool {
        self.0.load(Ordering::SeqCst)
    }
}
