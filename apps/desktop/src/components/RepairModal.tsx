import React, { useState } from 'react';
import { X, Wrench, AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';
import { RepairReport } from '../types';

interface RepairModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRepair: (archivePath: string, outputPath: string) => Promise<RepairReport>;
}

export const RepairModal: React.FC<RepairModalProps> = ({
  isOpen,
  onClose,
  onRepair,
}) => {
  const [archivePath, setArchivePath] = useState('');
  const [outputPath, setOutputPath] = useState('');
  const [isRepairing, setIsRepairing] = useState(false);
  const [report, setReport] = useState<RepairReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!archivePath.trim()) return;
    setIsRepairing(true);
    setError(null);
    setReport(null);
    try {
      const rep = await onRepair(archivePath.trim(), outputPath.trim());
      setReport(rep);
    } catch (err: any) {
      setError(err?.toString() || 'Repair operation failed');
    } finally {
      setIsRepairing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-850 border border-slate-700/80 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-3.5 border-b border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Wrench className="w-4 h-4 text-rose-400" />
            <h3 className="text-sm font-bold text-white">
              ZIP Archive Repair Tool
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleStart} className="p-5 space-y-4 text-xs">
          <div className="bg-rose-950/30 border border-rose-500/30 rounded-lg p-3 text-slate-300 space-y-1">
            <div className="flex items-center space-x-2 text-rose-400 font-semibold">
              <ShieldAlert className="w-4 h-4" />
              <span>Corrupted Central Directory Recovery</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Scans raw binary stream for local file headers (`PK\x03\x04`), verifies CRC-32 checksums of each payload, and synthesizes a clean central directory header.
            </p>
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">
              Corrupted ZIP File Path
            </label>
            <input
              type="text"
              placeholder="C:\downloads\broken_archive.zip"
              value={archivePath}
              onChange={(e) => setArchivePath(e.target.value)}
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500 placeholder-slate-500 font-mono"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">
              Repaired Output Path (Optional)
            </label>
            <input
              type="text"
              placeholder="Leave empty for <name>.repaired.zip"
              value={outputPath}
              onChange={(e) => setOutputPath(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500 placeholder-slate-500 font-mono"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-lg text-red-300 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {report && (
            <div className="p-4 bg-emerald-950/30 border border-emerald-500/40 rounded-lg space-y-2">
              <div className="flex items-center space-x-2 text-emerald-400 font-semibold">
                <CheckCircle className="w-4 h-4" />
                <span>Archive Successfully Repaired!</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                <div>
                  Headers Found: <span className="font-bold">{report.found}</span>
                </div>
                <div>
                  Recovered: <span className="font-bold text-emerald-400">{report.recovered}</span>
                </div>
                <div>
                  CRC Verified: <span className="font-bold">{report.verified}</span>
                </div>
                <div>
                  Dropped (Corrupt): <span className="font-bold text-rose-400">{report.dropped.length}</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 truncate">
                Saved to: <span className="font-mono text-slate-200">{report.output}</span>
              </p>
            </div>
          )}

          <div className="pt-2 flex justify-end space-x-2 border-t border-slate-700/60">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 transition font-medium"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={isRepairing || !archivePath.trim()}
              className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold transition shadow-lg shadow-rose-900/40 disabled:opacity-50"
            >
              {isRepairing ? 'Scanning & Repairing...' : 'Start Repair'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
