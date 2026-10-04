//! Raw compression codecs, used by the benchmark engine.

use serde::{Deserialize, Serialize};
use std::io::{self, Read, Write};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Codec {
    Deflate,
    Bzip2,
    Xz,
    Zstd,
    Lz4,
}

/// Maps Arkive's unified 1..=9 scale onto zstd's 1..=22 range.
pub fn zstd_level(level: u32) -> i32 {
    const MAP: [i32; 10] = [1, 1, 2, 3, 5, 7, 9, 12, 16, 19];
    MAP[level.min(9) as usize]
}

impl Codec {
    pub const ALL: [Codec; 5] = [Codec::Deflate, Codec::Bzip2, Codec::Xz, Codec::Zstd, Codec::Lz4];

    pub fn label(self) -> &'static str {
        match self {
            Codec::Deflate => "Deflate",
            Codec::Bzip2 => "Bzip2",
            Codec::Xz => "XZ / LZMA2",
            Codec::Zstd => "Zstandard",
            Codec::Lz4 => "LZ4",
        }
    }

    pub fn parse(s: &str) -> Option<Codec> {
        match s.to_lowercase().as_str() {
            "deflate" | "gzip" | "gz" | "zlib" => Some(Codec::Deflate),
            "bzip2" | "bz2" => Some(Codec::Bzip2),
            "xz" | "lzma" | "lzma2" => Some(Codec::Xz),
            "zstd" | "zst" | "zstandard" => Some(Codec::Zstd),
            "lz4" => Some(Codec::Lz4),
            _ => None,
        }
    }

    /// Whether the codec has tunable levels.
    pub fn has_levels(self) -> bool {
        !matches!(self, Codec::Lz4)
    }

    /// Whether the codec can use several threads for a single stream.
    pub fn is_multithreaded(self) -> bool {
        matches!(self, Codec::Xz | Codec::Zstd)
    }

    /// Native level for the unified 1..=9 scale.
    pub fn native_level(self, level: u32) -> i32 {
        let l = level.clamp(1, 9);
        match self {
            Codec::Zstd => zstd_level(l),
            Codec::Lz4 => 0,
            _ => l as i32,
        }
    }

    pub fn compress(self, data: &[u8], level: u32, threads: usize) -> io::Result<Vec<u8>> {
        let l = level.clamp(1, 9);
        let mut out = Vec::with_capacity(data.len() / 2);
        match self {
            Codec::Deflate => {
                let mut e = flate2::write::DeflateEncoder::new(out, flate2::Compression::new(l));
                e.write_all(data)?;
                out = e.finish()?;
            }
            Codec::Bzip2 => {
                let mut e = bzip2::write::BzEncoder::new(out, bzip2::Compression::new(l));
                e.write_all(data)?;
                out = e.finish()?;
            }
            Codec::Xz => {
                let stream = if threads > 1 {
                    xz2::stream::MtStreamBuilder::new()
                        .threads(threads as u32)
                        .preset(l)
                        .encoder()
                } else {
                    xz2::stream::Stream::new_easy_encoder(l, xz2::stream::Check::Crc64)
                }
                .map_err(io::Error::other)?;
                let mut e = xz2::write::XzEncoder::new_stream(out, stream);
                e.write_all(data)?;
                out = e.finish()?;
            }
            Codec::Zstd => {
                let mut e = zstd::Encoder::new(out, zstd_level(l))?;
                if threads > 1 {
                    e.multithread(threads as u32)?;
                }
                e.write_all(data)?;
                out = e.finish()?;
            }
            Codec::Lz4 => out = lz4_flex::compress_prepend_size(data),
        }
        Ok(out)
    }

    pub fn decompress(self, data: &[u8], size_hint: usize) -> io::Result<Vec<u8>> {
        let mut out = Vec::with_capacity(size_hint);
        match self {
            Codec::Deflate => {
                flate2::read::DeflateDecoder::new(data).read_to_end(&mut out)?;
            }
            Codec::Bzip2 => {
                bzip2::read::BzDecoder::new(data).read_to_end(&mut out)?;
            }
            Codec::Xz => {
                xz2::read::XzDecoder::new(data).read_to_end(&mut out)?;
            }
            Codec::Zstd => {
                zstd::Decoder::new(data)?.read_to_end(&mut out)?;
            }
            Codec::Lz4 => {
                out = lz4_flex::decompress_size_prepended(data)
                    .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
            }
        }
        Ok(out)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_codec_roundtrips() {
        let data: Vec<u8> = (0..200_000u32).flat_map(|i| (i % 251).to_le_bytes()).collect();
        for c in Codec::ALL {
            for threads in [1, 4] {
                let z = c.compress(&data, 5, threads).unwrap();
                assert!(z.len() < data.len(), "{c:?} did not compress");
                assert_eq!(c.decompress(&z, data.len()).unwrap(), data, "{c:?} roundtrip");
            }
        }
    }
}
