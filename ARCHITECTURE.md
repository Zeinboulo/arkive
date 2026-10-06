# Arkive Architecture & Engineering Guide 🗜️

This document details the architectural design, concurrency models, data structures, and algorithms powering **Arkive**. It is written for engineers, recruiters, and contributors seeking to understand how Arkive was conceived, structured, and implemented.

---

## 1. High-Level System Architecture

Arkive bridges a modern, high-performance **Rust systems core** with a responsive **Electron + React desktop application** and a scriptable **CLI**.

```mermaid
flowchart TD
    subgraph UI ["Desktop UI Layer (React 18 + Tailwind CSS + Lucide)"]
        UI_Browser["Dual-Mode Browser (PC Explorer & Archive View)"]
        UI_Modals["Operation Modals (Create, Extract, Repair, Info)"]
        UI_Bench["Benchmark & Pareto Frontier Dashboard"]
        UI_DnD["Drag & Drop File & Folder Dispatcher"]
    end

    subgraph Host ["Host Platform Layer (Electron Main Process)"]
        Host_IPC["Secure IPC Gateway (contextBridge)"]
        Host_Shell["Windows Explorer Context Menu Manager (HKCU Shell)"]
        Host_FS["Filesystem Explorer & Quick Places Provider"]
        Host_Lock["Single-Instance Process Coordinator"]
    end

    subgraph Engine ["Rust Systems Core Engine (arkive-cli & arkive-core)"]
        CLI["CLI Subcommands (a, x, l, t, cat, bench, repair)"]
        Core_Con["Parallel Concurrency Engine (Rayon ThreadPool)"]
        Core_Repair["ZIP Central Directory Reconstructor"]
        Core_Pareto["2D Pareto-Optimal Frontier Analyzer"]
        Core_Crypto["AES-256 WinZip AE-2 & 7-Zip Encryption"]
    end

    subgraph Codecs ["Format Backends & Codecs"]
        FMT_Zip["ZIP (Deflate / Zstandard / Bzip2 / Store)"]
        FMT_7z["7-Zip (LZMA2 / AES-256)"]
        FMT_Tar["TAR Suite (Gz / Bz2 / Xz / Zst)"]
        FMT_Rar["RAR Parser (Unrar Extraction)"]
    end

    UI --> Host_IPC
    Host_IPC --> Host
    Host --> Host_Lock
    Host --> Host_Shell
    Host --> Host_FS
    Host --> CLI
    CLI --> Core_Con
    CLI --> Core_Repair
    CLI --> Core_Pareto
    CLI --> Core_Crypto
    Core_Con --> Codecs
```

---

## 2. Concurrency & Concurrency Models

### Parallel In-Memory Rayon Chunking Architecture
Standard single-threaded ZIP compressors process files sequentially, creating major CPU bottlenecks on multi-core workstations. Arkive implements a **batch-oriented in-memory Rayon worker pool**:

```mermaid
flowchart LR
    Inputs["Input Files & Folders"] --> Collector["Recursive Scanner (inputs::collect)"]
    Collector --> Sizer{"File Size > 64 MB?"}
    
    Sizer -- Yes (Large File) --> SeqStream["Direct Buffered Stream + Flush"]
    Sizer -- No (Small/Medium File) --> BatchBuffer["Parallel Batch Queue (Max 64 MB)"]
    
    BatchBuffer --> RayonPool["Rayon Parallel Worker Pool"]
    RayonPool --> Worker1["Worker Thread 1 (In-Memory Compression)"]
    RayonPool --> Worker2["Worker Thread 2 (In-Memory Compression)"]
    RayonPool --> WorkerN["Worker Thread N (In-Memory Compression)"]
    
    Worker1 --> ZeroCopy["Zero-Recompression Raw Byte Assembly"]
    Worker2 --> ZeroCopy
    WorkerN --> ZeroCopy
    
    SeqStream --> Output["Final Archive Container (Atomic Rename)"]
    ZeroCopy --> Output
```

1. **Traversal & Sanitization (`inputs::collect`):** Recursively walks directories, normalizes relative paths, sanitizes path traversal sequences (Zip-Slip protection), and collects file metadata.
2. **Batch Queueing:** Files smaller than `64 MB` are gathered into batches totaling up to `64 MB`.
3. **Parallel In-Memory Compression:** Each thread in the Rayon pool compresses an individual file into a standalone in-memory ZIP buffer.
4. **Zero-Copy Atomic Stitching:** The master thread consumes completed in-memory archives and performs raw-copy byte transfers (`raw_copy_file`) directly into the final container without re-compressing or decoding.
5. **Atomic Rename Guarantee:** Writes occur to `.arkive-tmp` files and atomically replace the destination path only on complete success.

---

## 3. Dual-Mode Desktop Interaction & Windows Shell Integration

Arkive mirrors WinRAR's signature dual-mode file management while integrating with the Windows Explorer shell.

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Windows Explorer
    participant Shell as Windows Context Menu (Registry)
    participant Electron as Arkive Desktop Process
    participant UI as React UI Component
    participant Rust as Rust Engine (arkive-cli)

    User->>Shell: Right-click Folder or File
    Shell->>Electron: Launch Arkive.exe --create "C:\Data"
    alt Single Instance Check
        Electron->>Electron: Detect active instance via requestSingleInstanceLock
        Electron->>UI: Emit IPC app:externalAction {action: "create", path: "C:\Data"}
    end
    UI->>UI: Open Create Archive Modal with pre-selected folder
    User->>UI: Choose Format (ZIP / Zstd / 7z) & Click Compress
    UI->>Electron: Invoke arkive:create
    Electron->>Rust: Execute arkive a "C:\Data.zip" "C:\Data"
    Rust-->>Electron: Stream progress & return OperationStats
    Electron-->>UI: Operation Complete (Show statistics)
    UI->>UI: Auto-load new archive into Archive View
```

---

## 4. ZIP Central Directory Recovery Engine

When network transfers, object storage uploads (e.g. S3 / GCS), or disk failures truncate a ZIP archive, the **Central Directory (`PK\x01\x02`)** and **End of Central Directory (`PK\x05\x06`)** records at the tail of the file are often severed. Standard tools report "Unexpected end of archive".

Arkive implements a byte-level reverse reconstruction engine:

```mermaid
flowchart TD
    DamagedZip["Damaged / Truncated ZIP Archive"] --> ByteScanner["Backward Local File Header Scanner (PK\x03\x04)"]
    ByteScanner --> ValidateHeader{"Valid Local Header Signature?"}
    
    ValidateHeader -- Yes --> ExtractMeta["Extract Filename, Compression Method & Compressed Size"]
    ExtractMeta --> CRC{"Verify CRC-32 Checksum?"}
    
    CRC -- Valid --> RecoverList["Add to Recovered Entries Registry"]
    CRC -- Invalid --> DropWarn["Log Discrepancy & Attempt Fallback"]
    
    ValidateHeader -- No --> StepByte["Step Offset & Seek Next Header"]
    StepByte --> ByteScanner
    
    RecoverList --> SynthCD["Synthesize Valid Central Directory (PK\x01\x02)"]
    SynthCD --> SynthEOCD["Synthesize End-of-Central-Directory (PK\x05\x06)"]
    SynthEOCD --> RepairedZip["Repaired, 100% Extractable Archive"]
```

---

## 5. Storage vs. Compute Pareto Frontier Analysis

In data engineering pipelines (Apache Iceberg, Parquet, Delta Lake, ClickHouse), picking the wrong compression codec results in either excessive cloud storage bills or CPU exhaustion during ETL queries. Arkive provides an algorithmic profiler to discover mathematically optimal configurations.

```mermaid
flowchart LR
    Dataset["Synthetic Columnar Data (CSV, Logs, JSON, Parquet)"] --> BenchmarkMatrix["Run Multi-Codec Matrix (Deflate, Zstd, LZ4, Bzip2, XZ)"]
    BenchmarkMatrix --> MetricCollect["Collect Metrics: Compression Ratio & Throughput (MB/s)"]
    MetricCollect --> ParetoFilter["Pareto Dominance Evaluator"]
    
    subgraph ParetoCondition ["Pareto Optimal Condition"]
        ParetoFilter --> Condition{"Is Any Configuration Strictly Better in Both Ratio AND Speed?"}
        Condition -- No --> ParetoTrue["Tag as Pareto Optimal (Frontier)"]
        Condition -- Yes --> ParetoFalse["Tag as Sub-Optimal"]
    end
    
    ParetoTrue --> VisualFrontier["Render Interactive 2D Pareto Curve & Export CSV"]
```

---

## 6. Video Compression & Transcoding Architecture

Standard DEFLATE/ZIP algorithms cannot effectively compress video files (MP4, MKV, MOV, WebM) because modern video containers already contain high-entropy, DCT/wavelet-compressed bitstreams. True video compression requires perceptual re-encoding and bitrate budgeting.

Arkive bundles an embedded **FFmpeg 6.1** transcoding engine integrated across the Rust core, CLI, and Electron desktop app:

```mermaid
flowchart TD
    VideoInput["Source Video (MP4 / MKV / MOV / WebM)"] --> Probe["Video Metadata Prober (probe_video)"]
    Probe --> Meta["Extract: Duration, Resolution, FPS, Bitrate, Codecs"]
    
    Meta --> Strategy{"Compression Preset Strategy"}
    
    Strategy -- "Discord (< 25 MB)" --> Budget["Bitrate Budgeting Formula: Target 24 MB"]
    Strategy -- "Balanced" --> H264["H.264 (libx264) + CRF 28 + Fast Preset"]
    Strategy -- "Max Space" --> HEVC["H.265 / HEVC (libx265) + CRF 28 + Apple 'hvc1' Tag"]
    Strategy -- "Mobile 720p" --> Downscale["scale=-2:720 Filter + CRF 28"]
    Strategy -- "Custom" --> CustomParams["User Defined: Codec, CRF / Target MB, Resolution"]
    
    Budget --> Transcode["FFmpeg Execution Subprocess"]
    H264 --> Transcode
    HEVC --> Transcode
    Downscale --> Transcode
    CustomParams --> Transcode
    
    Transcode --> ProgressStream["Real-Time Stderr Progress Parser (time, fps, speed)"]
    ProgressStream --> UIProgress["Desktop UI Live Progress & Percentage"]
    
    Transcode --> OutputFile["Optimized Video (.compressed.mp4)"]
    OutputFile --> StatsCalc["Before/After Comparison & Savings %"]
```

### Bitrate Budgeting Formula
When compressing to strict platform upload caps (such as Discord's 25 MB limit or email attachments), Arkive dynamically solves for the maximum allowable video bitrate given the video's total duration:

$$\text{Bitrate}_{\text{video}} = \left( \frac{\text{TargetMB} \times 8192}{\text{Duration}_{\text{seconds}}} \right) - \text{Bitrate}_{\text{audio}}$$

- Guarantees video output stays strictly within the target threshold without guessing.
- Constrains buffer size (`-bufsize`) and maximum bitrate (`-maxrate`) to prevent bandwidth spikes.
- Downscales resolutions higher than 1080p to prevent compression artifacts at constrained bitrates.

---

## 7. Repository Directory Map

```
arkive/
├── crates/
│   ├── arkive-core/                # Pure systems compression library
│   │   ├── src/
│   │   │   ├── archive.rs          # Unified create / extract / list facades
│   │   │   ├── bench.rs            # Multi-codec benchmark engine & Pareto frontier
│   │   │   ├── codec.rs            # Raw stream encoders/decoders (Zstd, LZ4, etc.)
│   │   │   ├── format.rs           # Format discriminator & extension sniffer
│   │   │   ├── inputs.rs           # Recursive folder scanner & item collector
│   │   │   ├── progress.rs         # Streaming progress tracker & cancellation
│   │   │   ├── repair.rs           # Truncated ZIP central directory reconstructor
│   │   │   ├── util.rs             # Path normalization & Zip-Slip protection
│   │   │   ├── video.rs            # Video probing, transcoding & bitrate budgeting
│   │   │   └── formats/            # Specialized format drivers (ZIP, 7z, TAR, RAR)
│   └── arkive-cli/                 # Command-line interface binary
│       └── src/main.rs             # Clap CLI, formatted terminal tables, JSON output
├── apps/
│   └── desktop/                    # Desktop application
│       ├── build/installer.nsh     # Windows NSIS Shell Context Menu script
│       ├── electron/
│       │   ├── main.cjs            # Electron process, lifecycle, IPC routing
│       │   ├── preload.cjs         # Context bridge isolating renderer from Node
│       │   └── shell-integration.cjs # Windows Registry HKCU shell context menu
│       └── src/
│           ├── App.tsx             # Root React coordinator (Dual Mode state)
│           ├── components/
│           │   ├── FileBrowser.tsx # Dual-mode PC explorer & archive inspector
│           │   ├── Toolbar.tsx     # Command bar with context menu status
│           │   ├── VideoModal.tsx  # Video compressor, transcoder & preset selector
│           │   ├── CreateModal.tsx # Archive creation with folder & file selectors
│           │   ├── BenchmarkView.tsx # 2D Pareto frontier analytics dashboard
│           │   └── ...             # Modals for extract, repair, preview, info
└── Cargo.toml                      # Root Cargo workspace manifest
```
