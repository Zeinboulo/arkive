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
  <footer className="flex items-center gap-4 border-t border-slate-800 bg-slate-950/90 px-4 py-2 text-[11px] text-slate-400 shrink-0">
    <div className="flex items-center gap-2 font-mono text-slate-300">
      <span>{totalFiles} files</span>
      <span className="text-slate-600">·</span>
      <span>{formatBytes(totalBytes)}</span>
    </div>

    {selectedCount > 0 && (
      <span className="rounded-full bg-sky-500/15 border border-sky-500/25 px-2 py-0.2 text-[10.5px] font-medium text-sky-400">
        {selectedCount} selected
      </span>
    )}

    <div className="ml-auto flex items-center gap-2.5 min-w-0">
      {isBusy ? (
        <span className="flex items-center gap-1.5 text-sky-400 font-medium">
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          <span className="truncate max-w-md">{statusMessage}</span>
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-slate-400 truncate max-w-md">
          {recentArchivePath && <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
          <span className="truncate">{statusMessage}</span>
        </span>
      )}

      {!isBusy && recentArchivePath && onOpenRecentArchive && (
        <button
          onClick={() => onOpenRecentArchive(recentArchivePath)}
          className="flex items-center gap-1 rounded-md bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 px-2 py-0.5 text-[10.5px] font-semibold text-sky-400 transition shrink-0"
        >
          <FolderOpen className="w-3 h-3" />
          <span>Inspect Archive</span>
        </button>
      )}
    </div>
  </footer>
);
