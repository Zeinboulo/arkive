import React from 'react';
import {
  FolderOpen,
  PlusCircle,
  Download,
  ShieldCheck,
  Info,
  Wrench,
  Gauge,
  Settings,
  Sparkles,
} from 'lucide-react';

interface ToolbarProps {
  onOpen: () => void;
  onCreate: () => void;
  onExtract: () => void;
  onTest: () => void;
  onInfo: () => void;
  onRepair: () => void;
  onBenchmark: () => void;
  hasArchive: boolean;
  selectedTab: 'files' | 'bench';
  setSelectedTab: (tab: 'files' | 'bench') => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  onOpen,
  onCreate,
  onExtract,
  onTest,
  onInfo,
  onRepair,
  onBenchmark,
  hasArchive,
  selectedTab,
  setSelectedTab,
}) => {
  return (
    <div className="bg-slate-800/90 backdrop-blur border-b border-slate-700/60 px-4 py-2.5 flex items-center justify-between text-sm select-none">
      <div className="flex items-center space-x-1.5">
        <button
          onClick={onOpen}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md hover:bg-slate-700/70 text-slate-200 transition font-medium text-xs active:scale-95"
          title="Open archive from disk"
        >
          <FolderOpen className="w-4 h-4 text-sky-400" />
          <span>Open</span>
        </button>

        <button
          onClick={onCreate}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md hover:bg-slate-700/70 text-slate-200 transition font-medium text-xs active:scale-95"
          title="Create a new compressed archive"
        >
          <PlusCircle className="w-4 h-4 text-emerald-400" />
          <span>Add</span>
        </button>

        <button
          onClick={onExtract}
          disabled={!hasArchive}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition font-medium text-xs active:scale-95 ${
            hasArchive
              ? 'hover:bg-slate-700/70 text-slate-200'
              : 'text-slate-500 cursor-not-allowed'
          }`}
          title="Extract current archive"
        >
          <Download className="w-4 h-4 text-amber-400" />
          <span>Extract To</span>
        </button>

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

        <div className="h-4 w-px bg-slate-700 mx-1" />

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

        <button
          onClick={onRepair}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md hover:bg-slate-700/70 text-slate-200 transition font-medium text-xs active:scale-95"
          title="Repair corrupted ZIP central directory"
        >
          <Wrench className="w-4 h-4 text-rose-400" />
          <span>Repair</span>
        </button>

        <div className="h-4 w-px bg-slate-700 mx-1" />

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
          <span>Benchmark Engine</span>
          <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1 py-0.2 rounded border border-purple-500/30">
            Data Eng
          </span>
        </button>
      </div>

      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-1 bg-slate-900/60 rounded-lg p-0.5 border border-slate-700/50">
          <button
            onClick={() => setSelectedTab('files')}
            className={`px-2.5 py-1 rounded text-xs transition font-medium ${
              selectedTab === 'files'
                ? 'bg-slate-700 text-sky-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Archive View
          </button>
          <button
            onClick={() => setSelectedTab('bench')}
            className={`px-2.5 py-1 rounded text-xs transition font-medium ${
              selectedTab === 'bench'
                ? 'bg-slate-700 text-purple-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Benchmark Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
