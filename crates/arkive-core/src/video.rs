//! Video compression, transcoding, and bitrate optimization.
//!
//! Powered by a bundled or system FFmpeg engine, providing:
//! * Codecs: H.264, H.265 (HEVC), VP9, and AV1
//! * Presets: Discord / Web (< 25 MB budget), Balanced, High-Compression, 720p Mobile
//! * Bitrate budgeting: exact target megabyte allocation based on duration
//! * Real-time progress parsing (FPS, elapsed time, current speed, percentage)

use crate::error::{Error, Result};
use crate::progress::Progress;
use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::Instant;

/// Detected metadata for an input video file.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoMetadata {
    pub path: String,
    pub filename: String,
    pub size_bytes: u64,
    pub duration_seconds: f64,
    pub width: u32,
    pub height: u32,
    pub video_codec: String,
    pub audio_codec: String,
    pub bitrate_kbps: u64,
    pub fps: f64,
}

/// Target video codec.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum VideoCodec {
    #[default]
    H264,
    H265,
    Vp9,
    Av1,
}

impl VideoCodec {
    pub fn parse(s: &str) -> Option<Self> {
        match s.to_ascii_lowercase().as_str() {
            "h264" | "avc" | "x264" => Some(Self::H264),
            "h265" | "hevc" | "x265" => Some(Self::H265),
            "vp9" => Some(Self::Vp9),
            "av1" | "aom" => Some(Self::Av1),
            _ => None,
        }
    }

    pub fn ffmpeg_name(self) -> &'static str {
        match self {
            Self::H264 => "libx264",
            Self::H265 => "libx265",
            Self::Vp9 => "libvpx-vp9",
            Self::Av1 => "libaom-av1",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Self::H264 => "H.264 (AVC)",
            Self::H265 => "H.265 (HEVC)",
            Self::Vp9 => "VP9",
            Self::Av1 => "AV1",
        }
    }
}

/// Downscaling target.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum VideoResolution {
    #[default]
    Original,
    P1080,
    P720,
    P480,
}

impl VideoResolution {
    pub fn parse(s: &str) -> Option<Self> {
        match s.to_ascii_lowercase().as_str() {
            "original" | "auto" | "same" => Some(Self::Original),
            "1080" | "1080p" => Some(Self::P1080),
            "720" | "720p" => Some(Self::P720),
            "480" | "480p" => Some(Self::P480),
            _ => None,
        }
    }

    pub fn target_height(self) -> Option<u32> {
        match self {
            Self::Original => None,
            Self::P1080 => Some(1080),
            Self::P720 => Some(720),
            Self::P480 => Some(480),
        }
    }
}

/// Compression preset profile.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VideoPreset {
    Discord25Mb,
    #[default]
    Balanced,
    HighCompression,
    Mobile720p,
    Custom,
}

impl VideoPreset {
    pub fn parse(s: &str) -> Option<Self> {
        match s.to_ascii_lowercase().replace('-', "_").as_str() {
            "discord" | "discord_25mb" | "discord25mb" => Some(Self::Discord25Mb),
            "balanced" => Some(Self::Balanced),
            "high" | "high_compression" | "max" => Some(Self::HighCompression),
            "720p" | "mobile" | "mobile_720p" => Some(Self::Mobile720p),
            "custom" => Some(Self::Custom),
            _ => None,
        }
    }
}

/// Generates a suggested compressed output path for an input video file.
pub fn suggest_output(input: &Path) -> PathBuf {
    let stem = input.file_stem().and_then(|s| s.to_str()).unwrap_or("video");
    let parent = input.parent().unwrap_or_else(|| Path::new("."));
    parent.join(format!("{stem}.compressed.mp4"))
}

/// User options for video compression.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoCompressOptions {
    pub input: PathBuf,
    pub output: PathBuf,
    #[serde(default)]
    pub codec: VideoCodec,
    #[serde(default)]
    pub preset: VideoPreset,
    pub crf: Option<u32>,
    pub target_mb: Option<f64>,
    #[serde(default)]
    pub resolution: VideoResolution,
    #[serde(default = "default_audio_bitrate")]
    pub audio_bitrate_kbps: u32,
}

fn default_audio_bitrate() -> u32 {
    128
}

/// Resulting compression statistics.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoCompressStats {
    pub input_bytes: u64,
    pub output_bytes: u64,
    pub duration_seconds: f64,
    pub savings_pct: f64,
    pub elapsed_ms: u64,
    pub output_path: String,
}

/// Locates the `ffmpeg` executable across standard paths.
pub fn find_ffmpeg() -> Option<PathBuf> {
    if let Ok(env_path) = std::env::var("FFMPEG_PATH") {
        let p = PathBuf::from(env_path);
        if p.exists() {
            return Some(p);
        }
    }

    if let Ok(exe) = std::env::current_exe() {
        let mut cur = exe.parent();
        while let Some(parent) = cur {
            let direct = parent.join("ffmpeg.exe");
            if direct.exists() {
                return Some(direct);
            }
            let res_bin = parent.join("resources").join("bin").join("ffmpeg.exe");
            if res_bin.exists() {
                return Some(res_bin);
            }
            let app_bin = parent.join("apps").join("desktop").join("bin").join("ffmpeg.exe");
            if app_bin.exists() {
                return Some(app_bin);
            }
            cur = parent.parent();
        }
    }

    if let Ok(cd) = std::env::current_dir() {
        let mut cur = Some(cd.as_path());
        while let Some(parent) = cur {
            let c1 = parent.join("apps/desktop/bin/ffmpeg.exe");
            if c1.exists() {
                return Some(c1);
            }
            let c2 = parent.join("target/debug/ffmpeg.exe");
            if c2.exists() {
                return Some(c2);
            }
            let c3 = parent.join("target/release/ffmpeg.exe");
            if c3.exists() {
                return Some(c3);
            }
            cur = parent.parent();
        }
    }

    if Command::new("ffmpeg")
        .arg("-version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .is_ok()
    {
        return Some(PathBuf::from("ffmpeg"));
    }

    None
}

/// Probes a video file using FFmpeg and extracts duration, codecs, dimensions.
pub fn probe(path: &Path) -> Result<VideoMetadata> {
    let ffmpeg = find_ffmpeg()
        .ok_or_else(|| Error::Other("ffmpeg executable not found".into()))?;

    let output = Command::new(&ffmpeg)
        .arg("-i")
        .arg(path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(Error::from_io)?;

    let stderr = String::from_utf8_lossy(&output.stderr);
    let size_bytes = std::fs::metadata(path).map(|m| m.len()).unwrap_or(0);
    let filename = path
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();

    let mut duration_seconds = 0.0;
    let mut bitrate_kbps = 0;
    let mut width = 0;
    let mut height = 0;
    let mut video_codec = String::from("unknown");
    let mut audio_codec = String::from("unknown");
    let mut fps = 0.0;

    for line in stderr.lines() {
        let trimmed = line.trim();

        // Duration: 00:01:23.45, start: 0.000000, bitrate: 1234 kb/s
        if trimmed.starts_with("Duration:") {
            if let Some(dur_str) = trimmed.strip_prefix("Duration:") {
                let parts: Vec<&str> = dur_str.split(',').collect();
                if let Some(time_part) = parts.first() {
                    let hms: Vec<&str> = time_part.trim().split(':').collect();
                    if hms.len() == 3 {
                        let h: f64 = hms[0].parse().unwrap_or(0.0);
                        let m: f64 = hms[1].parse().unwrap_or(0.0);
                        let s: f64 = hms[2].parse().unwrap_or(0.0);
                        duration_seconds = h * 3600.0 + m * 60.0 + s;
                    }
                }
                for p in &parts {
                    if let Some(br_str) = p.trim().strip_prefix("bitrate:") {
                        let num = br_str.trim().trim_end_matches("kb/s").trim();
                        bitrate_kbps = num.parse().unwrap_or(0);
                    }
                }
            }
        }

        // Stream #0:0: Video: h264 ..., 1920x1080 ..., 30 fps ...
        if trimmed.contains("Video:") {
            if let Some(idx) = trimmed.find("Video:") {
                let rest = &trimmed[idx + 6..];
                let tokens: Vec<&str> = rest.split(',').collect();
                if let Some(c) = tokens.first() {
                    video_codec = c.split_whitespace().next().unwrap_or("unknown").to_string();
                }
                for tok in &tokens {
                    let t = tok.trim();
                    // Dimensions WxH
                    if let Some(x_pos) = t.find('x') {
                        let before = &t[..x_pos].trim();
                        let after_token = &t[x_pos + 1..].trim();
                        let after = after_token.split_whitespace().next().unwrap_or("");
                        if let (Ok(w), Ok(h)) = (before.parse::<u32>(), after.parse::<u32>()) {
                            if w > 100 && h > 100 {
                                width = w;
                                height = h;
                            }
                        }
                    }
                    // FPS
                    if t.ends_with("fps") {
                        let num = t.trim_end_matches("fps").trim();
                        fps = num.parse().unwrap_or(0.0);
                    }
                }
            }
        }

        // Stream #0:1: Audio: aac ..., 48000 Hz, stereo ...
        if trimmed.contains("Audio:") {
            if let Some(idx) = trimmed.find("Audio:") {
                let rest = &trimmed[idx + 6..];
                let tokens: Vec<&str> = rest.split(',').collect();
                if let Some(c) = tokens.first() {
                    audio_codec = c.split_whitespace().next().unwrap_or("unknown").to_string();
                }
            }
        }
    }

    Ok(VideoMetadata {
        path: path.display().to_string(),
        filename,
        size_bytes,
        duration_seconds,
        width,
        height,
        video_codec,
        audio_codec,
        bitrate_kbps,
        fps,
    })
}

/// Compresses a video according to the provided options.
pub fn compress(
    opts: &VideoCompressOptions,
    progress: &dyn Progress,
) -> Result<VideoCompressStats> {
    let ffmpeg = find_ffmpeg()
        .ok_or_else(|| Error::Other("ffmpeg executable not found".into()))?;

    let meta = probe(&opts.input)?;
    let total_secs = meta.duration_seconds.max(1.0);
    let started = Instant::now();

    // Determine target codec, CRF, or target bitrate
    let mut codec = opts.codec;
    let mut crf = opts.crf;
    let mut target_mb = opts.target_mb;
    let mut resolution = opts.resolution;

    match opts.preset {
        VideoPreset::Discord25Mb => {
            target_mb = Some(24.0); // Safe budget under 25 MB
            codec = VideoCodec::H264;
            if meta.height > 1080 {
                resolution = VideoResolution::P1080;
            }
        }
        VideoPreset::Balanced => {
            codec = VideoCodec::H264;
            crf = crf.or(Some(28));
        }
        VideoPreset::HighCompression => {
            codec = VideoCodec::H265;
            crf = crf.or(Some(28));
        }
        VideoPreset::Mobile720p => {
            codec = VideoCodec::H264;
            crf = crf.or(Some(28));
            resolution = VideoResolution::P720;
        }
        VideoPreset::Custom => {}
    }

    let mut cmd = Command::new(&ffmpeg);
    cmd.arg("-y")
        .arg("-i")
        .arg(&opts.input);

    // Video codec
    cmd.arg("-c:v").arg(codec.ffmpeg_name());

    if codec == VideoCodec::H264 {
        cmd.arg("-pix_fmt").arg("yuv420p");
    } else if codec == VideoCodec::H265 {
        cmd.arg("-tag:v").arg("hvc1"); // macOS / Apple compatibility
    }

    // Rate control
    if let Some(target) = target_mb {
        let total_kbits = target * 8192.0;
        let total_kbps = (total_kbits / total_secs) as u32;
        let audio_kbps = opts.audio_bitrate_kbps.min(total_kbps / 4);
        let video_kbps = total_kbps.saturating_sub(audio_kbps).max(100);

        cmd.arg("-b:v").arg(format!("{video_kbps}k"));
        cmd.arg("-maxrate").arg(format!("{}k", (video_kbps as f64 * 1.5) as u32));
        cmd.arg("-bufsize").arg(format!("{}k", video_kbps * 2));
    } else {
        let c = crf.unwrap_or(28);
        cmd.arg("-crf").arg(c.to_string());
    }

    // Resolution downscaling filter
    if let Some(max_h) = resolution.target_height() {
        if meta.height > max_h {
            cmd.arg("-vf").arg(format!("scale=-2:{max_h}"));
        }
    }

    // Audio
    cmd.arg("-c:a")
        .arg("aac")
        .arg("-b:a")
        .arg(format!("{}k", opts.audio_bitrate_kbps));

    // Preset speed
    cmd.arg("-preset").arg("fast");

    // Output path
    cmd.arg(&opts.output);

    cmd.stdout(Stdio::null());
    cmd.stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(Error::from_io)?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| Error::Other("failed to capture ffmpeg stderr".into()))?;

    let reader = BufReader::new(stderr);
    for l in reader.lines().map_while(|line| line.ok()) {
        // Parse time=HH:MM:SS.ms
        if let Some(idx) = l.find("time=") {
            let rest = &l[idx + 5..];
            let time_tok = rest.split_whitespace().next().unwrap_or("");
            let hms: Vec<&str> = time_tok.split(':').collect();
            if hms.len() == 3 {
                let h: f64 = hms[0].parse().unwrap_or(0.0);
                let m: f64 = hms[1].parse().unwrap_or(0.0);
                let s: f64 = hms[2].parse().unwrap_or(0.0);
                let cur_secs = h * 3600.0 + m * 60.0 + s;
                let pct = (cur_secs / total_secs).min(1.0);
                let done_bytes = (pct * meta.size_bytes as f64) as u64;
                progress.update(
                    done_bytes,
                    meta.size_bytes,
                    &format!("Encoding {:.1}% ({:.0}s)", pct * 100.0, cur_secs),
                );
            }
        }
    }

    let status = child.wait().map_err(Error::from_io)?;
    if !status.success() {
        return Err(Error::Other(format!("FFmpeg failed with exit code: {:?}", status.code())));
    }

    let output_bytes = std::fs::metadata(&opts.output)
        .map(|m| m.len())
        .unwrap_or(0);
    let input_bytes = meta.size_bytes;
    let savings_pct = if input_bytes > 0 && output_bytes < input_bytes {
        ((input_bytes - output_bytes) as f64 / input_bytes as f64) * 100.0
    } else {
        0.0
    };

    Ok(VideoCompressStats {
        input_bytes,
        output_bytes,
        duration_seconds: total_secs,
        savings_pct,
        elapsed_ms: started.elapsed().as_millis() as u64,
        output_path: opts.output.display().to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_ffmpeg_if_installed() {
        let p = find_ffmpeg();
        assert!(p.is_some(), "ffmpeg should be found via dev/bundled paths");
    }
}
