import React, { useState } from 'react';
import { X, Download, Folder, Lock, Check } from 'lucide-react';

export interface ExtractModalSubmitData {
  dest: string;
  password?: string | null;
  overwrite: boolean;
}

interface ExtractModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (options: ExtractModalSubmitData) => void;
  archivePath: string;
  isEncrypted: boolean;
}

export const ExtractModal: React.FC<ExtractModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  archivePath,
  isEncrypted,
}) => {
  const [destPath, setDestPath] = useState('');
  const [password, setPassword] = useState('');
  const [overwrite, setOverwrite] = useState(false);

  if (!isOpen) return null;

  const defaultDest = archivePath
    ? archivePath.replace(/\.[^/.]+$/, '')
    : 'extracted';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      dest: destPath.trim() || defaultDest,
      password: password.trim() || null,
      overwrite,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-850 border border-slate-700/80 rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-3.5 border-b border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Download className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Extract Archive</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-300 mb-1">
              Destination Directory
            </label>
            <div className="flex rounded-lg border border-slate-700 bg-slate-800 overflow-hidden focus-within:border-amber-500">
              <input
                type="text"
                placeholder={defaultDest}
                value={destPath}
                onChange={(e) => setDestPath(e.target.value)}
                className="w-full bg-transparent px-3 py-2 text-slate-100 focus:outline-none placeholder-slate-500"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Extracts to a new folder named after the archive by default.
            </p>
          </div>

          {(isEncrypted || true) && (
            <div>
              <label className="block font-medium text-slate-300 mb-1">
                Password (if encrypted)
              </label>
              <input
                type="password"
                placeholder="Enter password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500 placeholder-slate-500"
              />
            </div>
          )}

          <div className="flex items-center space-x-2 pt-1">
            <input
              type="checkbox"
              id="overwrite"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-0 cursor-pointer"
            />
            <label
              htmlFor="overwrite"
              className="font-medium text-slate-300 cursor-pointer"
            >
              Overwrite existing files without asking
            </label>
          </div>

          <div className="pt-2 flex justify-end space-x-2 border-t border-slate-700/60">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 transition font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold transition shadow-lg shadow-amber-900/40"
            >
              Extract All
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
