use anyhow::{Context, Result};
use arkive_core::bench::{self, BenchConfig, Dataset};
use arkive_core::codec::Codec;
use arkive_core::{
    create, extract, info, list, repair, test, CreateOptions,
    ExtractOptions, Format, Progress, ZipMethod,
};
use clap::{Args, Parser, Subcommand};
use colored::Colorize;
use indicatif::{ProgressBar, ProgressStyle};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tabled::settings::Style;
use tabled::{Table, Tabled};

#[derive(Parser, Debug)]
#[command(name = "arkive")]
#[command(author = "Arkive Contributors")]
#[command(version = "0.1.0")]
#[command(about = "High-performance archive manager & compression engine", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand, Debug)]
enum Commands {
    #[command(name = "a", alias = "add", about = "Create a new archive or add files")]
    Add(AddArgs),

    #[command(name = "x", alias = "extract", about = "Extract files from archive")]
    Extract(ExtractArgs),

    #[command(name = "l", alias = "list", about = "List contents of archive")]
    List(ListArgs),

    #[command(name = "t", alias = "test", about = "Test integrity of archive")]
    Test(TestArgs),

    #[command(name = "i", alias = "info", about = "Display detailed archive metadata")]
    Info(InfoArgs),

    #[command(name = "repair", about = "Attempt to repair a corrupted ZIP archive")]
    Repair(RepairArgs),

    #[command(name = "bench", about = "Run compression algorithm benchmarks")]
    Bench(BenchArgs),
}

#[derive(Args, Debug)]
struct AddArgs {
    /// Destination archive file path
    archive: PathBuf,

    /// Files or directories to archive
    #[arg(required = true)]
    inputs: Vec<PathBuf>,

    /// Archive format (zip, 7z, tar, tar.gz, tar.bz2, tar.xz, tar.zst)
    #[arg(short, long)]
    format: Option<String>,

    /// Compression level: 0 (store) to 9 (ultra)
    #[arg(short, long, default_value_t = 6)]
    level: u32,

    /// Password for encryption (AES-256)
    #[arg(short, long)]
    password: Option<String>,

    /// Worker threads (0 = all CPU cores)
    #[arg(short, long, default_value_t = 0)]
    threads: usize,

    /// ZIP compression method (store, deflate, bzip2, zstd)
    #[arg(short, long)]
    method: Option<String>,
}

#[derive(Args, Debug)]
struct ExtractArgs {
    /// Archive file to extract
    archive: PathBuf,

    /// Destination directory (defaults to current dir or archive folder)
    #[arg(short, long)]
    output: Option<PathBuf>,

    /// Password for encrypted archive
    #[arg(short, long)]
    password: Option<String>,

    /// Overwrite existing files without asking
    #[arg(short, long)]
    force: bool,

    /// Specific files or folders to extract (optional)
    selection: Vec<String>,
}

#[derive(Args, Debug)]
struct ListArgs {
    /// Archive file to list
    archive: PathBuf,

    /// Password for encrypted archive
    #[arg(short, long)]
    password: Option<String>,

    /// Output as JSON
    #[arg(long)]
    json: bool,
}

#[derive(Args, Debug)]
struct TestArgs {
    /// Archive file to test
    archive: PathBuf,

    /// Password for encrypted archive
    #[arg(short, long)]
    password: Option<String>,
}

#[derive(Args, Debug)]
struct InfoArgs {
    /// Archive file path
    archive: PathBuf,

    /// Password for encrypted archive
    #[arg(short, long)]
    password: Option<String>,

    /// Output as JSON
    #[arg(long)]
    json: bool,
}

#[derive(Args, Debug)]
struct RepairArgs {
    /// Corrupted ZIP archive to repair
    archive: PathBuf,

    /// Output repaired archive path (defaults to <archive>.repaired.zip)
    #[arg(short, long)]
    output: Option<PathBuf>,
}

#[derive(Args, Debug)]
struct BenchArgs {
    /// Input file or folder to test against (optional, uses synthetic data if omitted)
    #[arg(short, long)]
    input: Option<PathBuf>,

    /// Synthetic dataset type: csv, json, text, random, mixed
    #[arg(short, long, default_value = "csv")]
    dataset: String,

    /// Dataset size in MiB
    #[arg(short, long, default_value_t = 32)]
    size: usize,

    /// Compression codecs to test (comma-separated, e.g. deflate,zstd,lz4)
    #[arg(short, long)]
    codecs: Option<String>,

    /// Compression levels to test (comma-separated, e.g. 1,3,6,9)
    #[arg(short, long)]
    levels: Option<String>,

    /// Threads to use (0 = all CPU cores)
    #[arg(short, long, default_value_t = 0)]
    threads: usize,

    /// Export benchmark results to CSV file
    #[arg(long)]
    csv: Option<PathBuf>,

    /// Output results as JSON
    #[arg(long)]
    json: bool,
}

struct CliProgress {
    pb: ProgressBar,
    cancelled: Arc<AtomicBool>,
}

impl CliProgress {
    fn new(msg: &str) -> Self {
        let pb = ProgressBar::new(100);
        pb.set_style(
            ProgressStyle::default_bar()
                .template("{spinner:.green} [{elapsed_precise}] [{bar:40.cyan/blue}] {bytes}/{total_bytes} ({eta}) {msg}")
                .unwrap()
                .progress_chars("#>-"),
        );
        pb.set_message(msg.to_string());
        Self {
            pb,
            cancelled: Arc::new(AtomicBool::new(false)),
        }
    }
}

impl Progress for CliProgress {
    fn update(&self, done: u64, total: u64, current: &str) {
        if total > 0 {
            self.pb.set_length(total);
            self.pb.set_position(done);
        }
        if !current.is_empty() {
            self.pb.set_message(current.to_string());
        }
    }

    fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::Relaxed)
    }
}

#[derive(Tabled)]
struct EntryRow {
    #[tabled(rename = "Path")]
    path: String,
    #[tabled(rename = "Size")]
    size: String,
    #[tabled(rename = "Packed")]
    packed: String,
    #[tabled(rename = "Modified")]
    modified: String,
    #[tabled(rename = "Encrypted")]
    encrypted: String,
}

fn format_bytes(bytes: u64) -> String {
    if bytes < 1024 {
        format!("{bytes} B")
    } else if bytes < 1024 * 1024 {
        format!("{:.1} KB", bytes as f64 / 1024.0)
    } else if bytes < 1024 * 1024 * 1024 {
        format!("{:.2} MB", bytes as f64 / (1024.0 * 1024.0))
    } else {
        format!("{:.2} GB", bytes as f64 / (1024.0 * 1024.0 * 1024.0))
    }
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Add(args) => handle_add(args),
        Commands::Extract(args) => handle_extract(args),
        Commands::List(args) => handle_list(args),
        Commands::Test(args) => handle_test(args),
        Commands::Info(args) => handle_info(args),
        Commands::Repair(args) => handle_repair(args),
        Commands::Bench(args) => handle_bench(args),
    }
}

fn handle_add(args: AddArgs) -> Result<()> {
    let format = match args.format {
        Some(f) => Format::parse(&f).context(format!("Unsupported format: {f}"))?,
        None => Format::detect(&args.archive)
            .or_else(|| Format::from_path(&args.archive))
            .unwrap_or(Format::Zip),
    };

    let zip_method = match args.method {
        Some(m) => ZipMethod::parse(&m).context(format!("Unknown ZIP method: {m}"))?,
        None => ZipMethod::Deflate,
    };

    let opts = CreateOptions {
        format,
        level: args.level,
        password: args.password,
        threads: args.threads,
        zip_method,
        encrypt_headers: true,
    };

    println!(
        "{} Creating {} archive: {}",
        "==>".bold().green(),
        format.label().bold(),
        args.archive.display()
    );

    let progress = CliProgress::new("Archiving...");
    let stats = create(&args.archive, &args.inputs, &opts, &progress)?;
    progress.pb.finish_and_clear();

    println!(
        "{} Successfully created archive in {:.2}s ({:.1} MB/s)",
        "✓".bold().green(),
        stats.elapsed_ms as f64 / 1000.0,
        stats.throughput_mb_s
    );
    println!(
        "   Files: {} | Dirs: {} | Total size: {} -> Archive: {}",
        stats.files,
        stats.dirs,
        format_bytes(stats.bytes),
        format_bytes(stats.archive_bytes)
    );

    Ok(())
}

fn handle_extract(args: ExtractArgs) -> Result<()> {
    let dest = args
        .output
        .unwrap_or_else(|| arkive_core::suggest_extract_dir(&args.archive));

    let opts = ExtractOptions {
        password: args.password,
        overwrite: args.force,
        selection: args.selection,
    };

    println!(
        "{} Extracting {} to {}",
        "==>".bold().green(),
        args.archive.display(),
        dest.display()
    );

    let progress = CliProgress::new("Extracting...");
    let stats = extract(&args.archive, &dest, &opts, &progress)?;
    progress.pb.finish_and_clear();

    println!(
        "{} Successfully extracted {} files, {} dirs in {:.2}s ({:.1} MB/s)",
        "✓".bold().green(),
        stats.files,
        stats.dirs,
        stats.elapsed_ms as f64 / 1000.0,
        stats.throughput_mb_s
    );
    if stats.skipped > 0 {
        println!("   Skipped: {} existing items", stats.skipped);
    }

    Ok(())
}

fn handle_list(args: ListArgs) -> Result<()> {
    let entries = list(&args.archive, args.password.as_deref())?;

    if args.json {
        println!("{}", serde_json::to_string_pretty(&entries)?);
        return Ok(());
    }

    let rows: Vec<EntryRow> = entries
        .iter()
        .map(|e| EntryRow {
            path: if e.is_dir {
                format!("{}/", e.path.blue())
            } else {
                e.path.clone()
            },
            size: if e.is_dir {
                "-".into()
            } else {
                format_bytes(e.size)
            },
            packed: e.compressed_size.map(format_bytes).unwrap_or_else(|| "-".into()),
            modified: e.modified.clone().unwrap_or_else(|| "-".into()),
            encrypted: if e.encrypted { "Yes".red().to_string() } else { "No".into() },
        })
        .collect();

    let mut table = Table::new(rows);
    table.with(Style::rounded());
    println!("{table}");
    println!("Total entries: {}", entries.len());

    Ok(())
}

fn handle_test(args: TestArgs) -> Result<()> {
    println!("{} Testing archive integrity: {}", "==>".bold().green(), args.archive.display());

    let progress = CliProgress::new("Verifying...");
    let report = test(&args.archive, args.password.as_deref(), &progress)?;
    progress.pb.finish_and_clear();

    if report.ok {
        println!(
            "{} All {} entries verified successfully in {:.2}s",
            "✓".bold().green(),
            report.tested,
            report.elapsed_ms as f64 / 1000.0
        );
    } else {
        println!(
            "{} Test failed with {} corrupt entries:",
            "✗".bold().red(),
            report.failures.len()
        );
        for fail in &report.failures {
            println!("   - {}: {}", fail.path.red(), fail.error);
        }
    }

    Ok(())
}

fn handle_info(args: InfoArgs) -> Result<()> {
    let archive_info = info(&args.archive, args.password.as_deref())?;

    if args.json {
        println!("{}", serde_json::to_string_pretty(&archive_info)?);
        return Ok(());
    }

    println!("{}", "Archive Information:".bold());
    println!("  Path:         {}", archive_info.path);
    println!("  Format:       {}", archive_info.format_label.green().bold());
    println!("  Archive Size: {}", format_bytes(archive_info.archive_size));
    println!("  Files / Dirs: {} / {}", archive_info.files, archive_info.dirs);
    println!("  Total Size:   {}", format_bytes(archive_info.total_size));
    if let Some(packed) = archive_info.packed_size {
        println!("  Packed Size:  {}", format_bytes(packed));
    }
    println!("  Ratio:        {:.1}%", archive_info.ratio * 100.0);
    println!("  Encrypted:    {}", if archive_info.encrypted { "Yes".red() } else { "No".normal() });

    Ok(())
}

fn handle_repair(args: RepairArgs) -> Result<()> {
    let out = args
        .output
        .unwrap_or_else(|| repair::suggest_output(&args.archive));

    println!(
        "{} Scanning damaged ZIP and rebuilding central directory...",
        "==>".bold().yellow()
    );

    let report = repair::repair_zip(&args.archive, &out)?;

    println!(
        "{} Recovered {} of {} entries into {}",
        "✓".bold().green(),
        report.recovered,
        report.found,
        out.display().to_string().cyan()
    );
    println!(
        "   Verified: {} | Unverifiable (encrypted/raw): {} | Dropped: {}",
        report.verified,
        report.unverifiable,
        report.dropped.len()
    );

    Ok(())
}

#[derive(Tabled)]
struct BenchRow {
    #[tabled(rename = "Codec")]
    codec: String,
    #[tabled(rename = "Level")]
    level: u32,
    #[tabled(rename = "Ratio")]
    ratio: String,
    #[tabled(rename = "Savings")]
    savings: String,
    #[tabled(rename = "Comp MB/s")]
    comp_speed: String,
    #[tabled(rename = "Decomp MB/s")]
    decomp_speed: String,
    #[tabled(rename = "Pareto")]
    pareto: String,
}

fn handle_bench(args: BenchArgs) -> Result<()> {
    let dataset = Dataset::parse(&args.dataset).unwrap_or(Dataset::Csv);

    let codecs = match args.codecs {
        Some(s) => s
            .split(',')
            .filter_map(|x| Codec::parse(x.trim()))
            .collect(),
        None => Codec::ALL.to_vec(),
    };

    let levels = match args.levels {
        Some(s) => s
            .split(',')
            .filter_map(|x| x.trim().parse::<u32>().ok())
            .collect(),
        None => vec![1, 3, 6, 9],
    };

    let cfg = BenchConfig {
        input: args.input,
        dataset,
        size_mb: args.size,
        codecs,
        levels,
        threads: args.threads,
        iterations: 1,
    };

    eprintln!(
        "{} Running compression benchmark ({} MiB dataset)...",
        "==>".bold().green(),
        cfg.size_mb
    );

    let pb = ProgressBar::new(100);
    pb.set_style(
        ProgressStyle::default_bar()
            .template("{spinner:.green} [{elapsed_precise}] {msg}")
            .unwrap(),
    );

    struct BenchProgress(ProgressBar);
    impl Progress for BenchProgress {
        fn update(&self, done: u64, total: u64, current: &str) {
            self.0.set_message(format!("[{done}/{total}] {current}"));
        }
    }

    let report = bench::run(&cfg, &BenchProgress(pb.clone()))?;
    pb.finish_and_clear();

    if args.json {
        println!("{}", serde_json::to_string_pretty(&report)?);
        return Ok(());
    }

    let rows: Vec<BenchRow> = report
        .results
        .iter()
        .map(|r| BenchRow {
            codec: r.codec_label.clone(),
            level: r.level,
            ratio: format!("{:.2}x", r.ratio),
            savings: format!("{:.1}%", r.saving_pct),
            comp_speed: format!("{:.1}", r.compress_mb_s),
            decomp_speed: format!("{:.1}", r.decompress_mb_s),
            pareto: if r.pareto { "★ Best".yellow().bold().to_string() } else { "".into() },
        })
        .collect();

    let mut table = Table::new(rows);
    table.with(Style::rounded());
    println!("{table}");

    if let Some(csv_path) = args.csv {
        let csv_data = bench::to_csv(&report.results);
        std::fs::write(&csv_path, csv_data)?;
        println!("{} Benchmark exported to {}", "✓".bold().green(), csv_path.display());
    }

    Ok(())
}
