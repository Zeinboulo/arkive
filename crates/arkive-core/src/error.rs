use std::io;

/// Unified error type for every archive operation.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("I/O error: {0}")]
    Io(#[from] io::Error),

    #[error("unsupported or unrecognized archive format: {0}")]
    UnsupportedFormat(String),

    #[error("this format can only be extracted, not created: {0}")]
    ReadOnlyFormat(String),

    #[error("this archive is encrypted — a password is required")]
    PasswordRequired,

    #[error("wrong password")]
    WrongPassword,

    #[error("encryption is not supported for {0}")]
    EncryptionUnsupported(String),

    #[error("operation cancelled")]
    Cancelled,

    #[error("archive is corrupt: {0}")]
    Corrupt(String),

    #[error("entry not found: {0}")]
    EntryNotFound(String),

    #[error("{0}")]
    Other(String),
}

pub type Result<T> = std::result::Result<T, Error>;

impl Error {
    /// Converts an I/O error raised by a cancelled progress reader back into `Error::Cancelled`.
    pub(crate) fn from_io(e: io::Error) -> Self {
        if is_cancel(&e) {
            Error::Cancelled
        } else {
            Error::Io(e)
        }
    }
}

pub(crate) const CANCEL_MSG: &str = "arkive:cancelled";

/// NOTE: must NOT be `ErrorKind::Interrupted` — `std::io::copy` silently retries those.
pub(crate) fn cancelled_io() -> io::Error {
    io::Error::other(CANCEL_MSG)
}

/// Libraries often re-wrap I/O errors with extra context, so match on the message.
pub(crate) fn is_cancel(e: &io::Error) -> bool {
    e.to_string().contains(CANCEL_MSG)
}

impl From<zip::result::ZipError> for Error {
    fn from(e: zip::result::ZipError) -> Self {
        use zip::result::ZipError;
        match e {
            ZipError::Io(io) => Error::from_io(io),
            ZipError::InvalidPassword => Error::WrongPassword,
            ZipError::UnsupportedArchive(msg) if msg.to_lowercase().contains("password") => {
                Error::PasswordRequired
            }
            ZipError::InvalidArchive(msg) => Error::Corrupt(msg.to_string()),
            ZipError::FileNotFound => Error::EntryNotFound("file not found in archive".into()),
            other => Error::Other(other.to_string()),
        }
    }
}

impl From<walkdir::Error> for Error {
    fn from(e: walkdir::Error) -> Self {
        Error::Other(e.to_string())
    }
}

impl serde::Serialize for Error {
    fn serialize<S: serde::Serializer>(&self, s: S) -> std::result::Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}
