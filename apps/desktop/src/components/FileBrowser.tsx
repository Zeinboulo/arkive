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
  Disc,
  MousePointerClick,
} from 'lucide-react';
import { Entry, FsItem } from '../types';
import { formatBytes as formatBytesShared, isVideoPath } from '../format';
import { RadialZipWheel, RadialZipChoice } from './RadialZipWheel';

interface FileBrowserProps {
  mode: 'archive' | 'explorer';
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
  onOpenArchiveFile: (path: string) => void;
  onCompressVideoFile?: (path: string) => void;
  onQuickCompressChoice?: (choice: RadialZipChoice, targetPath: string) => void;

  // Common selection
  selectedItems: Set<string>;
  onToggleSelect: (path: string, isMulti: boolean) => void;

  // Drag & drop
  onDropFiles: (paths: string[]) => void;
}

interface WheelState {
  isOpen: boolean;
  x: number;
  y: number;
  targetPath: string;
  targetName: string;
  isDir: boolean;
  openedAt: number;
}

export const FileBrowser: React.FC<FileBrowserProps> = ({
  mode,
  onCloseArchive,
  entries,
  archivePath,
  onNavigateArchive,
  onPreviewArchive,
  fsItems,
  currentFsPath,
  onNavigateFs,
  onOpenArchiveFile,
  onCompressVideoFile,
  onQuickCompressChoice,
  selectedItems,
  onToggleSelect,
  onDropFiles,
}) => {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<'name' | 'size' | 'modified'>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const [wheel, setWheel] = useState<WheelState>({
    isOpen: false,
    x: 0,
    y: 0,
    targetPath: '',
    targetName: '',
    isDir: true,
    openedAt: 0,
  });

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
    if (isDir) return <Folder className="w-4 h-4 text-amber-400/90 fill-amber-400/15 shrink-0" />;
    if (isArchive) return <FileArchive className="w-4 h-4 text-sky-400 fill-sky-400/15 shrink-0" />;
    const ext = name.split('.').pop()?.toLowerCase();
    if (isVideoPath(name)) {
      return <Video className="w-4 h-4 text-sky-400 shrink-0" />;
    }
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico'].includes(ext || '')) {
      return <Image className="w-4 h-4 text-sky-400 shrink-0" />;
    }
    if (['rs', 'ts', 'tsx', 'js', 'json', 'py', 'sql', 'c', 'cpp', 'html', 'css'].includes(ext || '')) {
      return <FileCode className="w-4 h-4 text-amber-400/80 shrink-0" />;
    }
    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'zst', 'tgz'].includes(ext || '')) {
      return <FileArchive className="w-4 h-4 text-sky-400 fill-sky-400/15 shrink-0" />;
    }
    if (['txt', 'md', 'csv', 'log', 'pdf', 'docx'].includes(ext || '')) {
      return <FileText className="w-4 h-4 text-slate-300 shrink-0" />;
    }
    return <FileIcon className="w-4 h-4 text-slate-400 shrink-0" />;
  };

  const formatBytes = (bytes: number) => formatBytesShared(bytes, true);

  const openWheelForItem = (clientX: number, clientY: number, item: FsItem) => {
    if (!selectedItems.has(item.path)) {
      onToggleSelect(item.path, false);
    }
    setWheel({
      isOpen: true,
      x: clientX,
      y: clientY,
      targetPath: item.path,
      targetName: item.name,
      isDir: item.isDir,
      openedAt: Date.now(),
    });
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
      onContextMenu={(e) => e.preventDefault()}
      className="flex-1 flex flex-col bg-slate-900 overflow-hidden select-none relative p-3 gap-2.5"
    >
      {/* Drag & Drop Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-3 rounded-2xl bg-slate-900/90 z-40 border-2 border-dashed border-sky-400 flex flex-col items-center justify-center pointer-events-none">
          <FileArchive className="w-12 h-12 text-sky-400 mb-2" />
          <h3 className="text-sm font-bold text-slate-50">Drop Files or Folders Here</h3>
          <p className="text-xs text-slate-400 mt-1">
            Drop an archive to inspect it, or drop files/folders to compress them.
          </p>
        </div>
      )}

      {/* Top Navigation & Search Card */}
      <div className="bg-slate-850/90 px-3.5 py-2.5 rounded-xl border border-slate-800 flex items-center justify-between gap-3 shrink-0 shadow-sm">
        <div className="flex items-center gap-2 text-xs flex-1 min-w-0">
          <button
            onClick={handleUp}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-750 border border-slate-700/60 transition text-slate-200 shrink-0"
            title="Up one level"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>

          {/* Mode Badge & Close Archive */}
          {mode === 'archive' ? (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="px-2.5 py-1 rounded-lg bg-sky-500/15 text-sky-400 font-semibold text-[11px] border border-sky-500/25 flex items-center gap-1.5">
                <FileArchive className="w-3.5 h-3.5" />
                <span>Archive View</span>
              </span>
              <button
                onClick={onCloseArchive}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 text-[11px] border border-slate-700/70 flex items-center gap-1 transition"
                title="Close archive and return to Explorer"
              >
                <X className="w-3 h-3 text-slate-400" />
                <span>Close</span>
              </button>
            </div>
          ) : (
            <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 font-medium text-[11px] border border-slate-700/60 shrink-0 flex items-center gap-1.5">
              <FolderOpen className="w-3.5 h-3.5 text-amber-400/90" />
              <span>Explorer</span>
            </span>
          )}

          {/* Interactive Breadcrumb Path Bar */}
          <div className="flex items-center gap-1 text-slate-300 bg-slate-900/70 px-3 py-1.5 rounded-lg border border-slate-800 flex-1 overflow-x-auto whitespace-nowrap">
            {mode === 'archive' ? (
              <>
                <button
                  onClick={() => onNavigateArchive('')}
                  className="hover:text-sky-400 font-medium transition flex items-center gap-1 shrink-0 text-slate-300"
                >
                  <HardDrive className="w-3.5 h-3.5 text-sky-400" />
                  <span>Root</span>
                </button>
                {breadcrumbs.map((crumb, idx) => {
                  const fullPath = breadcrumbs.slice(0, idx + 1).join('/');
                  return (
                    <React.Fragment key={fullPath}>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                      <button
                        onClick={() => onNavigateArchive(fullPath)}
                        className="hover:text-sky-400 font-medium transition text-slate-200"
                      >
                        {crumb}
                      </button>
                    </React.Fragment>
                  );
                })}
              </>
            ) : (
              <>
                {breadcrumbs.map((crumb, idx) => {
                  let target = breadcrumbs.slice(0, idx + 1).join('/');
                  if (idx === 0 && target.endsWith(':')) target += '/';
                  const isLast = idx === breadcrumbs.length - 1;
                  return (
                    <React.Fragment key={target}>
                      {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
                      <button
                        onClick={() => onNavigateFs(target)}
                        className={`px-1 rounded transition ${
                          isLast
                            ? 'font-semibold text-slate-100'
                            : 'text-slate-400 hover:text-sky-400'
                        }`}
                      >
                        {crumb}
                      </button>
                    </React.Fragment>
                  );
                })}
              </>
            )}
          </div>
        </div>

        {/* Right-Click Hold Hint Pill */}
        {mode === 'explorer' && (
          <div
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20 text-[11px] text-sky-400 shrink-0"
            title="Press and hold right-click on any folder to open the Radial Zip Format Wheel"
          >
            <MousePointerClick className="w-3.5 h-3.5" />
            <span>Right-click hold folder = Zip Wheel</span>
          </div>
        )}

        {/* Search Input */}
        <div className="relative w-52 shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-500" />
          <input
            type="text"
            placeholder={mode === 'archive' ? 'Filter archive…' : 'Filter folder…'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900/80 border border-slate-700/70 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-2 text-slate-500 hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main File Table Container */}
      <div className="flex-1 flex flex-col bg-slate-850/60 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
        {/* File Table Header */}
        <div className="bg-slate-850 border-b border-slate-800 grid grid-cols-12 px-4 py-2.5 text-[10.5px] font-semibold text-slate-400 tracking-wider uppercase shrink-0">
          <div
            className="col-span-5 cursor-pointer hover:text-slate-200 flex items-center gap-1"
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
            <span>{mode === 'archive' ? 'Packed' : 'Kind'}</span>
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
            <span>{mode === 'archive' ? 'Security' : 'Action'}</span>
          </div>
        </div>

        {/* File List Rows */}
        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
          {mode === 'archive' ? (
            /* Archive Mode Rows */
            archiveItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm p-8">
                <Folder className="w-10 h-10 text-slate-700 mb-2 stroke-[1.5]" />
                <p className="font-medium text-slate-400 text-xs">No matching entries in archive</p>
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
                    className={`grid grid-cols-12 px-3 py-2 rounded-lg text-xs items-center cursor-pointer transition select-none ${
                      isSelected
                        ? 'bg-sky-500/15 text-slate-50 ring-1 ring-sky-500/30'
                        : 'hover:bg-slate-800/70 text-slate-300'
                    }`}
                  >
                    <div className="col-span-5 flex items-center gap-2.5 truncate pr-2">
                      {getFileIcon(item.isDir, displayName)}
                      <span
                        className={`truncate font-medium ${
                          item.isDir ? 'text-slate-100' : 'text-slate-200'
                        }`}
                      >
                        {displayName}
                      </span>
                    </div>

                    <div className="col-span-2 text-right font-mono text-[11.5px] text-slate-400">
                      {item.isDir ? '—' : formatBytes(item.size)}
                    </div>

                    <div className="col-span-2 text-right font-mono text-[11.5px] text-slate-400">
                      {item.isDir
                        ? '—'
                        : item.compressedSize
                        ? formatBytes(item.compressedSize)
                        : '—'}
                    </div>

                    <div className="col-span-2 text-right text-[11.5px] text-slate-400 truncate">
                      {item.modified || '—'}
                    </div>

                    <div className="col-span-1 flex justify-center">
                      {item.encrypted ? (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[10px]"
                          title="AES-256 Encrypted"
                        >
                          <Lock className="w-3 h-3" />
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
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
                <Folder className="w-10 h-10 text-slate-700 mb-2 stroke-[1.5]" />
                <p className="font-medium text-slate-400 text-xs">This folder is empty</p>
              </div>
            ) : (
              explorerItems.map((item) => {
                const isSelected = selectedItems.has(item.path);
                const isVideo = !item.isDir && isVideoPath(item.name);

                return (
                  <div
                    key={item.path}
                    onClick={(e) => onToggleSelect(item.path, e.ctrlKey || e.metaKey)}
                    onMouseDown={(e) => {
                      if (e.button === 2) {
                        e.preventDefault();
                        e.stopPropagation();
                        openWheelForItem(e.clientX, e.clientY, item);
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDoubleClick={() => {
                      if (item.isDir) {
                        onNavigateFs(item.path);
                      } else if (item.isArchive) {
                        onOpenArchiveFile(item.path);
                      } else if (isVideo && onCompressVideoFile) {
                        onCompressVideoFile(item.path);
                      }
                    }}
                    className={`group grid grid-cols-12 px-3 py-2 rounded-lg text-xs items-center cursor-pointer transition select-none ${
                      isSelected
                        ? 'bg-sky-500/15 text-slate-50 ring-1 ring-sky-500/30'
                        : 'hover:bg-slate-800/70 text-slate-300'
                    }`}
                  >
                    <div className="col-span-5 flex items-center gap-2.5 truncate pr-2">
                      {getFileIcon(item.isDir, item.name, item.isArchive)}
                      <span
                        className={`truncate font-medium ${
                          item.isArchive
                            ? 'text-sky-400 font-semibold'
                            : item.isDir
                            ? 'text-slate-100 font-medium'
                            : 'text-slate-200'
                        }`}
                      >
                        {item.name}
                      </span>
                    </div>

                    <div className="col-span-2 text-right font-mono text-[11.5px] text-slate-400">
                      {item.isDir ? '—' : formatBytes(item.size)}
                    </div>

                    <div className="col-span-2 text-right text-[11.5px] text-slate-400 truncate">
                      {item.isDir
                        ? 'Folder'
                        : item.isArchive
                        ? 'Archive'
                        : isVideo
                        ? 'Video Media'
                        : (item.name.split('.').pop()?.toUpperCase() || 'File')}
                    </div>

                    <div className="col-span-2 text-right text-[11.5px] text-slate-400 truncate">
                      {item.modified || '—'}
                    </div>

                    <div className="col-span-1 flex justify-center text-[10px]">
                      {item.isDir ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openWheelForItem(e.clientX, e.clientY, item);
                          }}
                          className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-sky-500/20 text-slate-400 hover:text-sky-400 border border-slate-700/70 hover:border-sky-500/30 transition flex items-center gap-1"
                          title="Open Zip Format Wheel (or Right-Click & Hold)"
                        >
                          <Disc className="w-3 h-3" />
                          <span className="font-medium">Pack</span>
                        </button>
                      ) : item.isArchive ? (
                        <span className="px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-400 font-mono text-[9.5px] border border-sky-500/20">
                          OPEN
                        </span>
                      ) : isVideo ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCompressVideoFile?.(item.path);
                          }}
                          className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-sky-500/20 text-slate-300 hover:text-sky-400 font-mono text-[9.5px] border border-slate-700 transition flex items-center gap-1"
                          title="Compress this video"
                        >
                          <Video className="w-2.5 h-2.5" />
                          <span>VIDEO</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openWheelForItem(e.clientX, e.clientY, item);
                          }}
                          className="opacity-0 group-hover:opacity-100 px-2 py-0.5 rounded-md bg-slate-800 hover:bg-sky-500/20 text-slate-400 hover:text-sky-400 border border-slate-700/70 transition flex items-center gap-1"
                          title="Quick Pack File"
                        >
                          <Disc className="w-3 h-3" />
                          <span>Pack</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )
          )}
        </div>
      </div>

      {/* Radial Zip Format Wheel */}
      <RadialZipWheel
        isOpen={wheel.isOpen}
        x={wheel.x}
        y={wheel.y}
        targetPath={wheel.targetPath}
        targetName={wheel.targetName}
        isDir={wheel.isDir}
        openedAt={wheel.openedAt}
        onSelectChoice={(choice, path) => {
          onQuickCompressChoice?.(choice, path);
        }}
        onClose={() => setWheel((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
