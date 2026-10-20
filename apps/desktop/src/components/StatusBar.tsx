import React from 'react';
import { Loader2, CheckCircle2, FolderOpen } from 'lucide-react';
import { formatBytes } from '../format';

interface StatusBarProps {
  totalFiles: number;
  totalBytes: number;
  selectedCount: number;
  statusMessage: string;
  isBusy?: boolean;
  recentArchivePath?: string | null;
  onOpenRecentArchive?: (path: string) => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  totalFiles,
  totalBytes,
  selectedCount,
  statusMessage,
  isBusy = false,
  recentArchivePath = null,
  onOpenRecentArchive,
}) => (
  <footer className="flex items-center gap-3 border-t border-slate-800 bg-slate-950 px-3 h-7 text-[11px] font-mono text-slate-400 shrink-0 select-none">
    <div className="flex items-center gap-2 text-slate-300 tabular-nums">
      <span>ITEMS: {totalFiles}</span>
      <span className="text-slate-700">|</span>
      <span>VOLUME: {formatBytes(totalBytes)}</span>
    </div>

    {selectedCount > 0 && (
      <span className="rounded-sm bg-sky-500/15 border border-sky-500/30 px-1.5 py-0.2 text-[10px] font-semibold text-sky-400">
        SELECTED: {selectedCount}
      </span>
    )}

    <div className="ml-auto flex items-center gap-2.5 min-w-0">
      {isBusy ? (
        <span className="flex items-center gap-1.5 text-sky-400 font-semibold">
          <Loader2 className="w-3 h-3 animate-spin shrink-0" />
          <span className="truncate max-w-md">{statusMessage}</span>
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-slate-400 truncate max-w-md">
          {recentArchivePath && <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />}
          <span className="truncate">{statusMessage}</span>
        </span>
      )}

      {!isBusy && recentArchivePath && onOpenRecentArchive && (
        <button
          type="button"
          onClick={() => onOpenRecentArchive(recentArchivePath)}
          className="flex items-center gap-1 rounded-sm bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 px-2 py-0.2 text-[10px] font-semibold text-emerald-400 transition shrink-0"
        >
          <FolderOpen className="w-3 h-3" />
          <span>INSPECT CREATED ARCHIVE</span>
        </button>
      )}
    </div>
  </footer>
);
