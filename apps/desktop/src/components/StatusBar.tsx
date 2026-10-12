import React from 'react';
import { formatBytes } from '../format';

interface StatusBarProps {
  totalFiles: number;
  totalBytes: number;
  selectedCount: number;
  statusMessage: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  totalFiles,
  totalBytes,
  selectedCount,
  statusMessage,
}) => (
  <footer className="flex items-center gap-4 border-t border-slate-800 bg-slate-950 px-4 py-1.5 text-[11px] text-slate-400">
    <span className="font-mono text-slate-300">
      {totalFiles} files · {formatBytes(totalBytes)}
    </span>
    {selectedCount > 0 && <span className="text-sky-400">{selectedCount} selected</span>}
    <span className="ml-auto max-w-md truncate text-slate-500">{statusMessage}</span>
  </footer>
);
