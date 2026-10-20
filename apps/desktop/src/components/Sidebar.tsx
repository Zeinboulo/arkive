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
  Power,
  Sun,
  Moon,
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

interface ItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  badge?: string | number;
}

const Item: React.FC<ItemProps> = ({ icon, label, onClick, disabled, active, badge }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`group flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-left text-[12.5px] font-medium transition-all ${
      disabled
        ? 'cursor-not-allowed text-slate-600 opacity-60'
        : active
        ? 'bg-sky-500/15 text-sky-400 shadow-sm ring-1 ring-sky-500/25'
        : 'text-slate-300 hover:bg-slate-800/80 hover:text-slate-50'
    }`}
  >
    <span
      className={`transition-colors ${
        disabled ? 'text-slate-600' : active ? 'text-sky-400' : 'text-slate-400 group-hover:text-sky-400'
      }`}
    >
      {icon}
    </span>
    <span className="flex-1 truncate">{label}</span>
    {badge ? (
      <span className="rounded-full bg-sky-500/20 px-1.5 py-0.2 text-[10px] font-semibold text-sky-300">
        {badge}
      </span>
    ) : null}
  </button>
);

const Heading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
    {children}
  </div>
);

export const Sidebar: React.FC<SidebarProps> = (p) => (
  <aside className="flex w-56 shrink-0 flex-col border-r border-slate-800 bg-slate-950/90 px-2.5 py-3">
    {/* Brand & Theme Switcher */}
    <div className="flex items-center justify-between px-1.5 pb-3 border-b border-slate-800/80">
      <ArkiveLogo size={28} withText />
      <button
        onClick={p.onToggleTheme}
        title={
          p.theme === 'dusk'
            ? 'Switch to Warm Paper (Daylight Eye-Care)'
            : 'Switch to Soft Dusk (Low-Glare Dark)'
        }
        className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 transition hover:border-slate-700 hover:text-sky-400"
      >
        {p.theme === 'dusk' ? <Sun size={14} /> : <Moon size={14} />}
      </button>
    </div>

    {/* Primary Action Button */}
    <div className="pt-3 px-1">
      <button
        onClick={p.onCreate}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-500 active:scale-[0.99]"
      >
        <Plus size={15} strokeWidth={2.5} />
        <span>{p.selectedCount > 0 ? `Compress (${p.selectedCount})` : 'New Archive'}</span>
      </button>
    </div>

    <nav className="flex-1 overflow-y-auto pt-1 pb-2 space-y-0.5">
      <Heading>Workspace</Heading>
      <Item icon={<FolderOpen size={15} />} label="Open Archive…" onClick={p.onOpen} />
      <Item icon={<Folder size={15} />} label="Browse Folder…" onClick={p.onOpenFolder} />
      <Item
        icon={<Download size={15} />}
        label="Extract Archive"
        onClick={p.onExtract}
        disabled={!p.hasArchive && p.selectedCount === 0}
      />

      <Heading>Utilities</Heading>
      <Item icon={<Video size={15} />} label="Video Compressor" onClick={p.onVideo} />
      <Item icon={<Wrench size={15} />} label="Repair Broken ZIP" onClick={p.onRepair} />
      <Item icon={<ShieldCheck size={15} />} label="Verify Integrity" onClick={p.onTest} disabled={!p.hasArchive} />
      <Item icon={<Info size={15} />} label="Archive Details" onClick={p.onInfo} disabled={!p.hasArchive} />
      <Item
        icon={<Gauge size={15} />}
        label="Codec Benchmark"
        onClick={p.onToggleBench}
        active={p.benchActive}
      />

      {p.places.length > 0 && (
        <>
          <Heading>Quick Places</Heading>
          {p.places.map((pl) => (
            <Item
              key={pl.path}
              icon={<HardDrive size={14} />}
              label={pl.name}
              onClick={() => p.onNavigate(pl.path)}
              active={!p.benchActive && p.currentPath.toLowerCase() === pl.path.toLowerCase()}
            />
          ))}
        </>
      )}
    </nav>

    {/* Footer Controls */}
    <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
      <button
        onClick={p.onToggleShell}
        title="Add or remove Arkive from the Windows Explorer right-click menu"
        className="flex w-full items-center justify-between rounded-lg border border-slate-800/90 bg-slate-900/70 px-3 py-1.5 text-[11px] text-slate-400 transition-colors hover:border-slate-700 hover:text-slate-200"
      >
        <span className="flex items-center gap-2">
          <Power size={12} className={p.shellActive ? 'text-sky-400' : 'text-slate-500'} />
          <span>Explorer Shell Menu</span>
        </span>
        <span
          className={`rounded px-1.5 py-0.2 text-[9.5px] font-semibold uppercase ${
            p.shellActive ? 'bg-sky-500/15 text-sky-400' : 'bg-slate-800 text-slate-500'
          }`}
        >
          {p.shellActive ? 'On' : 'Off'}
        </span>
      </button>
    </div>
  </aside>
);
