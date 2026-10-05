import React, { useState } from 'react';
import {
  Play,
  Download,
  Flame,
  Zap,
  HardDrive,
  Cpu,
  Award,
  RefreshCw,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import { BenchConfig, BenchReport, BenchResult } from '../types';

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

  // Best performers
  const bestRatio = report?.results.reduce((max, r) => (r.ratio > max.ratio ? r : max), report.results[0]);
  const bestCompSpeed = report?.results.reduce((max, r) => (r.compressMbS > max.compressMbS ? r : max), report.results[0]);
  const bestDecompSpeed = report?.results.reduce((max, r) => (r.decompressMbS > max.decompressMbS ? r : max), report.results[0]);

  return (
    <div className="flex-1 flex flex-col bg-slate-900 overflow-y-auto p-6 space-y-6 select-none">
      {/* Header banner */}
      <div className="bg-gradient-to-r from-purple-900/40 via-indigo-900/30 to-slate-900 border border-purple-500/30 rounded-xl p-5 flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-purple-500/20 text-purple-300 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-purple-500/30">
              Data Engineering Suite
            </span>
            <span className="text-xs text-slate-400">
              Algorithm Trade-off Benchmarking
            </span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">
            Compression Codec & Throughput Benchmark
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Evaluate compression ratios, compute latency, and memory characteristics across modern storage codecs (Deflate, Bzip2, XZ, Zstandard, LZ4). Find the Pareto-optimal frontier for your data pipeline.
          </p>
        </div>

        <button
          onClick={handleStart}
          disabled={isRunning || selectedCodecs.length === 0}
          className={`flex items-center space-x-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition shadow-lg active:scale-95 ${
            isRunning
              ? 'bg-purple-600/50 text-purple-200 cursor-wait'
              : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/50'
          }`}
        >
          {isRunning ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Running Benchmark...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white" />
              <span>Run Benchmark</span>
            </>
          )}
        </button>
      </div>

      {/* Control panel & Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-850 p-4 rounded-xl border border-slate-800">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Dataset Type
          </label>
          <select
            value={dataset}
            onChange={(e) => setDataset(e.target.value)}
            disabled={isRunning}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
          >
            <option value="csv">Synthetic CSV (Tabular events)</option>
            <option value="json">Synthetic JSON (Distributed trace logs)</option>
            <option value="text">Text (Corpus)</option>
            <option value="mixed">Mixed Workload</option>
            <option value="random">Random Bytes (Entropy test)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Dataset Size: {sizeMb} MiB
          </label>
          <input
            type="range"
            min="4"
            max="64"
            step="4"
            value={sizeMb}
            onChange={(e) => setSizeMb(Number(e.target.value))}
            disabled={isRunning}
            className="w-full accent-purple-500 cursor-pointer"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Worker Threads: {threads === 0 ? 'Auto (All Cores)' : threads}
          </label>
          <input
            type="range"
            min="0"
            max="16"
            step="1"
            value={threads}
            onChange={(e) => setThreads(Number(e.target.value))}
            disabled={isRunning}
            className="w-full accent-purple-500 cursor-pointer"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Included Codecs
          </label>
          <div className="flex flex-wrap gap-1.5">
            {['deflate', 'bzip2', 'xz', 'zstd', 'lz4'].map((c) => {
              const active = selectedCodecs.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCodec(c)}
                  disabled={isRunning}
                  className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase transition ${
                    active
                      ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50'
                      : 'bg-slate-800 text-slate-500 border border-slate-700'
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
        <div className="bg-slate-850 p-4 rounded-xl border border-purple-500/40 flex items-center space-x-3">
          <RefreshCw className="w-5 h-5 text-purple-400 animate-spin" />
          <span className="text-sm font-medium text-slate-200">{progressMsg}</span>
        </div>
      )}

      {/* KPI Cards */}
      {report && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-850 border border-slate-800 rounded-xl p-4 flex items-center space-x-3">
            <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 uppercase font-semibold">
                Maximum Compression Ratio
              </p>
              <h3 className="text-lg font-bold text-white mt-0.5">
                {bestRatio?.ratio.toFixed(2)}x{' '}
                <span className="text-xs text-emerald-400 font-normal">
                  ({bestRatio?.savingPct.toFixed(1)}% savings)
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                {bestRatio?.codecLabel} (Level {bestRatio?.level})
              </p>
            </div>
          </div>

          <div className="bg-slate-850 border border-slate-800 rounded-xl p-4 flex items-center space-x-3">
            <div className="p-3 rounded-lg bg-sky-500/10 text-sky-400">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 uppercase font-semibold">
                Fastest Compression Speed
              </p>
              <h3 className="text-lg font-bold text-white mt-0.5">
                {bestCompSpeed?.compressMbS.toFixed(1)} MB/s
              </h3>
              <p className="text-[11px] text-slate-400">
                {bestCompSpeed?.codecLabel} (Level {bestCompSpeed?.level})
              </p>
            </div>
          </div>

          <div className="bg-slate-850 border border-slate-800 rounded-xl p-4 flex items-center space-x-3">
            <div className="p-3 rounded-lg bg-purple-500/10 text-purple-400">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 uppercase font-semibold">
                Fastest Decompression Speed
              </p>
              <h3 className="text-lg font-bold text-white mt-0.5">
                {bestDecompSpeed?.decompressMbS.toFixed(1)} MB/s
              </h3>
              <p className="text-[11px] text-slate-400">
                {bestDecompSpeed?.codecLabel} (Level {bestDecompSpeed?.level})
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Benchmark results table */}
      {report && (
        <div className="bg-slate-850 rounded-xl border border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">
                Detailed Codec Matrix & Pareto Frontier
              </h3>
              <p className="text-xs text-slate-400">
                Processed {(report.inputBytes / (1024 * 1024)).toFixed(1)} MiB in{' '}
                {(report.elapsedMs / 1000).toFixed(2)}s using {report.cpuThreads} CPU threads
              </p>
            </div>
            <button
              onClick={handleExportCsv}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition border border-slate-700 active:scale-95"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              <span>Export CSV</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/60 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-2.5">Codec</th>
                  <th className="px-4 py-2.5 text-center">Level</th>
                  <th className="px-4 py-2.5 text-right">Ratio</th>
                  <th className="px-4 py-2.5 text-right">Savings</th>
                  <th className="px-4 py-2.5 text-right">Compress (MB/s)</th>
                  <th className="px-4 py-2.5 text-right">Decompress (MB/s)</th>
                  <th className="px-4 py-2.5 text-center">Pareto Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {report.results.map((r, idx) => (
                  <tr
                    key={idx}
                    className={`hover:bg-slate-800/50 transition ${
                      r.pareto ? 'bg-purple-950/20' : ''
                    }`}
                  >
                    <td className="px-4 py-2.5 font-sans font-semibold text-slate-200">
                      {r.codecLabel}
                    </td>
                    <td className="px-4 py-2.5 text-center text-slate-400">
                      {r.level}
                    </td>
                    <td className="px-4 py-2.5 text-right text-emerald-400 font-bold">
                      {r.ratio.toFixed(2)}x
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-300">
                      {r.savingPct.toFixed(1)}%
                    </td>
                    <td className="px-4 py-2.5 text-right text-sky-400">
                      {r.compressMbS.toFixed(1)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-purple-400">
                      {r.decompressMbS.toFixed(1)}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {r.pareto ? (
                        <span className="inline-flex items-center space-x-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-sans font-medium">
                          <Award className="w-3 h-3 text-amber-400" />
                          <span>Optimal</span>
                        </span>
                      ) : (
                        <span className="text-slate-600 text-[10px] font-sans">
                          Dominated
                        </span>
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
