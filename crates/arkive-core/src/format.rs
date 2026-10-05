use serde::{Deserialize, Serialize};
use std::path::Path;

/// Archive container formats supported by Arkive.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Format {
    Zip,
    #[serde(rename = "7z")]
    SevenZ,
    Tar,
    TarGz,
    TarBz2,
    TarXz,
    TarZst,
    Rar,
}

impl Format {
    pub const ALL: [Format; 8] = [
        Format::Zip,
        Format::SevenZ,
        Format::Tar,
        Format::TarGz,
        Format::TarBz2,
        Format::TarXz,
        Format::TarZst,
        Format::Rar,
    ];

    /// Detects the format from a file name (extension based).
    pub fn from_path(path: &Path) -> Option<Format> {
        let name = path.file_name()?.to_string_lossy().to_lowercase();
        let f = if name.ends_with(".zip") || name.ends_with(".jar") || name.ends_with(".apk") {
            Format::Zip
        } else if name.ends_with(".7z") {
            Format::SevenZ
        } else if name.ends_with(".tar.gz") || name.ends_with(".tgz") {
            Format::TarGz
        } else if name.ends_with(".tar.bz2") || name.ends_with(".tbz2") || name.ends_with(".tbz") {
            Format::TarBz2
        } else if name.ends_with(".tar.xz") || name.ends_with(".txz") {
            Format::TarXz
        } else if name.ends_with(".tar.zst") || name.ends_with(".tzst") {
            Format::TarZst
        } else if name.ends_with(".tar") {
            Format::Tar
        } else if name.ends_with(".rar") {
            Format::Rar
        } else {
            return None;
        };
        Some(f)
    }

    /// Detects the format by sniffing magic bytes, falling back to the extension.
    pub fn detect(path: &Path) -> Option<Format> {
        use std::io::Read;
        let mut buf = [0u8; 8];
        if let Ok(mut f) = std::fs::File::open(path) {
            let n = f.read(&mut buf).unwrap_or(0);
            let b = &buf[..n];
            if b.starts_with(b"PK\x03\x04") || b.starts_with(b"PK\x05\x06") {
                return Some(Format::Zip);
            }
            if b.starts_with(&[0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C]) {
                return Some(Format::SevenZ);
            }
            if b.starts_with(b"Rar!\x1A\x07") {
                return Some(Format::Rar);
            }
        }
        Format::from_path(path)
    }

    pub fn extension(self) -> &'static str {
        match self {
            Format::Zip => "zip",
            Format::SevenZ => "7z",
            Format::Tar => "tar",
            Format::TarGz => "tar.gz",
            Format::TarBz2 => "tar.bz2",
            Format::TarXz => "tar.xz",
            Format::TarZst => "tar.zst",
            Format::Rar => "rar",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Format::Zip => "ZIP",
            Format::SevenZ => "7-Zip",
            Format::Tar => "TAR",
            Format::TarGz => "TAR + Gzip",
            Format::TarBz2 => "TAR + Bzip2",
            Format::TarXz => "TAR + XZ",
            Format::TarZst => "TAR + Zstandard",
            Format::Rar => "RAR",
        }
    }

    /// RAR is proprietary: extraction only.
    pub fn can_create(self) -> bool {
        !matches!(self, Format::Rar)
    }

    pub fn supports_encryption(self) -> bool {
        matches!(self, Format::Zip | Format::SevenZ)
    }

    pub fn is_tar(self) -> bool {
        matches!(
            self,
            Format::Tar | Format::TarGz | Format::TarBz2 | Format::TarXz | Format::TarZst
        )
    }

    /// Parses a user-supplied name such as `zip`, `7z`, `tar.gz`, `tgz`.
    pub fn parse(s: &str) -> Option<Format> {
        Format::from_path(Path::new(&format!("x.{}", s.trim_start_matches('.'))))
    }
}

/// Compression method used inside ZIP archives.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum ZipMethod {
    Store,
    #[default]
    Deflate,
    Bzip2,
    Zstd,
}

impl ZipMethod {
    pub fn parse(s: &str) -> Option<ZipMethod> {
        match s.to_lowercase().as_str() {
            "store" | "stored" | "none" => Some(ZipMethod::Store),
            "deflate" | "deflated" => Some(ZipMethod::Deflate),
            "bzip2" | "bz2" => Some(ZipMethod::Bzip2),
            "zstd" | "zstandard" => Some(ZipMethod::Zstd),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_by_extension() {
        assert_eq!(
            Format::from_path(Path::new("a/b.TAR.GZ")),
            Some(Format::TarGz)
        );
        assert_eq!(Format::from_path(Path::new("a.tgz")), Some(Format::TarGz));
        assert_eq!(Format::from_path(Path::new("x.7z")), Some(Format::SevenZ));
        assert_eq!(
            Format::from_path(Path::new("x.tar.zst")),
            Some(Format::TarZst)
        );
        assert_eq!(Format::from_path(Path::new("x.txt")), None);
        assert_eq!(Format::parse("tar.xz"), Some(Format::TarXz));
    }
}
