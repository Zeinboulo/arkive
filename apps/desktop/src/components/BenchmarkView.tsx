import React, { useState } from 'react';
import {
  Play,
  Download,
  RefreshCw,
  Check,
} from 'lucide-react';
import { BenchConfig, BenchReport } from '../types';

interface BenchmarkViewProps {
  onRunBench: (config: BenchConfig) => Promise<void>;
  isRunning: boolean;
  progressMsg: string;
  report: BenchReport | null;
}

export const BenchmarkView: React.FC<BenchmarkViewProps> = ({
  onRunBench,
  isRunning,
  progressMsg,
  report,
}) => {
  const [dataset, setDataset] = useState('csv');
  const [sizeMb, setSizeMb] = useState(16);
  const [threads, setThreads] = useState(0);
  const [selectedCodecs, setSelectedCodecs] = useState<string[]>([
    'deflate',
    'bzip2',
    'xz',
    'zstd',
    'lz4',
  ]);

  const toggleCodec = (codec: string) => {
    setSelectedCodecs((prev) =>
      prev.includes(codec) ? prev.filter((c) => c !== codec) : [...prev, codec]
    );
  };

  const handleStart = () => {
    onRunBench({
      dataset,
      sizeMb,
      threads,
      codecs: selectedCodecs,
      levels: [1, 3, 6, 9],
    });
  };

  const handleExportCsv = () => {
    if (!report) return;
    let csv =
      'Codec,Level,Ratio,Savings %,Compress MB/s,Decompress MB/s,Pareto\n';
    report.results.forEach((r) => {
      csv += `${r.codecLabel},${r.level},${r.ratio.toFixed(2)},${r.savingPct.toFixed(1)},${r.compressMbS.toFixed(1)},${r.decompressMbS.toFixed(1)},${r.pareto ? 'Yes' : 'No'}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arkive-benchmark-${dataset}-${sizeMb}mb.csv`;
    a.click();
  };

  const bestRatio = report?.results.reduce((max, r) => (r.ratio > max.ratio ? r : max), report.results[0]);
  const bestCompSpeed = report?.results.reduce((max, r) => (r.compressMbS > max.compressMbS ? r : max), report.results[0]);
  const bestDecompSpeed = report?.results.reduce((max, r) => (r.decompressMbS > max.decompressMbS ? r : max), report.results[0]);

  return (
    <div className="flex-1 flex flex-col bg-slate-900 overflow-y-auto p-4 space-y-4 select-none">
      {/* Top Control Strip */}
      <div className="bg-slate-850 border border-slate-800 rounded p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-sky-400">
            RUST ENGINE TELEMETRY // PARETO FRONTIER
          </div>
          <h2 className="text-sm font-bold text-slate-50 mt-0.5">
            Codec Throughput &amp; Ratio Benchmark
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Measure compression ratio, encode/decode MB/s, and multi-core scaling across Deflate, Bzip2, XZ, Zstd, and LZ4.
          </p>
        </div>

        <button
          type="button"
          onClick={handleStart}
          disabled={isRunning || selectedCodecs.length === 0}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded font-mono text-xs font-semibold transition border shrink-0 ${
            isRunning
              ? 'bg-slate-800 text-slate-400 border-slate-700 cursor-wait'
              : 'bg-sky-600 hover:bg-sky-500 text-white border-sky-500'
          }`}
        >
          {isRunning ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>RUNNING BENCHMARK…</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>EXECUTE BENCHMARK</span>
            </>
          )}
        </button>
      </div>

      {/* Parameter Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-850 p-3.5 rounded border border-slate-800 text-xs">
        <div>
          <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
            Corpus Workload
          </label>
          <select
            value={dataset}
            onChange={(e) => setDataset(e.target.value)}
            disabled={isRunning}
            className="w-full bg-slate-900 border border-slate-750 rounded-sm px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500"
          >
            <option value="csv">Tabular CSV Events</option>
            <option value="json">Structured JSON Logs</option>
            <option value="text">Prose Text Corpus</option>
            <option value="mixed">Mixed Binary + Text</option>
            <option value="random">High-Entropy Random</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
            Buffer Size: <span className="text-slate-100">{sizeMb} MiB</span>
          </label>
          <input
            type="range"
            min="4"
            max="64"
            step="4"
            value={sizeMb}
            onChange={(e) => setSizeMb(Number(e.target.value))}
            disabled={isRunning}
            className="w-full accent-sky-500 cursor-pointer"
          />
        </div>

        <div>
          <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
            Threads: <span className="text-slate-100">{threads === 0 ? 'AUTO (ALL CORES)' : threads}</span>
          </label>
          <input
            type="range"
            min="0"
            max="16"
            step="1"
            value={threads}
            onChange={(e) => setThreads(Number(e.target.value))}
            disabled={isRunning}
            className="w-full accent-sky-500 cursor-pointer"
          />
        </div>

        <div>
          <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
            Active Codecs
          </label>
          <div className="flex flex-wrap gap-1">
            {['deflate', 'bzip2', 'xz', 'zstd', 'lz4'].map((c) => {
              const active = selectedCodecs.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCodec(c)}
                  disabled={isRunning}
                  className={`text-[10px] px-2 py-0.5 rounded-sm font-mono uppercase transition border ${
                    active
                      ? 'bg-sky-500/20 text-sky-400 border-sky-500/40 font-semibold'
                      : 'bg-slate-900 text-slate-500 border-slate-800'
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {isRunning && (
        <div className="bg-slate-850 p-3 rounded border border-sky-500/30 flex items-center gap-2.5 font-mono text-xs">
          <RefreshCw className="w-4 h-4 text-sky-400 animate-spin" />
          <span className="text-slate-200">{progressMsg}</span>
        </div>
      )}

      {/* Telemetry Readouts */}
      {report && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono">
          <div className="bg-slate-850 border border-slate-800 rounded p-3.5">
            <div className="text-[10px] uppercase text-slate-500">PEAK COMPRESSION RATIO</div>
            <div className="text-lg font-bold text-emerald-400 mt-1">
              {bestRatio?.ratio.toFixed(2)}x{' '}
              <span className="text-xs text-slate-400 font-normal">
                (-{bestRatio?.savingPct.toFixed(1)}%)
              </span>
            </div>
            <div className="text-[11px] text-slate-300 mt-0.5">
              {bestRatio?.codecLabel} · L{bestRatio?.level}
            </div>
          </div>

          <div className="bg-slate-850 border border-slate-800 rounded p-3.5">
            <div className="text-[10px] uppercase text-slate-500">PEAK ENCODE THROUGHPUT</div>
            <div className="text-lg font-bold text-sky-400 mt-1">
              {bestCompSpeed?.compressMbS.toFixed(1)} MB/s
            </div>
            <div className="text-[11px] text-slate-300 mt-0.5">
              {bestCompSpeed?.codecLabel} · L{bestCompSpeed?.level}
            </div>
          </div>

          <div className="bg-slate-850 border border-slate-800 rounded p-3.5">
            <div className="text-[10px] uppercase text-slate-500">PEAK DECODE THROUGHPUT</div>
            <div className="text-lg font-bold text-slate-100 mt-1">
              {bestDecompSpeed?.decompressMbS.toFixed(1)} MB/s
            </div>
            <div className="text-[11px] text-slate-300 mt-0.5">
              {bestDecompSpeed?.codecLabel} · L{bestDecompSpeed?.level}
            </div>
          </div>
        </div>
      )}

      {/* Results Matrix Table */}
      {report && (
        <div className="bg-slate-850 rounded border border-slate-800 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
            <div className="font-mono text-xs text-slate-300">
              MATRIX RESULTS // {(report.inputBytes / (1024 * 1024)).toFixed(1)} MiB ·{' '}
              {(report.elapsedMs / 1000).toFixed(2)}s · {report.cpuThreads} THREADS
            </div>
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-slate-900 hover:bg-slate-800 text-[11px] font-mono text-slate-200 transition border border-slate-750"
            >
              <Download className="w-3 h-3 text-sky-400" />
              <span>EXPORT CSV</span>
            </button>
          </div>

          <div
            tabIndex={0}
            role="region"
            aria-label="Codec benchmark results"
            className="arkive-table-region"
          >
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900 text-[10px] font-mono uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th scope="col" className="px-4 py-2 border-b border-r border-slate-800">Codec</th>
                  <th scope="col" className="px-4 py-2 text-center border-b border-r border-slate-800">Level</th>
                  <th scope="col" className="px-4 py-2 text-right border-b border-r border-slate-800">Ratio</th>
                  <th scope="col" className="px-4 py-2 text-right border-b border-r border-slate-800">Space Saved</th>
                  <th scope="col" className="px-4 py-2 text-right border-b border-r border-slate-800">Encode (MB/s)</th>
                  <th scope="col" className="px-4 py-2 text-right border-b border-r border-slate-800">Decode (MB/s)</th>
                  <th scope="col" className="px-4 py-2 text-center border-b border-slate-800">Pareto Frontier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {report.results.map((r, idx) => (
                  <tr
                    key={idx}
                    className={`hover:bg-slate-800/60 transition ${
                      r.pareto ? 'bg-sky-500/5' : ''
                    }`}
                  >
                    <th scope="row" className="px-4 py-2 font-semibold text-slate-100 border-r border-slate-800/50 text-left">
                      {r.codecLabel}
                    </th>
                    <td className="px-4 py-2 text-center text-slate-400 border-r border-slate-800/50">
                      L{r.level}
                    </td>
                    <td className="px-4 py-2 text-right text-emerald-400 font-bold tabular-nums border-r border-slate-800/50">
                      {r.ratio.toFixed(2)}x
                    </td>
                    <td className="px-4 py-2 text-right text-slate-300 tabular-nums border-r border-slate-800/50">
                      {r.savingPct.toFixed(1)}%
                    </td>
                    <td className="px-4 py-2 text-right text-sky-400 tabular-nums border-r border-slate-800/50">
                      {r.compressMbS.toFixed(1)}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-200 tabular-nums border-r border-slate-800/50">
                      {r.decompressMbS.toFixed(1)}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {r.pareto ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded-sm bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <Check className="w-3 h-3" />
                          <span>OPTIMAL</span>
                        </span>
                      ) : (
                        <span className="text-slate-600 text-[10px]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
