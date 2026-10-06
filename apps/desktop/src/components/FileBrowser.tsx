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
  X,
  FolderOpen,
  Video,
} from 'lucide-react';
import { Entry, FsItem, QuickPlace } from '../types';

interface FileBrowserProps {
  mode: 'archive' | 'explorer';
  currentArchive: string | null;
  onCloseArchive: () => void;

  // Archive mode props
  entries: Entry[];
  archivePath: string;
  onNavigateArchive: (path: string) => void;
  onPreviewArchive: (entry: Entry) => void;

  // Explorer mode props
  fsItems: FsItem[];
  currentFsPath: string;
  onNavigateFs: (path: string) => void;
  quickPlaces: QuickPlace[];
  onOpenArchiveFile: (path: string) => void;
  onCompressVideoFile?: (path: string) => void;

  // Common selection
  selectedItems: Set<string>;
  onToggleSelect: (path: string, isMulti: boolean) => void;
  onSelectAll: () => void;

  // Drag & drop
  onDropFiles: (paths: string[]) => void;
}

export const FileBrowser: React.FC<FileBrowserProps> = ({
  mode,
  currentArchive,
  onCloseArchive,
  entries,
  archivePath,
  onNavigateArchive,
  onPreviewArchive,
  fsItems,
  currentFsPath,
  onNavigateFs,
  quickPlaces,
  onOpenArchiveFile,
  onCompressVideoFile,
  selectedItems,
  onToggleSelect,
  onDropFiles,
}) => {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<'name' | 'size' | 'modified'>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Archive filtered items
  const archiveItems = useMemo(() => {
    if (mode !== 'archive') return [];
    const normCurrent = archivePath ? `${archivePath.replace(/\/$/, '')}/` : '';

    return entries
      .filter((e) => {
        if (search.trim()) {
          return e.path.toLowerCase().includes(search.toLowerCase());
        }
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
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        let comp = 0;
        if (sortField === 'name') comp = a.path.localeCompare(b.path);
        else if (sortField === 'size') comp = a.size - b.size;
        else if (sortField === 'modified') comp = (a.modified || '').localeCompare(b.modified || '');
        return sortAsc ? comp : -comp;
      });
  }, [mode, entries, archivePath, search, sortField, sortAsc]);

  // Explorer filtered items
  const explorerItems = useMemo(() => {
    if (mode !== 'explorer') return [];
    return fsItems
      .filter((item) => {
        if (!search.trim()) return true;
        return item.name.toLowerCase().includes(search.toLowerCase());
      })
      .sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        let comp = 0;
        if (sortField === 'name') comp = a.name.localeCompare(b.name);
        else if (sortField === 'size') comp = a.size - b.size;
        else if (sortField === 'modified') comp = (a.modified || '').localeCompare(b.modified || '');
        return sortAsc ? comp : -comp;
      });
  }, [mode, fsItems, search, sortField, sortAsc]);

  const breadcrumbs = useMemo(() => {
    const raw = mode === 'archive' ? archivePath : currentFsPath;
    if (!raw) return [];
    return raw.replace(/\\/g, '/').split('/').filter(Boolean);
  }, [mode, archivePath, currentFsPath]);

  const handleUp = () => {
    if (mode === 'archive') {
      if (!archivePath) return;
      const parts = archivePath.split('/').filter(Boolean);
      parts.pop();
      onNavigateArchive(parts.join('/'));
    } else {
      if (!currentFsPath) return;
      const clean = currentFsPath.replace(/[\\/]$/, '');
      const parts = clean.split(/[\\/]/);
      if (parts.length <= 1) return;
      parts.pop();
      let parent = parts.join('/');
      if (parent.endsWith(':')) parent += '/';
      onNavigateFs(parent || '/');
    }
  };

  const getFileIcon = (isDir: boolean, name: string, isArchive?: boolean) => {
    if (isDir) return <Folder className="w-4 h-4 text-sky-400 fill-sky-400/20" />;
    if (isArchive) return <FileArchive className="w-4 h-4 text-purple-400 fill-purple-400/20" />;
    const ext = name.split('.').pop()?.toLowerCase();
    if (['mp4', 'mkv', 'mov', 'avi', 'webm', 'flv', 'wmv', 'm4v', 'ts'].includes(ext || '')) {
      return <Video className="w-4 h-4 text-violet-400" />;
    }
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico'].includes(ext || '')) {
      return <Image className="w-4 h-4 text-emerald-400" />;
    }
    if (['rs', 'ts', 'tsx', 'js', 'json', 'py', 'sql', 'c', 'cpp', 'html', 'css'].includes(ext || '')) {
      return <FileCode className="w-4 h-4 text-amber-400" />;
    }
    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'zst', 'tgz'].includes(ext || '')) {
      return <FileArchive className="w-4 h-4 text-purple-400 fill-purple-400/20" />;
    }
    if (['txt', 'md', 'csv', 'log', 'pdf', 'docx'].includes(ext || '')) {
      return <FileText className="w-4 h-4 text-slate-300" />;
    }
    return <FileIcon className="w-4 h-4 text-slate-400" />;
  };

  const formatBytes = (bytes: number) => {
    if (bytes <= 0) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const paths = Array.from(e.dataTransfer.files).map((f: any) => f.path || f.name);
      onDropFiles(paths);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex-1 flex flex-col bg-slate-900 overflow-hidden select-none relative"
    >
      {/* Drag & Drop Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 bg-emerald-950/80 backdrop-blur-sm z-40 border-2 border-dashed border-emerald-400 flex flex-col items-center justify-center pointer-events-none animate-in fade-in duration-100">
          <FileArchive className="w-14 h-14 text-emerald-400 mb-2 animate-bounce" />
          <h3 className="text-base font-bold text-white">Drop Files or Folders Here</h3>
          <p className="text-xs text-emerald-300 mt-1">
            Drop an archive to view its contents, or drop files/folders to compress them!
          </p>
        </div>
      )}

      {/* Quick Places bar (in Explorer Mode) */}
      {mode === 'explorer' && quickPlaces.length > 0 && (
        <div className="bg-slate-850 px-4 py-1.5 border-b border-slate-800/80 flex items-center space-x-1 overflow-x-auto text-xs shrink-0">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mr-1.5 flex items-center">
            <HardDrive className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
            Places:
          </span>
          {quickPlaces.map((qp) => (
            <button
              key={qp.path}
              onClick={() => onNavigateFs(qp.path)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                currentFsPath.toLowerCase() === qp.path.toLowerCase()
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/50'
              }`}
            >
              {qp.name}
            </button>
          ))}
        </div>
      )}

      {/* Navigation & Search bar */}
      <div className="bg-slate-850 px-4 py-2 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center space-x-2 text-xs flex-1 overflow-hidden">
          <button
            onClick={handleUp}
            className="p-1.5 rounded hover:bg-slate-700/60 transition text-slate-300 shrink-0"
            title="Up one level (..)"
          >
            <ArrowUp className="w-4 h-4" />
          </button>

          {/* Mode Badge & Close Archive */}
          {mode === 'archive' ? (
            <div className="flex items-center space-x-1 shrink-0">
              <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-semibold text-[11px] border border-purple-500/30 flex items-center space-x-1">
                <FileArchive className="w-3.5 h-3.5 inline mr-1" />
                <span>Archive</span>
              </span>
              <button
                onClick={onCloseArchive}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] border border-slate-700 flex items-center space-x-1 transition"
                title="Close archive and return to PC File Explorer"
              >
                <X className="w-3 h-3 text-slate-400" />
                <span>Close</span>
              </button>
            </div>
          ) : (
            <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-semibold text-[11px] border border-sky-500/30 shrink-0 flex items-center space-x-1">
              <FolderOpen className="w-3.5 h-3.5 inline mr-1" />
              <span>PC Explorer</span>
            </span>
          )}

          {/* Breadcrumb Path Bar */}
          <div className="flex items-center space-x-1 text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded border border-slate-700/50 flex-1 overflow-x-auto whitespace-nowrap">
            {mode === 'archive' ? (
              <>
                <button
                  onClick={() => onNavigateArchive('')}
                  className="hover:text-sky-400 font-medium transition flex items-center space-x-1 shrink-0"
                >
                  <HardDrive className="w-3.5 h-3.5 text-purple-400 inline" />
                  <span>Archive Root</span>
                </button>
                {breadcrumbs.map((crumb, idx) => {
                  const fullPath = breadcrumbs.slice(0, idx + 1).join('/');
                  return (
                    <React.Fragment key={fullPath}>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                      <button
                        onClick={() => onNavigateArchive(fullPath)}
                        className="hover:text-sky-400 font-medium transition"
                      >
                        {crumb}
                      </button>
                    </React.Fragment>
                  );
                })}
              </>
            ) : (
              <>
                <span className="text-slate-500 font-mono text-[11px] truncate max-w-full">
                  {currentFsPath}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Search Input */}
        <div className="relative w-56 shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder={mode === 'archive' ? 'Search archive...' : 'Search folder...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-800/90 border border-slate-700/60 rounded pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* File Table Header */}
      <div className="bg-slate-850/80 border-b border-slate-800 grid grid-cols-12 px-4 py-2 text-[11px] font-semibold text-slate-400 tracking-wider uppercase shrink-0">
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
          <span>Size</span>
        </div>
        <div className="col-span-2 text-right">
          <span>{mode === 'archive' ? 'Compressed' : 'Type'}</span>
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
          <span>{mode === 'archive' ? 'Encrypted' : 'Format'}</span>
        </div>
      </div>

      {/* File List Rows */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
        {mode === 'archive' ? (
          /* Archive Mode Rows */
          archiveItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm p-8">
              <Folder className="w-12 h-12 text-slate-700 mb-2 stroke-[1.5]" />
              <p className="font-medium text-slate-400">Empty folder in archive</p>
            </div>
          ) : (
            archiveItems.map((item) => {
              const isSelected = selectedItems.has(item.path);
              const displayName = search.trim()
                ? item.path
                : item.path.split('/').pop() || item.path;

              return (
                <div
                  key={item.path}
                  onClick={(e) => onToggleSelect(item.path, e.ctrlKey || e.metaKey)}
                  onDoubleClick={() => {
                    if (item.isDir) {
                      onNavigateArchive(item.path);
                    } else {
                      onPreviewArchive(item);
                    }
                  }}
                  className={`grid grid-cols-12 px-4 py-1.5 text-xs items-center cursor-pointer transition select-none ${
                    isSelected
                      ? 'bg-purple-500/20 text-purple-100 hover:bg-purple-500/25'
                      : 'hover:bg-slate-800/60 text-slate-300'
                  }`}
                >
                  <div className="col-span-5 flex items-center space-x-2.5 truncate pr-2">
                    {getFileIcon(item.isDir, displayName)}
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
          )
        ) : (
          /* Explorer Mode Rows */
          explorerItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm p-8">
              <Folder className="w-12 h-12 text-slate-700 mb-2 stroke-[1.5]" />
              <p className="font-medium text-slate-400">Folder is empty</p>
            </div>
          ) : (
            explorerItems.map((item) => {
              const isSelected = selectedItems.has(item.path);
              const ext = item.name.split('.').pop()?.toLowerCase();
              const isVideo = !item.isDir && ['mp4', 'mkv', 'mov', 'avi', 'webm', 'flv', 'wmv', 'm4v', 'ts'].includes(ext || '');

              return (
                <div
                  key={item.path}
                  onClick={(e) => onToggleSelect(item.path, e.ctrlKey || e.metaKey)}
                  onDoubleClick={() => {
                    if (item.isDir) {
                      onNavigateFs(item.path);
                    } else if (item.isArchive) {
                      onOpenArchiveFile(item.path);
                    } else if (isVideo && onCompressVideoFile) {
                      onCompressVideoFile(item.path);
                    }
                  }}
                  className={`grid grid-cols-12 px-4 py-1.5 text-xs items-center cursor-pointer transition select-none ${
                    isSelected
                      ? 'bg-sky-500/20 text-sky-100 hover:bg-sky-500/25'
                      : 'hover:bg-slate-800/60 text-slate-300'
                  }`}
                >
                  <div className="col-span-5 flex items-center space-x-2.5 truncate pr-2">
                    {getFileIcon(item.isDir, item.name, item.isArchive)}
                    <span
                      className={`truncate font-medium ${
                        item.isArchive
                          ? 'text-purple-300 font-semibold'
                          : isVideo
                          ? 'text-violet-300'
                          : item.isDir
                          ? 'text-sky-300'
                          : 'text-slate-200'
                      }`}
                    >
                      {item.name}
                    </span>
                  </div>

                  <div className="col-span-2 text-right font-mono text-slate-400">
                    {item.isDir ? '-' : formatBytes(item.size)}
                  </div>

                  <div className="col-span-2 text-right text-slate-400 truncate">
                    {item.isDir
                      ? 'File folder'
                      : item.isArchive
                      ? 'Compressed Archive'
                      : isVideo
                      ? 'Video Media'
                      : item.name.split('.').pop()?.toUpperCase() + ' File'}
                  </div>

                  <div className="col-span-2 text-right text-slate-400 truncate">
                    {item.modified || '-'}
                  </div>

                  <div className="col-span-1 flex justify-center text-[10px]">
                    {item.isArchive ? (
                      <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-mono">
                        ARCHIVE
                      </span>
                    ) : isVideo ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCompressVideoFile?.(item.path);
                        }}
                        className="px-1.5 py-0.2 rounded bg-violet-500/20 hover:bg-violet-500/40 text-violet-300 font-mono text-[9px] border border-violet-500/30 transition flex items-center space-x-1"
                        title="Compress this video"
                      >
                        <Video className="w-2.5 h-2.5 inline" />
                        <span>VIDEO</span>
                      </button>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </div>
                </div>
              );
            })
          )
        )}
      </div>
    </div>
  );
};
