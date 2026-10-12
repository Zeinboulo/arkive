import React from 'react';
import {
  FolderOpen,
  Folder,
  PlusCircle,
  Download,
  ShieldCheck,
  Info,
  Wrench,
  Gauge,
  Video,
  HardDrive,
  Power,
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
    className={`group flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors ${
      disabled
        ? 'cursor-not-allowed text-slate-600'
        : active
        ? 'bg-sky-500/15 text-sky-300'
        : 'text-slate-300 hover:bg-slate-800 hover:text-slate-50'
    }`}
  >
    <span className={disabled ? 'text-slate-600' : 'text-sky-400'}>{icon}</span>
    <span className="flex-1 truncate">{label}</span>
    {badge ? (
      <span className="rounded bg-sky-500/20 px-1.5 text-[10px] font-semibold text-sky-300">
        {badge}
      </span>
    ) : null}
  </button>
);

const Heading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="px-2.5 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
    {children}
  </div>
);

export const Sidebar: React.FC<SidebarProps> = (p) => (
  <aside className="flex w-52 shrink-0 flex-col border-r border-slate-800 bg-slate-950">
    <div className="flex items-center px-3.5 pb-2.5 pt-3.5 border-b border-stone-850/80">
      <ArkiveLogo size={28} withText />
    </div>

    <nav className="flex-1 overflow-y-auto px-2 pb-2">
      <Heading>Archives</Heading>
      <Item icon={<FolderOpen size={15} />} label="Open archive" onClick={p.onOpen} />
      <Item icon={<Folder size={15} />} label="Browse folder" onClick={p.onOpenFolder} />
      <Item
        icon={<PlusCircle size={15} />}
        label={p.selectedCount > 0 ? 'Compress selection' : 'New archive'}
        badge={p.selectedCount || undefined}
        onClick={p.onCreate}
      />
      <Item
        icon={<Download size={15} />}
        label="Extract"
        onClick={p.onExtract}
        disabled={!p.hasArchive && p.selectedCount === 0}
      />
      <Item icon={<ShieldCheck size={15} />} label="Verify" onClick={p.onTest} disabled={!p.hasArchive} />

      <Heading>Media</Heading>
      <Item icon={<Video size={15} />} label="Compress video" onClick={p.onVideo} />

      <Heading>Tools</Heading>
      <Item icon={<Info size={15} />} label="Archive info" onClick={p.onInfo} disabled={!p.hasArchive} />
      <Item icon={<Wrench size={15} />} label="Repair ZIP" onClick={p.onRepair} />
      <Item
        icon={<Gauge size={15} />}
        label="Benchmark"
        onClick={p.onToggleBench}
        active={p.benchActive}
      />

      {p.places.length > 0 && (
        <>
          <Heading>Places</Heading>
          {p.places.map((pl) => (
            <Item
              key={pl.path}
              icon={<HardDrive size={15} />}
              label={pl.name}
              onClick={() => p.onNavigate(pl.path)}
              active={!p.benchActive && p.currentPath.toLowerCase() === pl.path.toLowerCase()}
            />
          ))}
        </>
      )}
    </nav>

    <button
      onClick={p.onToggleShell}
      title="Add or remove Arkive from the Windows Explorer right-click menu"
      className="mx-2 mb-3 flex items-center gap-2 rounded-md border border-slate-800 px-2.5 py-1.5 text-[11px] text-slate-400 transition-colors hover:border-slate-700 hover:text-slate-200"
    >
      <Power size={13} className={p.shellActive ? 'text-emerald-400' : 'text-slate-600'} />
      <span>Explorer menu: {p.shellActive ? 'on' : 'off'}</span>
    </button>
  </aside>
);
