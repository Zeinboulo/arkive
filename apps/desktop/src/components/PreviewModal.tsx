import React from 'react';
import { X, FileText, Download, Copy, Check } from 'lucide-react';
import { Entry } from '../types';

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: Entry | null;
  content: string | null;
  isLoading: boolean;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({
  isOpen,
  onClose,
  entry,
  content,
  isLoading,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen || !entry) return null;

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-slate-850 border border-slate-700/80 rounded-xl w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-3 border-b border-slate-700/60 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center space-x-2.5 truncate pr-4">
            <FileText className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-200 truncate font-mono">
              {entry.path}
            </span>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {content && (
              <button
                onClick={handleCopy}
                className="flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs transition border border-slate-700"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 bg-slate-950 p-4 overflow-auto font-mono text-xs text-slate-300">
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-slate-500">
              Loading entry content...
            </div>
          ) : content !== null ? (
            <pre className="whitespace-pre-wrap break-all leading-relaxed font-mono">
              {content}
            </pre>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500">
              Binary or non-previewable file format
            </div>
          )}
        </div>

        <div className="px-5 py-2.5 border-t border-slate-800 text-[11px] text-slate-500 flex justify-between bg-slate-900/40">
          <span>Size: {entry.size} bytes</span>
          <span>CRC-32: {entry.crc32 ? `0x${entry.crc32.toString(16).toUpperCase()}` : 'N/A'}</span>
        </div>
      </div>
    </div>
  );
};
