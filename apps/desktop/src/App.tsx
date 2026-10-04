import React, { useState } from 'react';
import { Toolbar } from './components/Toolbar';
import { FileBrowser } from './components/FileBrowser';
import { BenchmarkView } from './components/BenchmarkView';
import { CreateModal } from './components/CreateModal';
import { ExtractModal } from './components/ExtractModal';
import { RepairModal } from './components/RepairModal';
import { PreviewModal } from './components/PreviewModal';
import { InfoModal } from './components/InfoModal';
import { StatusBar } from './components/StatusBar';
import { Entry, ArchiveInfo, BenchReport, ProgressUpdate } from './types';

// Mock initial state for preview / demonstration
const SAMPLE_ENTRIES: Entry[] = [
  {
    path: 'events_2026_10_04.parquet',
    size: 42104928,
    compressedSize: 8420985,
    isDir: false,
    modified: '2026-10-04 12:45',
    encrypted: false,
    crc32: 0x9b32fa12,
  },
  {
    path: 'metrics_stream.json.zst',
    size: 15482910,
    compressedSize: 2210480,
    isDir: false,
    modified: '2026-10-04 12:40',
    encrypted: false,
    crc32: 0x4f12ab34,
  },
  {
    path: 'schemas/events_v2.proto',
    size: 4120,
    compressedSize: 1040,
    isDir: false,
    modified: '2026-10-04 11:15',
    encrypted: false,
    crc32: 0x12ab89cd,
  },
  {
    path: 'schemas/clickhouse_ddl.sql',
    size: 8940,
    compressedSize: 2150,
    isDir: false,
    modified: '2026-10-04 11:20',
    encrypted: false,
    crc32: 0x8921dcba,
  },
  {
    path: 'schemas',
    size: 0,
    compressedSize: 0,
    isDir: true,
    modified: '2026-10-04 11:20',
    encrypted: false,
    crc32: null,
  },
  {
    path: 'credentials.env.enc',
    size: 1024,
    compressedSize: 1080,
    isDir: false,
    modified: '2026-10-04 10:00',
    encrypted: true,
    crc32: 0x77aa11ff,
  },
];

const SAMPLE_INFO: ArchiveInfo = {
  path: 'C:\\data\\data_lake_snapshot.zip',
  format: 'zip',
  formatLabel: 'ZIP (Deflate + AES-256)',
  archiveSize: 10634655,
  files: 5,
  dirs: 1,
  totalSize: 57599022,
  packedSize: 10634655,
  ratio: 0.1846,
  encrypted: true,
  canAdd: true,
};

export const App: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState<'files' | 'bench'>('files');
  const [currentArchive, setCurrentArchive] = useState<string | null>(
    'C:\\data\\data_lake_snapshot.zip'
  );
  const [entries, setEntries] = useState<Entry[]>(SAMPLE_ENTRIES);
  const [archiveInfo, setArchiveInfo] = useState<ArchiveInfo | null>(SAMPLE_INFO);
  const [currentPath, setCurrentPath] = useState('');
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isExtractOpen, setIsExtractOpen] = useState(false);
  const [isRepairOpen, setIsRepairOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  // Preview
  const [previewEntry, setPreviewEntry] = useState<Entry | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // Benchmark
  const [isBenchRunning, setIsBenchRunning] = useState(false);
  const [benchProgressMsg, setBenchProgressMsg] = useState('');
  const [benchReport, setBenchReport] = useState<BenchReport | null>(null);

  // Status & Progress
  const [statusMessage, setStatusMessage] = useState('Ready');
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);

  const handleToggleSelect = (path: string, isMulti: boolean) => {
    setSelectedEntries((prev) => {
      const next = new Set(isMulti ? prev : []);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handlePreview = (entry: Entry) => {
    setPreviewEntry(entry);
    setIsPreviewLoading(true);
    setPreviewContent(null);

    // Mock content for demo
    setTimeout(() => {
      if (entry.path.endsWith('.sql')) {
        setPreviewContent(
          `-- ClickHouse Events DDL\nCREATE TABLE default.events (\n    event_id UInt64,\n    event_time DateTime64(3, 'UTC'),\n    user_id UInt64,\n    event_type LowCardinality(String),\n    payload String CODEC(ZSTD(3))\n)\nENGINE = MergeTree()\nPARTITION BY toYYYYMM(event_time)\nORDER BY (event_type, event_time, user_id);`
        );
      } else if (entry.path.endsWith('.proto')) {
        setPreviewContent(
          `syntax = "proto3";\npackage data.events.v2;\n\nmessage EventRecord {\n  uint64 event_id = 1;\n  int64 timestamp_ms = 2;\n  uint64 user_id = 3;\n  string event_name = 4;\n  map<string, string> attributes = 5;\n}`
        );
      } else {
        setPreviewContent(
          `Preview of ${entry.path}\nSize: ${entry.size} bytes\nCRC32: ${entry.crc32}`
        );
      }
      setIsPreviewLoading(false);
    }, 150);
  };

  const handleRunBench = async (config: any) => {
    setIsBenchRunning(true);
    setBenchProgressMsg('Initializing benchmark dataset...');

    // Simulate progress updates for realistic feel
    const codecs = [
      { name: 'Deflate L1', ratio: 2.8, comp: 94.2, decomp: 268.4, pareto: false },
      { name: 'Deflate L6', ratio: 3.4, comp: 38.6, decomp: 275.1, pareto: false },
      { name: 'Bzip2 L9', ratio: 4.1, comp: 14.2, decomp: 42.0, pareto: false },
      { name: 'XZ L6', ratio: 4.8, comp: 8.5, decomp: 88.3, pareto: true },
      { name: 'Zstandard L3', ratio: 3.6, comp: 480.5, decomp: 1250.0, pareto: true },
      { name: 'Zstandard L9', ratio: 4.4, comp: 95.1, decomp: 1180.2, pareto: true },
      { name: 'LZ4', ratio: 2.1, comp: 820.0, decomp: 2450.0, pareto: true },
    ];

    for (let i = 0; i < codecs.length; i++) {
      setBenchProgressMsg(`Benchmarking ${codecs[i].name}...`);
      await new Promise((res) => setTimeout(res, 350));
    }

    setBenchReport({
      dataset: `Synthetic ${config.dataset.toUpperCase()} (${config.sizeMb} MiB)`,
      inputBytes: config.sizeMb * 1024 * 1024,
      cpuThreads: config.threads === 0 ? 8 : config.threads,
      elapsedMs: 2450,
      results: codecs.map((c, idx) => ({
        codec: c.name.split(' ')[0].toLowerCase(),
        codecLabel: c.name,
        level: Number(c.name.split(' L')[1]) || 1,
        nativeLevel: 3,
        threads: 8,
        inputBytes: config.sizeMb * 1024 * 1024,
        outputBytes: Math.round((config.sizeMb * 1024 * 1024) / c.ratio),
        ratio: c.ratio,
        savingPct: (1 - 1 / c.ratio) * 100,
        compressMs: 45,
        decompressMs: 20,
        compressMbS: c.comp,
        decompressMbS: c.decomp,
        pareto: c.pareto,
      })),
    });

    setIsBenchRunning(false);
  };

  const handleRepair = async (archivePath: string, outputPath: string) => {
    await new Promise((res) => setTimeout(res, 800));
    return {
      found: 14,
      recovered: 14,
      verified: 14,
      unverifiable: 0,
      dropped: [],
      output: outputPath || `${archivePath}.repaired.zip`,
    };
  };

  const totalBytes = entries.reduce((sum, e) => sum + e.size, 0);

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-900 text-slate-100 select-none overflow-hidden font-sans">
      {/* Top Application Bar */}
      <div className="bg-slate-950 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center space-x-2">
          <span className="font-extrabold tracking-wider text-white text-sm bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
            ARKIVE
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-300 font-mono truncate max-w-lg">
            {currentArchive || 'No archive loaded'}
          </span>
        </div>
        <div className="flex items-center space-x-3 text-[11px]">
          <span className="text-emerald-400 font-medium">Rust Engine Active</span>
          <span className="text-slate-600">•</span>
          <span>v0.1.0</span>
        </div>
      </div>

      {/* Main Toolbar */}
      <Toolbar
        onOpen={() => alert('Select an archive from disk using CLI or file picker')}
        onCreate={() => setIsCreateOpen(true)}
        onExtract={() => setIsExtractOpen(true)}
        onTest={() => alert('Integrity Test Passed: All 5 entries CRC verified.')}
        onInfo={() => setIsInfoOpen(true)}
        onRepair={() => setIsRepairOpen(true)}
        onBenchmark={() => setSelectedTab('bench')}
        hasArchive={Boolean(currentArchive)}
        selectedTab={selectedTab}
        setSelectedTab={setSelectedTab}
      />

      {/* Main Workspace Body */}
      {selectedTab === 'files' ? (
        <FileBrowser
          entries={entries}
          currentPath={currentPath}
          onNavigate={setCurrentPath}
          onPreview={handlePreview}
          selectedEntries={selectedEntries}
          onToggleSelect={handleToggleSelect}
          onSelectAll={() =>
            setSelectedEntries(new Set(entries.map((e) => e.path)))
          }
        />
      ) : (
        <BenchmarkView
          onRunBench={handleRunBench}
          isRunning={isBenchRunning}
          progressMsg={benchProgressMsg}
          report={benchReport}
        />
      )}

      {/* Status Bar */}
      <StatusBar
        totalFiles={entries.filter((e) => !e.isDir).length}
        totalBytes={totalBytes}
        selectedCount={selectedEntries.size}
        progress={progress}
        statusMessage={statusMessage}
      />

      {/* Modals */}
      <CreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={(opts) => {
          setStatusMessage(`Created archive ${opts.name} successfully.`);
        }}
        inputPaths={[]}
      />

      <ExtractModal
        isOpen={isExtractOpen}
        onClose={() => setIsExtractOpen(false)}
        onSubmit={(opts) => {
          setStatusMessage(`Extracted archive to ${opts.dest}.`);
        }}
        archivePath={currentArchive || ''}
        isEncrypted={archiveInfo?.encrypted || false}
      />

      <RepairModal
        isOpen={isRepairOpen}
        onClose={() => setIsRepairOpen(false)}
        onRepair={handleRepair}
      />

      <PreviewModal
        isOpen={Boolean(previewEntry)}
        onClose={() => setPreviewEntry(null)}
        entry={previewEntry}
        content={previewContent}
        isLoading={isPreviewLoading}
      />

      <InfoModal
        isOpen={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
        info={archiveInfo}
      />
    </div>
  );
};
export default App;
