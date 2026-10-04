import React from 'react';
import { HardDrive, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { ProgressUpdate } from '../types';

interface StatusBarProps {
  totalFiles: number;
  totalBytes: number;
  selectedCount: number;
  progress: ProgressUpdate | null;
  statusMessage: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  totalFiles,
  totalBytes,
  selectedCount,
  progress,
  statusMessage,
}) => {
  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <div className="bg-slate-950 border-t border-slate-800 px-4 py-1.5 flex items-center justify-between text-[11px] text-slate-400 select-none">
      <div className="flex items-center space-x-4">
        <span>
          Total:{' '}
          <span className="text-slate-200 font-medium">
            {totalFiles} items ({formatBytes(totalBytes)})
          </span>
        </span>
        {selectedCount > 0 && (
          <span>
            Selected:{' '}
            <span className="text-sky-400 font-medium">{selectedCount} items</span>
          </span>
        )}
        <div className="h-3 w-px bg-slate-800" />
        <span className="text-slate-500 truncate max-w-md">{statusMessage}</span>
      </div>

      {progress && (
        <div className="flex items-center space-x-3 w-72">
          <span className="truncate text-[10px] text-slate-300">
            {progress.current}
          </span>
          <div className="w-28 bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-sky-500 h-full transition-all duration-150"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <span className="font-mono text-slate-300 text-[10px] shrink-0">
            {progress.percent}%
          </span>
        </div>
      )}
    </div>
  );
};
