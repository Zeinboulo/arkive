import React from 'react';
import { X, Info, HardDrive, FileArchive, Lock, Percent } from 'lucide-react';
import { ArchiveInfo } from '../types';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  info: ArchiveInfo | null;
}

export const InfoModal: React.FC<InfoModalProps> = ({
  isOpen,
  onClose,
  info,
}) => {
  if (!isOpen || !info) return null;

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-850 border border-slate-700/80 rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-3.5 border-b border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Info className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">Archive Properties</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Format:</span>
              <span className="font-semibold text-emerald-400">
                {info.formatLabel}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Archive Size on Disk:</span>
              <span className="font-mono text-slate-200">
                {formatBytes(info.archiveSize)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Uncompressed Size:</span>
              <span className="font-mono text-slate-200">
                {formatBytes(info.totalSize)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Compression Ratio:</span>
              <span className="font-mono font-bold text-sky-400">
                {(info.ratio * 100).toFixed(1)}% (
                {info.ratio > 0 ? (1 / info.ratio).toFixed(2) : '1.0'}x)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total Entries:</span>
              <span className="text-slate-200">
                {info.files} files, {info.dirs} folders
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Encryption:</span>
              <span
                className={`font-semibold ${
                  info.encrypted ? 'text-amber-400' : 'text-slate-400'
                }`}
              >
                {info.encrypted ? 'AES-256 Protected' : 'None'}
              </span>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 truncate">
            Path: <span className="font-mono text-slate-300">{info.path}</span>
          </div>

          <div className="pt-2 flex justify-end border-t border-slate-700/60">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 transition font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
