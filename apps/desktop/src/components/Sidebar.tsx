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
  Terminal,
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

interface ToolBtnProps {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  primary?: boolean;
}

const ToolBtn: React.FC<ToolBtnProps> = ({
  icon,
  label,
  shortcut,
  onClick,
  disabled,
  active,
  primary,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11.5px] font-medium border transition-colors shrink-0 ${
      disabled
        ? 'cursor-not-allowed border-transparent text-slate-600 opacity-50'
        : primary
        ? 'bg-sky-600 hover:bg-sky-500 text-white border-sky-500/80 shadow-sm'
        : active
        ? 'bg-slate-800 text-sky-400 border-sky-500/50'
        : 'bg-slate-850 hover:bg-slate-800 text-slate-200 border-slate-750 hover:border-slate-600'
    } rounded`}
  >
    <span className={primary ? 'text-white' : active ? 'text-sky-400' : 'text-slate-400'}>
      {icon}
    </span>
    <span>{label}</span>
    {shortcut && (
      <kbd
        className={`ml-0.5 px-1 py-0.2 text-[9.5px] font-mono rounded-sm border ${
          primary
            ? 'bg-sky-700/70 border-sky-400/40 text-sky-100'
            : 'bg-slate-900 border-slate-700 text-slate-400'
        }`}
      >
        {shortcut}
      </kbd>
    )}
  </button>
);

export const Sidebar: React.FC<SidebarProps> = (p) => (
  <header className="flex flex-col shrink-0 border-b border-slate-800 bg-slate-950 select-none">
    {/* Row 1: Primary Hardware Command Bar */}
    <div className="flex items-center justify-between gap-2 px-3 h-11 border-b border-slate-850">
      {/* Left: Brand & View Switcher */}
      <div className="flex items-center gap-3 shrink-0">
        <ArkiveLogo size={22} withText />

        <div className="h-4 w-[1px] bg-slate-800" />

        {/* Segmented Workspace Switcher */}
        <div className="inline-flex rounded border border-slate-800 bg-slate-900 p-0.5">
          <button
            type="button"
            onClick={() => {
              if (p.benchActive) p.onToggleBench();
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-mono uppercase tracking-wider rounded-sm transition ${
              !p.benchActive
                ? 'bg-slate-800 text-slate-50 font-semibold border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Terminal size={12} className={!p.benchActive ? 'text-sky-400' : 'text-slate-500'} />
            <span>Commander</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (!p.benchActive) p.onToggleBench();
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-mono uppercase tracking-wider rounded-sm transition ${
              p.benchActive
                ? 'bg-slate-800 text-slate-50 font-semibold border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Gauge size={12} className={p.benchActive ? 'text-sky-400' : 'text-slate-500'} />
            <span>Benchmark</span>
          </button>
        </div>
      </div>

      {/* Center: Mechanical Action Toolbar */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1">
        <ToolBtn
          primary
          icon={<Plus size={13} strokeWidth={2.5} />}
          label={p.selectedCount > 0 ? `Pack Selected (${p.selectedCount})` : 'Pack Archive'}
          shortcut="N"
          onClick={p.onCreate}
        />
        <ToolBtn
          icon={<Download size={13} />}
          label="Extract"
          shortcut="E"
          onClick={p.onExtract}
          disabled={!p.hasArchive && p.selectedCount === 0}
        />
        <ToolBtn
          icon={<FolderOpen size={13} />}
          label="Open Archive"
          shortcut="O"
          onClick={p.onOpen}
        />

        <div className="h-4 w-[1px] bg-slate-800 mx-0.5" />

        <ToolBtn
          icon={<Video size={13} />}
          label="Video Studio"
          onClick={p.onVideo}
        />
        <ToolBtn
          icon={<Wrench size={13} />}
          label="Repair ZIP"
          onClick={p.onRepair}
        />

        {p.hasArchive && (
          <>
            <div className="h-4 w-[1px] bg-slate-800 mx-0.5" />
            <ToolBtn
              icon={<ShieldCheck size={13} />}
              label="Verify CRC"
              onClick={p.onTest}
            />
            <ToolBtn
              icon={<Info size={13} />}
              label="Header Info"
              onClick={p.onInfo}
            />
          </>
        )}
      </div>

      {/* Right: System & Eye-Care Surface Controls */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={p.onToggleShell}
          title="Register or unregister Arkive in the Windows Explorer right-click menu"
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-slate-800 bg-slate-900 hover:border-slate-700 text-[10.5px] font-mono text-slate-300 transition"
        >
          <Power size={11} className={p.shellActive ? 'text-emerald-400' : 'text-slate-500'} />
          <span className="hidden xl:inline text-slate-400">SHELL:</span>
          <span className={p.shellActive ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
            {p.shellActive ? 'ON' : 'OFF'}
          </span>
        </button>

        <button
          type="button"
          onClick={p.onToggleTheme}
          title={
            p.theme === 'dusk'
              ? 'Switch to Archival Paper (Warm Light Mode)'
              : 'Switch to Anodized Dusk (Warm Matte Dark Mode)'
          }
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-slate-800 bg-slate-900 hover:border-slate-700 text-[10.5px] font-mono text-slate-200 transition"
        >
          {p.theme === 'dusk' ? (
            <>
              <Sun size={12} className="text-sky-400" />
              <span>PAPER</span>
            </>
          ) : (
            <>
              <Moon size={12} className="text-sky-500" />
              <span>DUSK</span>
            </>
          )}
        </button>
      </div>
    </div>

    {/* Row 2: Quick Mounts / Drives Strip */}
    {!p.benchActive && (
      <div className="flex items-center justify-between gap-2 px-3 h-8 bg-slate-900/90 text-[11px]">
        <div className="flex items-center gap-1 overflow-x-auto">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mr-1">
            MOUNTS //
          </span>
          {p.places.map((pl) => {
            const isActive = p.currentPath.toLowerCase() === pl.path.toLowerCase();
            return (
              <button
                key={pl.path}
                type="button"
                onClick={() => p.onNavigate(pl.path)}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm font-mono text-[11px] transition border ${
                  isActive
                    ? 'bg-slate-800 text-sky-400 border-slate-700 font-semibold'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-850 border-transparent'
                }`}
              >
                <HardDrive size={11} className={isActive ? 'text-sky-400' : 'text-slate-500'} />
                <span>{pl.name}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={p.onOpenFolder}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-mono text-[11px] text-slate-400 hover:text-sky-400 hover:bg-slate-850 transition"
          >
            <Folder size={11} />
            <span>Browse…</span>
          </button>
        </div>

        <div className="hidden md:flex items-center gap-2 text-[10.5px] font-mono text-slate-400 shrink-0">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-400" />
          <span>HOLD RIGHT-CLICK ON ANY FOLDER FOR RADIAL FORMAT WHEEL</span>
        </div>
      </div>
    )}
  </header>
);
