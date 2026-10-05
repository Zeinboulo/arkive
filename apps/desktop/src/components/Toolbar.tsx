import React from 'react';
import {
  FolderOpen,
  PlusCircle,
  Download,
  ShieldCheck,
  Info,
  Wrench,
  Gauge,
  HardDrive,
  CheckCircle2,
  FolderPlus,
} from 'lucide-react';

interface ToolbarProps {
  onOpen: () => void;
  onOpenFolder: () => void;
  onCreate: () => void;
  onExtract: () => void;
  onTest: () => void;
  onInfo: () => void;
  onRepair: () => void;
  onBenchmark: () => void;
  hasArchive: boolean;
  selectedTab: 'files' | 'bench';
  setSelectedTab: (tab: 'files' | 'bench') => void;
  browserMode: 'archive' | 'explorer';
  onToggleBrowserMode: () => void;
  selectedCount: number;
  isContextMenuActive: boolean;
  onToggleContextMenu: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  onOpen,
  onOpenFolder,
  onCreate,
  onExtract,
  onTest,
  onInfo,
  onRepair,
  onBenchmark,
  hasArchive,
  selectedTab,
  setSelectedTab,
  browserMode,
  onToggleBrowserMode,
  selectedCount,
  isContextMenuActive,
  onToggleContextMenu,
}) => {
  return (
    <div className="bg-slate-800/90 backdrop-blur border-b border-slate-700/60 px-4 py-2.5 flex items-center justify-between text-sm select-none">
      <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
        {/* Open Archive */}
        <button
          onClick={onOpen}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md hover:bg-slate-700/70 text-slate-200 transition font-medium text-xs active:scale-95"
          title="Open an archive file (.zip, .7z, .rar, .tar, etc.)"
        >
          <FolderOpen className="w-4 h-4 text-sky-400" />
          <span>Open Archive</span>
        </button>

        {/* Browse Folder */}
        <button
          onClick={onOpenFolder}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md hover:bg-slate-700/70 text-slate-200 transition font-medium text-xs active:scale-95"
          title="Open and explore a folder from disk"
        >
          <FolderPlus className="w-4 h-4 text-indigo-400" />
          <span>Browse Folder</span>
        </button>

        {/* Add (Compress) */}
        <button
          onClick={onCreate}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md hover:bg-slate-700/70 text-slate-200 transition font-medium text-xs active:scale-95 bg-emerald-500/10 border border-emerald-500/20"
          title="Create a new compressed archive (folders and files)"
        >
          <PlusCircle className="w-4 h-4 text-emerald-400" />
          <span>{selectedCount > 0 ? `Add (${selectedCount})` : 'Add / Compress'}</span>
        </button>

        {/* Extract To */}
        <button
          onClick={onExtract}
          disabled={!hasArchive && selectedCount === 0}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition font-medium text-xs active:scale-95 ${
            hasArchive || selectedCount > 0
              ? 'hover:bg-slate-700/70 text-slate-200'
              : 'text-slate-500 cursor-not-allowed'
          }`}
          title="Extract current archive or selected archive file"
        >
          <Download className="w-4 h-4 text-amber-400" />
          <span>Extract To</span>
        </button>

        {/* Test Integrity */}
        <button
          onClick={onTest}
          disabled={!hasArchive}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition font-medium text-xs active:scale-95 ${
            hasArchive
              ? 'hover:bg-slate-700/70 text-slate-200'
              : 'text-slate-500 cursor-not-allowed'
          }`}
          title="Verify archive integrity with CRC check"
        >
          <ShieldCheck className="w-4 h-4 text-teal-400" />
          <span>Test</span>
        </button>

        <div className="h-4 w-px bg-slate-700 mx-1 hidden sm:block" />

        {/* Info */}
        <button
          onClick={onInfo}
          disabled={!hasArchive}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition font-medium text-xs active:scale-95 ${
            hasArchive
              ? 'hover:bg-slate-700/70 text-slate-200'
              : 'text-slate-500 cursor-not-allowed'
          }`}
          title="View archive compression ratio and details"
        >
          <Info className="w-4 h-4 text-indigo-400" />
          <span>Info</span>
        </button>

        {/* Repair */}
        <button
          onClick={onRepair}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md hover:bg-slate-700/70 text-slate-200 transition font-medium text-xs active:scale-95"
          title="Repair corrupted ZIP central directory"
        >
          <Wrench className="w-4 h-4 text-rose-400" />
          <span>Repair</span>
        </button>

        <div className="h-4 w-px bg-slate-700 mx-1 hidden sm:block" />

        {/* Benchmark Dashboard */}
        <button
          onClick={() => {
            setSelectedTab(selectedTab === 'bench' ? 'files' : 'bench');
            if (selectedTab === 'files') onBenchmark();
          }}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition font-medium text-xs active:scale-95 ${
            selectedTab === 'bench'
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
              : 'hover:bg-slate-700/70 text-slate-200'
          }`}
          title="Data Engineer Benchmark Dashboard"
        >
          <Gauge className="w-4 h-4 text-purple-400" />
          <span>Benchmark</span>
          <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1 py-0.2 rounded border border-purple-500/30">
            Data Eng
          </span>
        </button>
      </div>

      <div className="flex items-center space-x-2">
        {/* Windows Explorer Context Menu status */}
        <button
          onClick={onToggleContextMenu}
          className={`hidden md:flex items-center space-x-1 px-2.5 py-1 rounded text-[11px] font-medium border transition ${
            isContextMenuActive
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
              : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
          }`}
          title="Toggle Windows Explorer right-click context menu integration"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>WinRAR Menu: Active</span>
        </button>

        {/* View Switcher: Files vs Benchmark */}
        <div className="flex items-center space-x-1 bg-slate-900/60 rounded-lg p-0.5 border border-slate-700/50">
          <button
            onClick={() => setSelectedTab('files')}
            className={`px-2.5 py-1 rounded text-xs transition font-medium ${
              selectedTab === 'files'
                ? 'bg-slate-700 text-sky-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            File Manager
          </button>
          <button
            onClick={() => setSelectedTab('bench')}
            className={`px-2.5 py-1 rounded text-xs transition font-medium ${
              selectedTab === 'bench'
                ? 'bg-slate-700 text-purple-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Benchmark
          </button>
        </div>
      </div>
    </div>
  );
};
