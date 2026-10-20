import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { FileBrowser } from './components/FileBrowser';
import { BenchmarkView } from './components/BenchmarkView';
import { CreateModal, CreateModalSubmitData } from './components/CreateModal';
import { ExtractModal, ExtractModalSubmitData } from './components/ExtractModal';
import { RepairModal } from './components/RepairModal';
import { PreviewModal } from './components/PreviewModal';
import { InfoModal } from './components/InfoModal';
import { VideoModal } from './components/VideoModal';
import { StatusBar } from './components/StatusBar';
import { RadialZipChoice } from './components/RadialZipWheel';
import { isArchivePath, isVideoPath } from './format';
import {
  Entry,
  FsItem,
  QuickPlace,
  ArchiveInfo,
  BenchConfig,
  BenchReport,
  RepairReport,
  ExternalAction,
} from './types';

export const App: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState<'files' | 'bench'>('files');
  const [browserMode, setBrowserMode] = useState<'archive' | 'explorer'>('explorer');
  const [theme, setTheme] = useState<'dusk' | 'paper'>(() => {
    const saved = localStorage.getItem('arkive-theme');
    return saved === 'paper' ? 'paper' : 'dusk';
  });

  // Archive Mode State
  const [currentArchive, setCurrentArchive] = useState<string | null>(null);
  const [archiveEntries, setArchiveEntries] = useState<Entry[]>([]);
  const [archiveInfo, setArchiveInfo] = useState<ArchiveInfo | null>(null);
  const [archiveSubPath, setArchiveSubPath] = useState('');

  // Explorer Mode State
  const [currentFsPath, setCurrentFsPath] = useState('');
  const [fsItems, setFsItems] = useState<FsItem[]>([]);
  const [quickPlaces, setQuickPlaces] = useState<QuickPlace[]>([]);

  // Selection
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());

  // Shell context menu active state
  const [isContextMenuActive, setIsContextMenuActive] = useState(true);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isExtractOpen, setIsExtractOpen] = useState(false);
  const [isRepairOpen, setIsRepairOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [videoModalPath, setVideoModalPath] = useState<string | null>(null);
  const [createInputs, setCreateInputs] = useState<string[]>([]);

  // Preview
  const [previewEntry, setPreviewEntry] = useState<Entry | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // Benchmark
  const [isBenchRunning, setIsBenchRunning] = useState(false);
  const [benchProgressMsg, setBenchProgressMsg] = useState('');
  const [benchReport, setBenchReport] = useState<BenchReport | null>(null);

  // Status & Background Activity
  const [statusMessage, setStatusMessage] = useState('Ready');
  const [isBusy, setIsBusy] = useState(false);
  const [recentArchivePath, setRecentArchivePath] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('arkive-theme', theme);
  }, [theme]);

  // Load a local folder into Explorer Mode
  const loadDirectory = async (target?: string) => {
    if (!window.arkive?.readDirectory) return;
    try {
      setStatusMessage(`Browsing ${target || 'local storage'}...`);
      const res = await window.arkive.readDirectory(target);
      setCurrentFsPath(res.currentPath);
      setFsItems(res.items);
      setSelectedEntries(new Set());
      setBrowserMode('explorer');
      setStatusMessage(`Browsing ${res.currentPath} (${res.items.length} items)`);
    } catch (err: any) {
      console.error('Error browsing folder:', err);
      setStatusMessage(`Error browsing folder: ${err?.message || err}`);
    }
  };

  // Open an archive into Archive Mode
  const openArchive = async (filePath: string) => {
    if (!window.arkive?.listArchive || !window.arkive?.getArchiveInfo) return;
    try {
      setIsBusy(true);
      setStatusMessage(`Opening ${filePath}...`);
      const list = await window.arkive.listArchive(filePath);
      const info = await window.arkive.getArchiveInfo(filePath);
      setCurrentArchive(filePath);
      setArchiveEntries(list);
      setArchiveInfo(info);
      setArchiveSubPath('');
      setSelectedEntries(new Set());
      setBrowserMode('archive');
      setRecentArchivePath(null);
      setStatusMessage(`Opened ${filePath} (${list.length} entries)`);
    } catch (err: any) {
      alert(`Failed to open archive:\n${err?.message || err}`);
      setStatusMessage('Error opening archive');
    } finally {
      setIsBusy(false);
    }
  };

  const handleOpenVideoCompress = (targetPath?: string) => {
    const firstSelected = Array.from(selectedEntries)[0];
    const p = targetPath ?? (firstSelected && isVideoPath(firstSelected) ? firstSelected : null);
    setVideoModalPath(p);
    setIsVideoModalOpen(true);
  };

  const handleExternalAction = async (act: ExternalAction) => {
    if (act.action === 'open') {
      await openArchive(act.path);
    } else if (act.action === 'browse') {
      await loadDirectory(act.path);
    } else if (act.action === 'create') {
      if (isVideoPath(act.path)) {
        handleOpenVideoCompress(act.path);
      } else {
        setCreateInputs([act.path]);
        setIsCreateOpen(true);
      }
    } else if (act.action === 'extract') {
      await openArchive(act.path);
      setIsExtractOpen(true);
    }
  };

  // Initial startup hook
  useEffect(() => {
    if (window.arkive?.getQuickPlaces) {
      window.arkive.getQuickPlaces().then((places) => setQuickPlaces(places));
    }

    if (window.arkive?.isContextMenuRegistered) {
      window.arkive.isContextMenuRegistered().then((reg) => setIsContextMenuActive(reg));
    }

    if (window.arkive?.getStartupAction) {
      window.arkive.getStartupAction().then((act) => {
        if (act) {
          handleExternalAction(act);
        } else {
          loadDirectory();
        }
      });
    } else {
      loadDirectory();
    }

    let unsubscribe: (() => void) | undefined;
    if (window.arkive?.onExternalAction) {
      unsubscribe = window.arkive.onExternalAction((act) => {
        handleExternalAction(act);
      });
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleOpenArchiveDialog = async () => {
    if (!window.arkive?.openArchiveDialog) return;
    const filePath = await window.arkive.openArchiveDialog();
    if (filePath) {
      openArchive(filePath);
    }
  };

  const handleOpenFolderDialog = async () => {
    if (!window.arkive?.openFolderDialog) return;
    const folder = await window.arkive.openFolderDialog();
    if (folder) {
      loadDirectory(folder);
    }
  };

  const handleCreateOpen = () => {
    if (browserMode === 'explorer' && selectedEntries.size > 0) {
      setCreateInputs(Array.from(selectedEntries));
    } else {
      setCreateInputs([]);
    }
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = async (opts: CreateModalSubmitData) => {
    if (!window.arkive?.saveArchiveDialog || !window.arkive?.createArchive) return;
    try {
      const savePath = await window.arkive.saveArchiveDialog(opts.name);
      if (!savePath) return;
      setIsBusy(true);
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
      await openArchive(savePath);
    } catch (err: any) {
      alert(`Failed to create archive:\n${err?.message || err}`);
      setStatusMessage('Creation failed');
    } finally {
      setIsBusy(false);
    }
  };

  // Instant Compression via Right-Click Hold Radial Wheel
  const handleQuickCompressChoice = async (choice: RadialZipChoice, targetPath: string) => {
    if (choice.isCustomModal) {
      setCreateInputs([targetPath]);
      setIsCreateOpen(true);
      return;
    }

    if (!window.arkive?.createArchive) {
      setCreateInputs([targetPath]);
      setIsCreateOpen(true);
      return;
    }

    const cleanTarget = targetPath.replace(/[\\/]$/, '').replace(/\\/g, '/');
    const outputArchivePath = `${cleanTarget}.${choice.format}`;
    const baseName = cleanTarget.split('/').pop() || 'archive';

    try {
      setIsBusy(true);
      setRecentArchivePath(null);
      setStatusMessage(`Packing "${baseName}" into ${baseName}.${choice.format} (${choice.label})...`);

      await window.arkive.createArchive({
        archive: outputArchivePath,
        inputs: [targetPath],
        format: choice.format,
        level: choice.level,
        threads: 0,
        method: choice.zipMethod,
      });

      if (currentFsPath && window.arkive?.readDirectory) {
        const res = await window.arkive.readDirectory(currentFsPath);
        setFsItems(res.items);
        setSelectedEntries(new Set([outputArchivePath]));
      }

      setRecentArchivePath(outputArchivePath);
      setStatusMessage(`Packed ${baseName}.${choice.format}`);
    } catch (err: any) {
      alert(`Failed to compress folder:\n${err?.message || err}`);
      setStatusMessage('Quick compression failed');
    } finally {
      setIsBusy(false);
    }
  };

  const handleExtractOpen = () => {
    if (browserMode === 'archive' && currentArchive) {
      setIsExtractOpen(true);
      return;
    }
    if (browserMode === 'explorer') {
      const selected = Array.from(selectedEntries);
      const archiveCandidate = selected.find(isArchivePath);
      if (archiveCandidate) {
        openArchive(archiveCandidate).then(() => setIsExtractOpen(true));
        return;
      }
    }
    alert('Please select or open an archive to extract.');
  };

  const handleExtractSubmit = async (opts: ExtractModalSubmitData) => {
    if (!window.arkive?.extractArchive || !currentArchive) return;
    try {
      setIsBusy(true);
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
      alert(`Extraction failed:\n${err?.message || err}`);
      setStatusMessage('Extraction failed');
    } finally {
      setIsBusy(false);
    }
  };

  const handleTestArchive = async () => {
    if (!window.arkive?.testArchive || !currentArchive) return;
    try {
      setIsBusy(true);
      setStatusMessage('Testing integrity...');
      const out = await window.arkive.testArchive(currentArchive);
      setStatusMessage('Integrity verified');
      alert(out || 'All entries verified successfully (CRC-32 checksums matched).');
    } catch (err: any) {
      alert(`Test failed:\n${err?.message || err}`);
      setStatusMessage('Integrity test failed');
    } finally {
      setIsBusy(false);
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
        setPreviewContent(`[Binary or encrypted content - ${entry.size} bytes]\nError: ${err?.message || err}`);
      } finally {
        setIsPreviewLoading(false);
      }
      return;
    }

    setPreviewContent(`File: ${entry.path}\nSize: ${entry.size} bytes\nCRC: ${entry.crc32 || 'N/A'}`);
    setIsPreviewLoading(false);
  };

  const handleRunBench = async (config: BenchConfig) => {
    setIsBenchRunning(true);
    setBenchProgressMsg('Running Rust benchmark engine on dataset...');

    if (window.arkive?.runBenchmark) {
      try {
        const report = await window.arkive.runBenchmark(config);
        setBenchReport(report);
      } catch (err: any) {
        alert(`Benchmark failed:\n${err?.message || err}`);
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

  const handleToggleContextMenu = async () => {
    if (!window.arkive?.registerContextMenu || !window.arkive?.unregisterContextMenu) return;
    if (isContextMenuActive) {
      const ok = await window.arkive.unregisterContextMenu();
      if (ok) {
        setIsContextMenuActive(false);
        alert('Windows Explorer context menu uninstalled.');
      }
    } else {
      const ok = await window.arkive.registerContextMenu();
      if (ok) {
        setIsContextMenuActive(true);
        alert('Windows Explorer context menu registered successfully! Right-click any file or folder in Windows Explorer to see Arkive.');
      }
    }
  };

  const handleDropFiles = (paths: string[]) => {
    if (paths.length === 0) return;
    if (paths.length === 1) {
      const p = paths[0];
      if (isArchivePath(p)) {
        openArchive(p);
        return;
      }
    }
    setCreateInputs(paths);
    setIsCreateOpen(true);
  };

  const totalFiles =
    browserMode === 'archive'
      ? archiveEntries.filter((e) => !e.isDir).length
      : fsItems.filter((i) => !i.isDir).length;

  const totalBytes =
    browserMode === 'archive'
      ? archiveEntries.reduce((sum, e) => sum + e.size, 0)
      : fsItems.reduce((sum, i) => sum + i.size, 0);

  const goToFiles = (path: string) => {
    setSelectedTab('files');
    loadDirectory(path);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-900 text-slate-100">
      <Sidebar
        onOpen={handleOpenArchiveDialog}
        onOpenFolder={handleOpenFolderDialog}
        onCreate={handleCreateOpen}
        onExtract={handleExtractOpen}
        onTest={handleTestArchive}
        onInfo={() => setIsInfoOpen(true)}
        onRepair={() => setIsRepairOpen(true)}
        onVideo={() => handleOpenVideoCompress()}
        onToggleBench={() => setSelectedTab(selectedTab === 'bench' ? 'files' : 'bench')}
        hasArchive={Boolean(currentArchive)}
        benchActive={selectedTab === 'bench'}
        selectedCount={selectedEntries.size}
        places={quickPlaces}
        currentPath={currentFsPath}
        onNavigate={goToFiles}
        shellActive={isContextMenuActive}
        onToggleShell={handleToggleContextMenu}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dusk' ? 'paper' : 'dusk'))}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        {selectedTab === 'files' ? (
          <FileBrowser
            mode={browserMode}
            onCloseArchive={() => setBrowserMode('explorer')}
            entries={archiveEntries}
            archivePath={archiveSubPath}
            onNavigateArchive={setArchiveSubPath}
            onPreviewArchive={handlePreview}
            fsItems={fsItems}
            currentFsPath={currentFsPath}
            onNavigateFs={loadDirectory}
            onOpenArchiveFile={openArchive}
            onCompressVideoFile={handleOpenVideoCompress}
            onQuickCompressChoice={handleQuickCompressChoice}
            selectedItems={selectedEntries}
            onToggleSelect={handleToggleSelect}
            onDropFiles={handleDropFiles}
          />
        ) : (
          <BenchmarkView
            onRunBench={handleRunBench}
            isRunning={isBenchRunning}
            progressMsg={benchProgressMsg}
            report={benchReport}
          />
        )}

        <StatusBar
          totalFiles={totalFiles}
          totalBytes={totalBytes}
          selectedCount={selectedEntries.size}
          statusMessage={statusMessage}
          isBusy={isBusy}
          recentArchivePath={recentArchivePath}
          onOpenRecentArchive={openArchive}
        />
      </main>

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
      <InfoModal isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} info={archiveInfo} />
      <VideoModal
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
        initialVideoPath={videoModalPath}
      />
    </div>
  );
};

export default App;
