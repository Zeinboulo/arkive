# Compression Algorithms & Data Engineering Benchmark

When architecting high-throughput data pipelines, data lakes, or analytical warehouses, **choosing the right compression algorithm is a critical engineering trade-off**. Storage costs, network I/O, CPU cycles, and query latency directly depend on the codec selected.

Arkive includes a built-in benchmark harness (`arkive bench`) designed to measure:
1. **Compression Ratio** (\( \text{Uncompressed Size} / \text{Compressed Size} \))
2. **Space Savings %** (\( 1 - \frac{\text{Compressed}}{\text{Uncompressed}} \))
3. **Compression Throughput** (MB/s)
4. **Decompression Throughput** (MB/s)
5. **Pareto Frontier** (Algorithms that offer non-dominated trade-offs between ratio and speed)

---

## Codec Trade-off Matrix

| Algorithm | Category | Compression Speed | Decompression Speed | Ratio | Ideal Use Case |
|---|---|---|---|---|---|
| **LZ4** | Byte-oriented dictionary | **Ultra Fast** (700-1,200 MB/s) | **Extreme** (> 2,500 MB/s) | Low-Medium (1.8x - 2.2x) | Real-time Kafka streams, RPC serialization, IPC transfer |
| **Zstandard (Zstd)** | Finite State Entropy (FSE) + Huffman | **Fast to High** (50-500 MB/s) | **Very Fast** (1,000-1,600 MB/s) | High (3.2x - 4.5x) | Parquet / ORC column chunks, ClickHouse, Iceberg data lakes |
| **Deflate (Gzip/ZIP)** | LZ77 + Huffman | Medium (25-80 MB/s) | Medium (200-350 MB/s) | Medium-High (3.0x - 3.8x) | Web assets, legacy batch exports, cross-platform archives |
| **Bzip2** | Burrows-Wheeler Transform | Slow (10-25 MB/s) | Slow (35-60 MB/s) | Very High (3.8x - 4.4x) | Legacy text compression, single-core archival |
| **XZ (LZMA2)** | Range coding + large dictionary | Very Slow (4-15 MB/s) | Slow-Medium (70-120 MB/s) | **Maximum** (4.5x - 5.5x) | Cold storage, infrequently accessed snapshots, release packages |

---

## The Pareto Frontier for Modern Data Lakes

In production data systems, an algorithm is considered **Pareto-optimal** if no other algorithm achieves both higher compression ratio and higher throughput.

From empirical benchmarks across tabular datasets (CSV, JSON, Parquet):
- **For Streaming / Ingestion:** **LZ4** is Pareto-optimal because CPU cost is negligible compared to network transfer savings.
- **For Analytics & Storage (Parquet / Iceberg):** **Zstandard Level 3 to 6** dominates Deflate across both compression speed, decompression speed, and ratio.
- **For Long-Term Cold Storage:** **XZ Level 6 to 9** minimizes AWS S3 / Azure Blob storage bills where access is rare.

---

## Running Benchmarks in Arkive

### Using the CLI
```bash
# Benchmark all codecs on a 32 MiB synthetic tabular CSV dataset
arkive bench --dataset csv --size 32

# Benchmark on real data lake files with multi-threading
arkive bench --input ./warehouse/events --threads 8 --csv benchmark_results.csv

# Output as JSON for automated CI/CD profiling
arkive bench --dataset json --size 16 --json
```

### Using the Desktop Dashboard
1. Launch Arkive.
2. Click **Benchmark Engine** in the toolbar.
3. Select your dataset (CSV, JSON logs, Text, Mixed) and target size.
4. Click **Run Benchmark** to view interactive KPI cards, throughput charts, and the Pareto-optimal status.
