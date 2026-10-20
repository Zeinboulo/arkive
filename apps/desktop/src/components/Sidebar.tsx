import React from 'react';
import {
  FolderOpen,
  Folder,
  Plus,
  Download,
  ShieldCheck,
  Info,
  Wrench,
  Gauge,
  Video,
  HardDrive,
  Check,
  Sun,
  Moon,
  Home,
  Monitor,
  FileText,
} from 'lucide-react';
import { QuickPlace } from '../types';
import { ArkiveLogo } from './ArkiveLogo';

interface SidebarProps {
  onOpen: () => void;
  onOpenFolder: () => void;
  onCreate: () => void;
  onExtract: () => void;
  onTest: () => void;
  onInfo: () => void;
  onRepair: () => void;
  onVideo: () => void;
  onToggleBench: () => void;
  hasArchive: boolean;
  benchActive: boolean;
  selectedCount: number;
  places: QuickPlace[];
  currentPath: string;
  onNavigate: (path: string) => void;
  shellActive: boolean;
  onToggleShell: () => void;
  theme: 'dusk' | 'paper';
  onToggleTheme: () => void;
}

const getPlaceIcon = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.includes('home')) return <Home size={15} />;
  if (lower.includes('desktop')) return <Monitor size={15} />;
  if (lower.includes('download')) return <Download size={15} />;
  if (lower.includes('document')) return <FileText size={15} />;
  return <HardDrive size={15} />;
};

export const Sidebar: React.FC<SidebarProps> = (p) => (
  <aside className="flex w-56 shrink-0 flex-col border-r border-slate-800/80 bg-slate-950 px-3 py-4 select-none">
    {/* Brand Header */}
    <div className="flex items-center justify-between px-2 pb-4">
      <ArkiveLogo size={30} withText />
      <button
        type="button"
        onClick={p.onToggleTheme}
        title={p.theme === 'dusk' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-850 hover:text-slate-100 transition"
      >
        {p.theme === 'dusk' ? <Sun size={15} /> : <Moon size={15} />}
      </button>
    </div>

    {/* Primary Action */}
    <div className="px-1 pb-4">
      <button
        type="button"
        onClick={p.onCreate}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 hover:bg-sky-500 px-3 py-2 text-[13px] font-medium text-white shadow-sm transition"
      >
        <Plus size={16} strokeWidth={2.2} />
        <span>{p.selectedCount > 0 ? `Compress (${p.selectedCount})` : 'New Archive'}</span>
      </button>
    </div>

    {/* Navigation List */}
    <nav className="flex-1 overflow-y-auto space-y-5 px-1">
      {/* Locations */}
      <div>
        <div className="px-2 pb-1.5 text-[11px] font-medium text-slate-500">
          Locations
        </div>
        <div className="space-y-0.5">
          {p.places.map((pl) => {
            const active =
              !p.benchActive && p.currentPath.toLowerCase() === pl.path.toLowerCase();
            return (
              <button
                key={pl.path}
                type="button"
                onClick={() => p.onNavigate(pl.path)}
                className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition ${
                  active
                    ? 'bg-sky-500/15 text-sky-400 font-medium'
                    : 'text-slate-300 hover:bg-slate-850 hover:text-slate-100'
                }`}
              >
                <span className={active ? 'text-sky-400' : 'text-slate-400'}>
                  {getPlaceIcon(pl.name)}
                </span>
                <span className="truncate">{pl.name}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={p.onOpenFolder}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] text-slate-400 hover:bg-slate-850 hover:text-slate-100 transition"
          >
            <Folder size={15} />
            <span>Choose Folder…</span>
          </button>
        </div>
      </div>

      {/* Archives & Tools */}
      <div>
        <div className="px-2 pb-1.5 text-[11px] font-medium text-slate-500">
          Tools
        </div>
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={p.onOpen}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] text-slate-300 hover:bg-slate-850 hover:text-slate-100 transition"
          >
            <FolderOpen size={15} className="text-slate-400" />
            <span>Open Archive…</span>
          </button>

          <button
            type="button"
            onClick={p.onExtract}
            disabled={!p.hasArchive && p.selectedCount === 0}
            className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition ${
              !p.hasArchive && p.selectedCount === 0
                ? 'text-slate-600 cursor-not-allowed'
                : 'text-slate-300 hover:bg-slate-850 hover:text-slate-100'
            }`}
          >
            <Download size={15} className="text-slate-400" />
            <span>Extract Files…</span>
          </button>

          <button
            type="button"
            onClick={p.onVideo}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] text-slate-300 hover:bg-slate-850 hover:text-slate-100 transition"
          >
            <Video size={15} className="text-slate-400" />
            <span>Compress Video</span>
          </button>

          <button
            type="button"
            onClick={p.onRepair}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] text-slate-300 hover:bg-slate-850 hover:text-slate-100 transition"
          >
            <Wrench size={15} className="text-slate-400" />
            <span>Repair Archive</span>
          </button>

          <button
            type="button"
            onClick={p.onToggleBench}
            className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition ${
              p.benchActive
                ? 'bg-sky-500/15 text-sky-400 font-medium'
                : 'text-slate-300 hover:bg-slate-850 hover:text-slate-100'
            }`}
          >
            <Gauge size={15} className={p.benchActive ? 'text-sky-400' : 'text-slate-400'} />
            <span>Speed Benchmark</span>
          </button>

          {p.hasArchive && (
            <>
              <button
                type="button"
                onClick={p.onTest}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] text-slate-300 hover:bg-slate-850 hover:text-slate-100 transition"
              >
                <ShieldCheck size={15} className="text-sky-400" />
                <span>Verify Integrity</span>
              </button>
              <button
                type="button"
                onClick={p.onInfo}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] text-slate-300 hover:bg-slate-850 hover:text-slate-100 transition"
              >
                <Info size={15} className="text-sky-400" />
                <span>Archive Details</span>
              </button>
            </>
          )}
        </div>
      </div>
    </nav>

    {/* Quiet Footer */}
    <div className="pt-3 border-t border-slate-800/70 px-1">
      <button
        type="button"
        onClick={p.onToggleShell}
        className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs text-slate-400 hover:bg-slate-850 hover:text-slate-200 transition"
      >
        <span>Explorer Context Menu</span>
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-medium ${
            p.shellActive ? 'text-sky-400' : 'text-slate-500'
          }`}
        >
          {p.shellActive && <Check size={12} />}
          <span>{p.shellActive ? 'Active' : 'Off'}</span>
        </span>
      </button>
    </div>
  </aside>
);
