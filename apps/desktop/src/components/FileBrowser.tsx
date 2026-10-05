import React, { useState, useMemo } from 'react';
import {
  Folder,
  FileText,
  FileCode,
  FileArchive,
  Image,
  ArrowUp,
  Search,
  Lock,
  ChevronRight,
  HardDrive,
  File as FileIcon,
} from 'lucide-react';
import { Entry } from '../types';

interface FileBrowserProps {
  entries: Entry[];
  currentPath: string;
  onNavigate: (path: string) => void;
  onPreview: (entry: Entry) => void;
  selectedEntries: Set<string>;
  onToggleSelect: (path: string, isMulti: boolean) => void;
  onSelectAll: () => void;
}

export const FileBrowser: React.FC<FileBrowserProps> = ({
  entries,
  currentPath,
  onNavigate,
  onPreview,
  selectedEntries,
  onToggleSelect,
  onSelectAll,
}) => {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<'name' | 'size' | 'modified'>('name');
  const [sortAsc, setSortAsc] = useState(true);

  // Filter items in current directory
  const currentItems = useMemo(() => {
    const normCurrent = currentPath ? `${currentPath.replace(/\/$/, '')}/` : '';

    return entries
      .filter((e) => {
        // If search query is active, search globally across all paths
        if (search.trim()) {
          return e.path.toLowerCase().includes(search.toLowerCase());
        }

        // Otherwise filter by current directory level
        if (normCurrent === '') {
          return !e.path.includes('/');
        }
        if (!e.path.startsWith(normCurrent)) {
          return false;
        }
        const rest = e.path.slice(normCurrent.length);
        return !rest.includes('/');
      })
      .sort((a, b) => {
        // Folders always come first
        if (a.isDir !== b.isDir) {
          return a.isDir ? -1 : 1;
        }
        let comp = 0;
        if (sortField === 'name') {
          comp = a.path.localeCompare(b.path);
        } else if (sortField === 'size') {
          comp = a.size - b.size;
        } else if (sortField === 'modified') {
          comp = (a.modified || '').localeCompare(b.modified || '');
        }
        return sortAsc ? comp : -comp;
      });
  }, [entries, currentPath, search, sortField, sortAsc]);

  const breadcrumbs = useMemo(() => {
    if (!currentPath) return [];
    return currentPath.split('/').filter(Boolean);
  }, [currentPath]);

  const handleUp = () => {
    if (!currentPath) return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    onNavigate(parts.join('/'));
  };

  const getFileIcon = (entry: Entry) => {
    if (entry.isDir) return <Folder className="w-4 h-4 text-sky-400 fill-sky-400/20" />;
    const ext = entry.path.split('.').pop()?.toLowerCase();
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext || '')) {
      return <Image className="w-4 h-4 text-emerald-400" />;
    }
    if (['rs', 'ts', 'tsx', 'js', 'json', 'py', 'sql', 'c', 'cpp'].includes(ext || '')) {
      return <FileCode className="w-4 h-4 text-amber-400" />;
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) {
      return <FileArchive className="w-4 h-4 text-rose-400" />;
    }
    if (['txt', 'md', 'csv', 'log'].includes(ext || '')) {
      return <FileText className="w-4 h-4 text-slate-300" />;
    }
    return <FileIcon className="w-4 h-4 text-slate-400" />;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden select-none">
      {/* Navigation & Search bar */}
      <div className="bg-slate-850 px-4 py-2 border-b border-slate-800 flex items-center justify-between gap-4">
        <div className="flex items-center space-x-2 text-xs flex-1 overflow-hidden">
          <button
            onClick={handleUp}
            disabled={!currentPath}
            className={`p-1.5 rounded hover:bg-slate-700/60 transition ${
              !currentPath ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300'
            }`}
            title="Up one level"
          >
            <ArrowUp className="w-4 h-4" />
          </button>

          <div className="flex items-center space-x-1 text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded border border-slate-700/50 flex-1 overflow-x-auto whitespace-nowrap">
            <button
              onClick={() => onNavigate('')}
              className="hover:text-sky-400 font-medium transition flex items-center space-x-1"
            >
              <HardDrive className="w-3.5 h-3.5 text-sky-400 inline" />
              <span>Root</span>
            </button>
            {breadcrumbs.map((crumb, idx) => {
              const fullPath = breadcrumbs.slice(0, idx + 1).join('/');
              return (
                <React.Fragment key={fullPath}>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  <button
                    onClick={() => onNavigate(fullPath)}
                    className="hover:text-sky-400 font-medium transition"
                  >
                    {crumb}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search archive contents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-800/90 border border-slate-700/60 rounded pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* File Table Header */}
      <div className="bg-slate-850/80 border-b border-slate-800 grid grid-cols-12 px-4 py-2 text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
        <div
          className="col-span-5 cursor-pointer hover:text-slate-200 flex items-center space-x-1"
          onClick={() => {
            if (sortField === 'name') setSortAsc(!sortAsc);
            else {
              setSortField('name');
              setSortAsc(true);
            }
          }}
        >
          <span>Name</span>
        </div>
        <div
          className="col-span-2 text-right cursor-pointer hover:text-slate-200"
          onClick={() => {
            if (sortField === 'size') setSortAsc(!sortAsc);
            else {
              setSortField('size');
              setSortAsc(true);
            }
          }}
        >
          <span>Original Size</span>
        </div>
        <div className="col-span-2 text-right">
          <span>Compressed</span>
        </div>
        <div
          className="col-span-2 text-right cursor-pointer hover:text-slate-200"
          onClick={() => {
            if (sortField === 'modified') setSortAsc(!sortAsc);
            else {
              setSortField('modified');
              setSortAsc(true);
            }
          }}
        >
          <span>Modified</span>
        </div>
        <div className="col-span-1 text-center">
          <span>Security</span>
        </div>
      </div>

      {/* File List Rows */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
        {currentItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm p-8">
            <Folder className="w-12 h-12 text-slate-700 mb-2 stroke-[1.5]" />
            <p className="font-medium text-slate-400">
              {entries.length === 0
                ? 'No archive loaded'
                : 'No files found in this folder'}
            </p>
            {entries.length === 0 && (
              <p className="text-xs text-slate-500 mt-1">
                Click <span className="text-sky-400 font-semibold">Open</span> above to browse an archive, or <span className="text-emerald-400 font-semibold">Add</span> to create one.
              </p>
            )}
          </div>
        ) : (
          currentItems.map((item) => {
            const isSelected = selectedEntries.has(item.path);
            const displayName = search.trim()
              ? item.path
              : item.path.split('/').pop() || item.path;

            return (
              <div
                key={item.path}
                onClick={(e) => onToggleSelect(item.path, e.ctrlKey || e.metaKey)}
                onDoubleClick={() => {
                  if (item.isDir) {
                    onNavigate(item.path);
                  } else {
                    onPreview(item);
                  }
                }}
                className={`grid grid-cols-12 px-4 py-1.5 text-xs items-center cursor-pointer transition select-none ${
                  isSelected
                    ? 'bg-sky-500/20 text-sky-100 hover:bg-sky-500/25'
                    : 'hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <div className="col-span-5 flex items-center space-x-2.5 truncate pr-2">
                  {getFileIcon(item)}
                  <span
                    className={`truncate font-medium ${
                      item.isDir ? 'text-sky-300' : 'text-slate-200'
                    }`}
                  >
                    {displayName}
                  </span>
                </div>

                <div className="col-span-2 text-right font-mono text-slate-400">
                  {item.isDir ? '-' : formatBytes(item.size)}
                </div>

                <div className="col-span-2 text-right font-mono text-slate-400">
                  {item.isDir
                    ? '-'
                    : item.compressedSize
                    ? formatBytes(item.compressedSize)
                    : '-'}
                </div>

                <div className="col-span-2 text-right text-slate-400 truncate">
                  {item.modified || '-'}
                </div>

                <div className="col-span-1 flex justify-center">
                  {item.encrypted && (
                    <span title="AES-256 Encrypted">
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
