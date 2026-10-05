import React, { useState, useEffect } from 'react';
import {
  X,
  Archive,
  Lock,
  Eye,
  EyeOff,
  FolderPlus,
  FilePlus,
  Folder,
  File as FileIcon,
  Trash2,
} from 'lucide-react';
import { ArchiveFormat } from '../types';

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (options: any) => void;
  inputPaths: string[];
}

export const CreateModal: React.FC<CreateModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  inputPaths,
}) => {
  const [format, setFormat] = useState<ArchiveFormat>('zip');
  const [level, setLevel] = useState(6);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [threads, setThreads] = useState(0);
  const [zipMethod, setZipMethod] = useState('deflate');
  const [archiveName, setArchiveName] = useState('archive');
  const [inputs, setInputs] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setInputs(inputPaths);
      if (inputPaths.length > 0) {
        // Derive default archive name from the first input
        const first = inputPaths[0].replace(/[\\/]$/, '');
        const base = first.split(/[\\/]/).pop() || 'archive';
        setArchiveName(base);
      } else {
        setArchiveName('archive');
      }
    }
  }, [isOpen, inputPaths]);

  if (!isOpen) return null;

  const handleAddFiles = async () => {
    if (!window.arkive?.openFilesDialog) return;
    const files = await window.arkive.openFilesDialog();
    if (files && files.length > 0) {
      setInputs((prev) => Array.from(new Set([...prev, ...files])));
    }
  };

  const handleAddFolder = async () => {
    if (!window.arkive?.openFolderDialog) return;
    const folder = await window.arkive.openFolderDialog();
    if (folder) {
      setInputs((prev) => Array.from(new Set([...prev, folder])));
      if (inputs.length === 0) {
        const base = folder.replace(/[\\/]$/, '').split(/[\\/]/).pop() || 'archive';
        setArchiveName(base);
      }
    }
  };

  const handleRemoveInput = (idx: number) => {
    setInputs((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputs.length === 0) {
      alert('Please add at least one file or folder to compress.');
      return;
    }
    onSubmit({
      name: `${archiveName}.${format}`,
      format,
      level,
      password: password.trim() ? password.trim() : null,
      threads,
      zipMethod,
      inputs,
    });
    onClose();
  };

  const getLevelLabel = (lvl: number) => {
    if (lvl === 0) return '0 - Store (No compression)';
    if (lvl <= 2) return `${lvl} - Fastest`;
    if (lvl <= 4) return `${lvl} - Fast`;
    if (lvl <= 6) return `${lvl} - Normal (Standard)`;
    if (lvl <= 8) return `${lvl} - Maximum`;
    return '9 - Ultra';
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-850 border border-slate-700/80 rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-3.5 border-b border-slate-700/60 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <Archive className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Create New Archive</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
          {/* Inputs Section (Files and Folders) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-semibold text-slate-200">
                Items to Compress ({inputs.length})
              </label>
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={handleAddFiles}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 transition"
                  title="Add files from disk"
                >
                  <FilePlus className="w-3.5 h-3.5" />
                  <span>+ Files</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddFolder}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 transition"
                  title="Add entire folder from disk"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>+ Folder</span>
                </button>
              </div>
            </div>

            <div className="border border-slate-700/80 rounded-lg bg-slate-900/80 max-h-32 overflow-y-auto divide-y divide-slate-800/60 p-1">
              {inputs.length === 0 ? (
                <div className="py-4 text-center text-slate-500">
                  <p>No items selected.</p>
                  <p className="text-[11px] mt-0.5 text-slate-600">
                    Click <span className="text-emerald-400 font-medium">+ Folder</span> or <span className="text-sky-400 font-medium">+ Files</span> above.
                  </p>
                </div>
              ) : (
                inputs.map((p, idx) => {
                  const isDirectory = !p.includes('.') || p.endsWith('/') || p.endsWith('\\');
                  const baseName = p.replace(/[\\/]$/, '').split(/[\\/]/).pop() || p;
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-2.5 py-1.5 hover:bg-slate-800/40 rounded text-slate-300 group"
                    >
                      <div className="flex items-center space-x-2 truncate pr-2">
                        {isDirectory ? (
                          <Folder className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <FileIcon className="w-4 h-4 text-sky-400 shrink-0" />
                        )}
                        <span className="font-medium text-slate-200 truncate">{baseName}</span>
                        <span className="text-[10px] text-slate-500 truncate hidden sm:inline">
                          ({p})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveInput(idx)}
                        className="text-slate-500 hover:text-rose-400 p-0.5 transition shrink-0"
                        title="Remove from archive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Archive Name */}
          <div>
            <label className="block font-medium text-slate-300 mb-1">
              Archive File Name
            </label>
            <div className="flex rounded-lg border border-slate-700 bg-slate-800 overflow-hidden focus-within:border-emerald-500">
              <input
                type="text"
                value={archiveName}
                onChange={(e) => setArchiveName(e.target.value)}
                required
                className="w-full bg-transparent px-3 py-2 text-slate-100 focus:outline-none"
              />
              <span className="px-3 py-2 text-slate-400 bg-slate-900 border-l border-slate-700 font-mono">
                .{format}
              </span>
            </div>
          </div>

          {/* Format Picker */}
          <div>
            <label className="block font-medium text-slate-300 mb-1.5">
              Archive Format
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: 'zip', label: 'ZIP' },
                { id: '7z', label: '7-Zip' },
                { id: 'tar.gz', label: 'TAR.GZ' },
                { id: 'tar.zst', label: 'TAR.ZST' },
                { id: 'tar.xz', label: 'TAR.XZ' },
                { id: 'tar.bz2', label: 'TAR.BZ2' },
                { id: 'tar', label: 'TAR' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFormat(f.id as ArchiveFormat)}
                  className={`py-1.5 px-2 rounded-lg font-medium transition border ${
                    format === f.id
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                      : 'bg-slate-800 text-slate-400 border-slate-700/60 hover:bg-slate-750'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Compression Level Slider */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="font-medium text-slate-300">
                Compression Level
              </label>
              <span className="text-[11px] font-mono text-emerald-400">
                {getLevelLabel(level)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="9"
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>

          {/* ZIP Method if ZIP */}
          {format === 'zip' && (
            <div>
              <label className="block font-medium text-slate-300 mb-1">
                ZIP Compression Method
              </label>
              <select
                value={zipMethod}
                onChange={(e) => setZipMethod(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="deflate">Deflate (Standard WinRAR / 7-Zip compatibility)</option>
                <option value="zstd">Zstandard (High speed & modern)</option>
                <option value="bzip2">Bzip2 (High ratio)</option>
                <option value="store">Store (No compression)</option>
              </select>
            </div>
          )}

          {/* Encryption Password */}
          <div>
            <label className="block font-medium text-slate-300 mb-1">
              Encryption Password (AES-256)
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank for no password"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-3 pr-9 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 placeholder-slate-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              {format === '7z'
                ? 'Protects archive files and file names with AES-256.'
                : format === 'zip'
                ? 'Standard WinZip AE-2 AES-256 encryption.'
                : 'Encryption is supported on ZIP and 7z formats.'}
            </p>
          </div>

          {/* Thread Count */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="font-medium text-slate-300">
                Worker Threads
              </label>
              <span className="text-[11px] font-mono text-slate-400">
                {threads === 0 ? 'Auto (Parallel multi-threading)' : `${threads} threads`}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="16"
              value={threads}
              onChange={(e) => setThreads(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>

          <div className="pt-2 flex justify-end space-x-2 border-t border-slate-700/60 sticky bottom-0 bg-slate-850 pb-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 transition font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={inputs.length === 0}
              className={`px-5 py-2 rounded-lg text-white font-semibold transition shadow-lg ${
                inputs.length === 0
                  ? 'bg-emerald-600/50 cursor-not-allowed text-slate-400'
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/40'
              }`}
            >
              Start Compression
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
