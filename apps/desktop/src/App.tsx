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
import { Entry, ArchiveInfo, BenchReport, ProgressUpdate, RepairReport } from './types';

export const App: React.FC = () => {
  const isDesktop = typeof window !== 'undefined' && Boolean(window.arkive?.isDesktop);

  const [selectedTab, setSelectedTab] = useState<'files' | 'bench'>('files');
  const [currentArchive, setCurrentArchive] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [archiveInfo, setArchiveInfo] = useState<ArchiveInfo | null>(null);
  const [currentPath, setCurrentPath] = useState('');
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isExtractOpen, setIsExtractOpen] = useState(false);
  const [isRepairOpen, setIsRepairOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [createInputs, setCreateInputs] = useState<string[]>([]);

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
  const [progress] = useState<ProgressUpdate | null>(null);

  const handleOpenArchive = async () => {
    if (!window.arkive?.openArchiveDialog) return;
    try {
      const filePath = await window.arkive.openArchiveDialog();
      if (!filePath) return;
      setStatusMessage(`Loading ${filePath}...`);
      const list = await window.arkive.listArchive(filePath);
      const info = await window.arkive.getArchiveInfo(filePath);
      setCurrentArchive(filePath);
      setEntries(list);
      setArchiveInfo(info);
      setCurrentPath('');
      setSelectedEntries(new Set());
      setStatusMessage(`Opened ${filePath} (${list.length} items)`);
    } catch (err: any) {
      alert(`Failed to open archive: ${err?.message || err}`);
      setStatusMessage('Error opening archive');
    }
  };

  const handleCreateOpen = async () => {
    if (!window.arkive?.openFilesDialog) return;
    const files = await window.arkive.openFilesDialog();
    if (!files || files.length === 0) return;
    setCreateInputs(files);
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = async (opts: any) => {
    if (!window.arkive?.saveArchiveDialog || !window.arkive?.createArchive) return;
    try {
      const savePath = await window.arkive.saveArchiveDialog(opts.name);
      if (!savePath) return;
      setStatusMessage(`Creating ${savePath}...`);
      await window.arkive.createArchive({
        archive: savePath,
        inputs: opts.inputs,
        format: opts.format,
        level: opts.level,
        password: opts.password,
        threads: opts.threads,
        method: opts.zipMethod,
      });
      setStatusMessage(`Created archive ${savePath}`);
      // Automatically open the newly created archive
      const list = await window.arkive.listArchive(savePath);
      const info = await window.arkive.getArchiveInfo(savePath);
      setCurrentArchive(savePath);
      setEntries(list);
      setArchiveInfo(info);
      setCurrentPath('');
      setSelectedEntries(new Set());
    } catch (err: any) {
      alert(`Failed to create archive: ${err?.message || err}`);
      setStatusMessage('Creation failed');
    }
  };

  const handleExtractSubmit = async (opts: any) => {
    if (!window.arkive?.extractArchive || !currentArchive) return;
    try {
      setStatusMessage(`Extracting to ${opts.dest}...`);
      await window.arkive.extractArchive({
        archive: currentArchive,
        dest: opts.dest,
        password: opts.password,
        force: opts.overwrite,
      });
      setStatusMessage(`Extracted successfully to ${opts.dest}`);
      alert(`Successfully extracted archive to:\n${opts.dest}`);
    } catch (err: any) {
      alert(`Extraction failed: ${err?.message || err}`);
      setStatusMessage('Extraction failed');
    }
  };

  const handleTestArchive = async () => {
    if (!window.arkive?.testArchive || !currentArchive) return;
    try {
      setStatusMessage('Testing integrity...');
      const out = await window.arkive.testArchive(currentArchive);
      setStatusMessage('Integrity verified');
      alert(out || 'All entries verified successfully (CRC matched).');
    } catch (err: any) {
      alert(`Test failed: ${err?.message || err}`);
      setStatusMessage('Integrity test failed');
    }
  };

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

  const handlePreview = async (entry: Entry) => {
    if (entry.isDir) return;
    setPreviewEntry(entry);
    setIsPreviewLoading(true);
    setPreviewContent(null);

    if (window.arkive?.readEntry && currentArchive) {
      try {
        const text = await window.arkive.readEntry(currentArchive, entry.path);
        setPreviewContent(text);
      } catch (err: any) {
        setPreviewContent(`[Binary or unreadable content - ${entry.size} bytes]\nError: ${err?.message || err}`);
      } finally {
        setIsPreviewLoading(false);
      }
      return;
    }

    setPreviewContent(`File: ${entry.path}\nSize: ${entry.size} bytes\nCRC-32: ${entry.crc32 ? `0x${entry.crc32.toString(16).toUpperCase()}` : 'N/A'}`);
    setIsPreviewLoading(false);
  };

  const handleRunBench = async (config: any) => {
    setIsBenchRunning(true);
    setBenchProgressMsg('Running Rust benchmark engine on dataset...');

    if (window.arkive?.runBenchmark) {
      try {
        const report = await window.arkive.runBenchmark(config);
        setBenchReport(report);
      } catch (err: any) {
        alert(`Benchmark failed: ${err?.message || err}`);
      } finally {
        setIsBenchRunning(false);
      }
      return;
    }

    alert('Benchmark engine requires the native desktop runner.');
    setIsBenchRunning(false);
  };

  const handleRepair = async (archivePath: string, outputPath: string): Promise<RepairReport> => {
    if (window.arkive?.repairArchive) {
      return await window.arkive.repairArchive(archivePath, outputPath || null);
    }
    throw new Error('Repair engine requires the native desktop runner.');
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
          <span className="text-emerald-400 font-medium">
            {isDesktop ? 'Native Desktop Mode' : 'Web Preview Mode'}
          </span>
          <span className="text-slate-600">•</span>
          <span>Rust Engine v0.1.0</span>
        </div>
      </div>

      {/* Main Toolbar */}
      <Toolbar
        onOpen={handleOpenArchive}
        onCreate={handleCreateOpen}
        onExtract={() => setIsExtractOpen(true)}
        onTest={handleTestArchive}
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
        onSubmit={handleCreateSubmit}
        inputPaths={createInputs}
      />

      <ExtractModal
        isOpen={isExtractOpen}
        onClose={() => setIsExtractOpen(false)}
        onSubmit={handleExtractSubmit}
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
