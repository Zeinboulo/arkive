//! Compression benchmark engine.
//!
//! Measures compression ratio and compress/decompress throughput for every
//! codec × level combination on either a user-supplied path or a synthetic,
//! seeded dataset (CSV, JSON logs, text, random, mixed). Results can be
//! exported as CSV/JSON and include a Pareto-frontier flag (best ratio for a
//! given speed), which is what you'd use to choose a codec for a data lake.

use crate::codec::Codec;
use crate::progress::Progress;
use crate::util::effective_threads;
use crate::{Error, Result};
use rand::rngs::StdRng;
use rand::{Rng, RngCore, SeedableRng};
use serde::{Deserialize, Serialize};
use std::fmt::Write as _;
use std::path::PathBuf;
use std::time::Instant;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "kebab-case")]
pub enum Dataset {
    #[default]
    Csv,
    JsonLogs,
    Text,
    Random,
    Mixed,
}

impl Dataset {
    pub fn parse(s: &str) -> Option<Dataset> {
        match s.to_lowercase().as_str() {
            "csv" => Some(Dataset::Csv),
            "json" | "json-logs" | "logs" => Some(Dataset::JsonLogs),
            "text" => Some(Dataset::Text),
            "random" | "binary" => Some(Dataset::Random),
            "mixed" => Some(Dataset::Mixed),
            _ => None,
        }
    }
    pub fn label(self) -> &'static str {
        match self {
            Dataset::Csv => "Synthetic CSV (events table)",
            Dataset::JsonLogs => "Synthetic JSON logs",
            Dataset::Text => "Natural-language text",
            Dataset::Random => "Random bytes (incompressible)",
            Dataset::Mixed => "Mixed workload",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BenchConfig {
    /// Benchmark real files (a file or a folder). Overrides `dataset`.
    pub input: Option<PathBuf>,
    pub dataset: Dataset,
    /// Size of synthetic data, or cap for real input, in MiB.
    pub size_mb: usize,
    pub codecs: Vec<Codec>,
    /// Unified levels (1..=9).
    pub levels: Vec<u32>,
    /// 0 = all logical CPUs. Applies to multi-threaded codecs.
    pub threads: usize,
    /// Repetitions per combination; the best time is kept.
    pub iterations: u32,
}

impl Default for BenchConfig {
    fn default() -> Self {
        Self {
            input: None,
            dataset: Dataset::Csv,
            size_mb: 32,
            codecs: Codec::ALL.to_vec(),
            levels: vec![1, 3, 6, 9],
            threads: 0,
            iterations: 1,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BenchResult {
    pub codec: Codec,
    pub codec_label: String,
    pub level: u32,
    pub native_level: i32,
    pub threads: usize,
    pub input_bytes: u64,
    pub output_bytes: u64,
    /// input / output (higher is better).
    pub ratio: f64,
    pub saving_pct: f64,
    pub compress_ms: f64,
    pub decompress_ms: f64,
    pub compress_mb_s: f64,
    pub decompress_mb_s: f64,
    /// Not dominated by any other result on (ratio, compress speed).
    pub pareto: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BenchReport {
    pub dataset: String,
    pub input_bytes: u64,
    pub cpu_threads: usize,
    pub results: Vec<BenchResult>,
    pub elapsed_ms: u64,
}

/// Generates a deterministic synthetic dataset of roughly `bytes` bytes.
pub fn generate(dataset: Dataset, bytes: usize) -> Vec<u8> {
    let mut rng = StdRng::seed_from_u64(0xA2C1_17E5);
    let mut out = String::with_capacity(bytes + 256);
    match dataset {
        Dataset::Csv => {
            const COUNTRIES: [&str; 8] = ["US", "DE", "FR", "EG", "JP", "BR", "IN", "GB"];
            const EVENTS: [&str; 5] = ["page_view", "click", "add_to_cart", "purchase", "signup"];
            const STATUS: [&str; 3] = ["ok", "ok", "failed"];
            out.push_str("event_id,timestamp,user_id,country,event,amount,status\n");
            let mut id = 1_000_000u64;
            let mut ts = 1_767_225_600u64;
            while out.len() < bytes {
                id += 1;
                ts += rng.gen_range(0..5);
                let _ = writeln!(
                    out,
                    "{id},{ts},{},{},{},{:.2},{}",
                    rng.gen_range(1..50_000),
                    COUNTRIES[rng.gen_range(0..COUNTRIES.len())],
                    EVENTS[rng.gen_range(0..EVENTS.len())],
                    rng.gen_range(0.0..500.0f64),
                    STATUS[rng.gen_range(0..STATUS.len())],
                );
            }
        }
        Dataset::JsonLogs => {
            const LEVELS: [&str; 4] = ["INFO", "INFO", "WARN", "ERROR"];
            const SERVICES: [&str; 4] = ["api-gateway", "orders", "payments", "ingest-worker"];
            const MSGS: [&str; 5] = [
                "request completed",
                "cache miss, falling back to warehouse",
                "batch flushed to object storage",
                "retrying upstream call",
                "schema validation failed for record",
            ];
            let mut ts = 1_767_225_600_000u64;
            while out.len() < bytes {
                ts += rng.gen_range(1..250);
                let _ = writeln!(
                    out,
                    r#"{{"ts":{ts},"level":"{}","service":"{}","msg":"{}","latency_ms":{},"trace_id":"{:016x}","user":"u{}"}}"#,
                    LEVELS[rng.gen_range(0..LEVELS.len())],
                    SERVICES[rng.gen_range(0..SERVICES.len())],
                    MSGS[rng.gen_range(0..MSGS.len())],
                    rng.gen_range(1..2_000),
                    rng.gen::<u64>(),
                    rng.gen_range(1..100_000),
                );
            }
        }
        Dataset::Text => {
            const WORDS: [&str; 40] = [
                "the",
                "data",
                "pipeline",
                "of",
                "and",
                "to",
                "a",
                "stream",
                "in",
                "is",
                "batch",
                "for",
                "that",
                "with",
                "on",
                "compression",
                "storage",
                "query",
                "as",
                "table",
                "partition",
                "by",
                "file",
                "schema",
                "be",
                "this",
                "are",
                "from",
                "lake",
                "or",
                "warehouse",
                "record",
                "an",
                "it",
                "column",
                "row",
                "format",
                "at",
                "which",
                "we",
            ];
            while out.len() < bytes {
                let n = rng.gen_range(6..20);
                for i in 0..n {
                    // Zipf-ish: favour the first words.
                    let idx = (rng.gen::<f64>().powi(2) * WORDS.len() as f64) as usize;
                    if i > 0 {
                        out.push(' ');
                    }
                    out.push_str(WORDS[idx.min(WORDS.len() - 1)]);
                }
                out.push_str(".\n");
            }
        }
        Dataset::Random => {
            let mut v = vec![0u8; bytes];
            rng.fill_bytes(&mut v);
            return v;
        }
        Dataset::Mixed => {
            let q = bytes / 4;
            let mut v = generate(Dataset::Csv, q);
            v.extend(generate(Dataset::JsonLogs, q));
            v.extend(generate(Dataset::Text, q));
            v.extend(generate(Dataset::Random, q));
            return v;
        }
    }
    let mut v = out.into_bytes();
    v.truncate(bytes);
    v
}

/// Reads real input (file or folder) up to `cap` bytes.
fn load_input(path: &std::path::Path, cap: usize) -> Result<Vec<u8>> {
    use std::io::Read;
    let mut data = Vec::new();
    for entry in walkdir::WalkDir::new(path).sort_by_file_name() {
        let entry = entry?;
        if !entry.file_type().is_file() {
            continue;
        }
        let remaining = cap.saturating_sub(data.len());
        if remaining == 0 {
            break;
        }
        std::fs::File::open(entry.path())?
            .take(remaining as u64)
            .read_to_end(&mut data)?;
    }
    if data.is_empty() {
        return Err(Error::Other("benchmark input contains no data".into()));
    }
    Ok(data)
}

pub fn run(cfg: &BenchConfig, progress: &dyn Progress) -> Result<BenchReport> {
    let started = Instant::now();
    let cap = cfg.size_mb.clamp(1, 4096) * 1024 * 1024;
    let (label, data) = match &cfg.input {
        Some(p) => (format!("Files: {}", p.display()), load_input(p, cap)?),
        None => (cfg.dataset.label().to_string(), generate(cfg.dataset, cap)),
    };
    let threads = effective_threads(cfg.threads);

    // Build the run matrix (codecs without levels run once).
    let mut levels = cfg.levels.clone();
    levels.sort_unstable();
    levels.dedup();
    if levels.is_empty() {
        levels.push(6);
    }
    let mut runs: Vec<(Codec, u32)> = Vec::new();
    for &c in &cfg.codecs {
        if c.has_levels() {
            runs.extend(levels.iter().map(|&l| (c, l)));
        } else {
            runs.push((c, 1));
        }
    }

    let mut results = Vec::with_capacity(runs.len());
    let iterations = cfg.iterations.max(1);
    for (i, &(codec, level)) in runs.iter().enumerate() {
        if progress.is_cancelled() {
            return Err(Error::Cancelled);
        }
        let label_now = format!("{} L{}", codec.label(), level);
        progress.update(i as u64, runs.len() as u64, &label_now);

        let t = if codec.is_multithreaded() { threads } else { 1 };
        let mut best_c = f64::MAX;
        let mut best_d = f64::MAX;
        let mut compressed = Vec::new();
        for _ in 0..iterations {
            let s = Instant::now();
            compressed = codec.compress(&data, level, t)?;
            best_c = best_c.min(s.elapsed().as_secs_f64());

            let s = Instant::now();
            let back = codec.decompress(&compressed, data.len())?;
            best_d = best_d.min(s.elapsed().as_secs_f64());
            if back != data {
                return Err(Error::Corrupt(format!("{label_now}: roundtrip mismatch")));
            }
        }
        let mb = data.len() as f64 / 1_048_576.0;
        results.push(BenchResult {
            codec,
            codec_label: codec.label().into(),
            level,
            native_level: codec.native_level(level),
            threads: t,
            input_bytes: data.len() as u64,
            output_bytes: compressed.len() as u64,
            ratio: data.len() as f64 / compressed.len().max(1) as f64,
            saving_pct: 100.0 * (1.0 - compressed.len() as f64 / data.len() as f64),
            compress_ms: best_c * 1000.0,
            decompress_ms: best_d * 1000.0,
            compress_mb_s: mb / best_c.max(1e-9),
            decompress_mb_s: mb / best_d.max(1e-9),
            pareto: false,
        });
    }
    mark_pareto(&mut results);
    progress.update(runs.len() as u64, runs.len() as u64, "done");

    Ok(BenchReport {
        dataset: label,
        input_bytes: data.len() as u64,
        cpu_threads: threads,
        results,
        elapsed_ms: started.elapsed().as_millis() as u64,
    })
}

/// Flags results that are not dominated on (higher ratio, higher compress speed).
pub fn mark_pareto(results: &mut [BenchResult]) {
    let snapshot: Vec<(f64, f64)> = results.iter().map(|r| (r.ratio, r.compress_mb_s)).collect();
    for (i, r) in results.iter_mut().enumerate() {
        let (ri, si) = snapshot[i];
        r.pareto = !snapshot
            .iter()
            .enumerate()
            .any(|(j, &(rj, sj))| j != i && rj >= ri && sj >= si && (rj > ri || sj > si));
    }
}

/// Serializes results as CSV (one row per codec/level).
pub fn to_csv(results: &[BenchResult]) -> String {
    let mut s = String::from(
        "codec,level,native_level,threads,input_bytes,output_bytes,ratio,saving_pct,compress_ms,decompress_ms,compress_mb_s,decompress_mb_s,pareto\n",
    );
    for r in results {
        let _ = writeln!(
            s,
            "{:?},{},{},{},{},{},{:.4},{:.2},{:.2},{:.2},{:.2},{:.2},{}",
            r.codec,
            r.level,
            r.native_level,
            r.threads,
            r.input_bytes,
            r.output_bytes,
            r.ratio,
            r.saving_pct,
            r.compress_ms,
            r.decompress_ms,
            r.compress_mb_s,
            r.decompress_mb_s,
            r.pareto
        );
    }
    s
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::NoProgress;

    #[test]
    fn small_benchmark_runs() {
        let cfg = BenchConfig {
            size_mb: 1,
            levels: vec![1, 6],
            ..Default::default()
        };
        let report = run(&cfg, &NoProgress).unwrap();
        assert_eq!(report.results.len(), 4 * 2 + 1);
        assert!(report.results.iter().any(|r| r.pareto));
        assert!(report.results.iter().all(|r| r.ratio > 1.0));
        assert!(to_csv(&report.results).lines().count() == report.results.len() + 1);
    }

    #[test]
    fn datasets_are_deterministic() {
        assert_eq!(
            generate(Dataset::JsonLogs, 10_000),
            generate(Dataset::JsonLogs, 10_000)
        );
        assert_eq!(generate(Dataset::Mixed, 40_000).len(), 40_000);
    }
}
