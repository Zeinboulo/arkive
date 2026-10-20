import React, { useState, useMemo, useEffect } from 'react';
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
  Video,
  LayoutGrid,
  List,
  Archive,
} from 'lucide-react';
import { Entry, FsItem } from '../types';
import { formatBytes as formatBytesShared, isVideoPath } from '../format';
import { RadialZipWheel, RadialZipChoice, RADIAL_ZIP_CHOICES } from './RadialZipWheel';

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

  externalWheelTarget?: { path: string; name: string; isDir: boolean; seq: number } | null;

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

const FolderGlyph: React.FC<{ size?: number }> = ({ size = 38 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M4 11C4 8.79086 5.79086 7 8 7H18.3431C19.404 7 20.4214 7.42143 21.1716 8.17157L24 11H40C42.2091 11 44 12.7909 44 15V37C44 39.2091 42.2091 41 40 41H8C5.79086 41 4 39.2091 4 37V11Z"
      fill="#0d9488"
      fillOpacity="0.28"
    />
    <path
      d="M4 17C4 14.7909 5.79086 13 8 13H40C42.2091 13 44 14.7909 44 17V37C44 39.2091 42.2091 41 40 41H8C5.79086 41 4 39.2091 4 37V17Z"
      fill="url(#folder-grad)"
    />
    <defs>
      <linearGradient id="folder-grad" x1="4" y1="13" x2="44" y2="41" gradientUnits="userSpaceOnUse">
        <stop stopColor="#34d399" />
        <stop offset="1" stopColor="#0d9488" />
      </linearGradient>
    </defs>
  </svg>
);

const ArchiveGlyph: React.FC<{ size?: number }> = ({ size = 38 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="6" width="36" height="36" rx="8" fill="#0284c7" fillOpacity="0.22" stroke="#38bdf8" strokeWidth="1.5" />
    <rect x="21" y="8" width="6" height="4" rx="1" fill="#38bdf8" />
    <rect x="21" y="15" width="6" height="4" rx="1" fill="#38bdf8" />
    <rect x="20" y="22" width="8" height="10" rx="2" fill="#34d399" />
  </svg>
);

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
  externalWheelTarget,
  selectedItems,
  onToggleSelect,
  onDropFiles,
}) => {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
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

  useEffect(() => {
    if (externalWheelTarget && externalWheelTarget.path) {
      setWheel({
        isOpen: true,
        x: Math.round(window.innerWidth / 2),
        y: Math.round(window.innerHeight / 2),
        targetPath: externalWheelTarget.path,
        targetName: externalWheelTarget.name,
        isDir: externalWheelTarget.isDir,
        openedAt: Date.now() - 1000,
      });
    }
  }, [externalWheelTarget]);

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

  const activeTargetItem = useMemo(() => {
    if (mode !== 'explorer') return null;
    const first = Array.from(selectedItems)[0];
    if (!first) return null;
    return fsItems.find((i) => i.path === first) || null;
  }, [mode, selectedItems, fsItems]);

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
    if (isDir) return <Folder className="w-4 h-4 text-sky-400 fill-sky-400/20 shrink-0" />;
    if (isArchive) return <FileArchive className="w-4 h-4 text-indigo-400 shrink-0" />;
    const ext = name.split('.').pop()?.toLowerCase();
    if (isVideoPath(name)) {
      return <Video className="w-4 h-4 text-indigo-400 shrink-0" />;
    }
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico'].includes(ext || '')) {
      return <Image className="w-4 h-4 text-slate-300 shrink-0" />;
    }
    if (['rs', 'ts', 'tsx', 'js', 'json', 'py', 'sql', 'c', 'cpp', 'html', 'css'].includes(ext || '')) {
      return <FileCode className="w-4 h-4 text-sky-400 shrink-0" />;
    }
    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'zst', 'tgz'].includes(ext || '')) {
      return <FileArchive className="w-4 h-4 text-indigo-400 shrink-0" />;
    }
    if (['txt', 'md', 'csv', 'log', 'pdf', 'docx'].includes(ext || '')) {
      return <FileText className="w-4 h-4 text-slate-400 shrink-0" />;
    }
    return <FileIcon className="w-4 h-4 text-slate-500 shrink-0" />;
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

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const paths = Array.from(e.dataTransfer.files).map((f: any) => f.path || f.name);
          onDropFiles(paths);
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
      className="flex-1 flex flex-col bg-slate-900 overflow-hidden select-none relative"
    >
      {isDraggingOver && (
        <div className="absolute inset-4 rounded-xl bg-slate-950/90 z-40 border-2 border-dashed border-sky-400 flex flex-col items-center justify-center pointer-events-none">
          <FileArchive className="w-10 h-10 text-sky-400 mb-2" />
          <h3 className="text-sm font-medium text-slate-50">
            Drop files or folders to compress or open
          </h3>
        </div>
      )}

      {/* Clean Top Bar: Navigation Breadcrumbs + Search + View Switcher */}
      <div className="h-12 px-4 border-b border-slate-800/80 bg-slate-900 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            type="button"
            onClick={handleUp}
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-300 transition shrink-0"
            title="Up one folder"
          >
            <ArrowUp className="w-4 h-4" />
          </button>

          {mode === 'archive' && (
            <button
              type="button"
              onClick={onCloseArchive}
              className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs flex items-center gap-1.5 transition shrink-0"
            >
              <X className="w-3.5 h-3.5 text-slate-400" />
              <span>Close Archive</span>
            </button>
          )}

          {/* Clean Breadcrumbs */}
          <div className="flex items-center gap-1 text-[13px] text-slate-300 overflow-x-auto whitespace-nowrap py-1">
            {mode === 'archive' ? (
              <>
                <button
                  type="button"
                  onClick={() => onNavigateArchive('')}
                  className="hover:text-sky-400 font-medium transition flex items-center gap-1.5 text-slate-200"
                >
                  <HardDrive className="w-3.5 h-3.5 text-sky-400" />
                  <span>Archive Root</span>
                </button>
                {breadcrumbs.map((crumb, idx) => {
                  const fullPath = breadcrumbs.slice(0, idx + 1).join('/');
                  return (
                    <React.Fragment key={fullPath}>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                      <button
                        type="button"
                        onClick={() => onNavigateArchive(fullPath)}
                        className="hover:text-sky-400 transition text-slate-200"
                      >
                        {crumb}
                      </button>
                    </React.Fragment>
                  );
                })}
              </>
            ) : (
              breadcrumbs.map((crumb, idx) => {
                let target = breadcrumbs.slice(0, idx + 1).join('/');
                if (idx === 0 && target.endsWith(':')) target += '/';
                const isLast = idx === breadcrumbs.length - 1;
                return (
                  <React.Fragment key={target}>
                    {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
                    <button
                      type="button"
                      onClick={() => onNavigateFs(target)}
                      className={`px-1.5 py-0.5 rounded-md transition ${
                        isLast
                          ? 'font-semibold text-slate-50'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-850'
                      }`}
                    >
                      {crumb}
                    </button>
                  </React.Fragment>
                );
              })
            )}
          </div>
        </div>

        {/* Right Controls: Search + Grid/List View Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative w-52">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-500" />
            <input
              type="text"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-850 border border-slate-800 rounded-md pl-8 pr-7 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1.5 text-slate-500 hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {mode === 'explorer' && (
            <div className="flex items-center rounded-md border border-slate-800 bg-slate-850 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                title="Grid View"
                className={`p-1 rounded-sm transition ${
                  viewMode === 'grid'
                    ? 'bg-slate-750 text-sky-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                title="List View"
                className={`p-1 rounded-sm transition ${
                  viewMode === 'list'
                    ? 'bg-slate-750 text-sky-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {mode === 'explorer' && viewMode === 'grid' ? (
        /* Modern Visual Folder Grid View */
        <div className="flex-1 overflow-y-auto p-5">
          {explorerItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm">
              <FolderGlyph size={48} />
              <p className="mt-2 text-xs text-slate-400">This folder is empty</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {explorerItems.map((item) => {
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
                    className={`group relative flex flex-col items-center text-center p-3.5 rounded-xl border transition cursor-pointer ${
                      isSelected
                        ? 'bg-sky-500/15 border-sky-500/50 shadow-sm'
                        : 'bg-slate-850/70 hover:bg-slate-850 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    {/* Visual Icon */}
                    <div className="h-11 flex items-center justify-center mb-2">
                      {item.isDir ? (
                        <FolderGlyph size={40} />
                      ) : item.isArchive ? (
                        <ArchiveGlyph size={38} />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-750 flex items-center justify-center">
                          {getFileIcon(false, item.name, false)}
                        </div>
                      )}
                    </div>

                    {/* Item Name */}
                    <span className="w-full truncate text-[12.5px] font-medium text-slate-100">
                      {item.name}
                    </span>

                    {/* Sub-label */}
                    <span className="text-[11px] text-slate-400 mt-0.5">
                      {item.isDir ? 'Folder' : formatBytes(item.size)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Clean Semantic Data Table (modern-web-guidance: responsive-table) */
        <div
          tabIndex={0}
          role="region"
          aria-label="Directory contents"
          className="arkive-table-region flex-1 bg-slate-900 focus:outline-none"
        >
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-850 border-b border-slate-800 text-[11px] font-medium text-slate-400 select-none">
              <tr>
                <th
                  scope="col"
                  onClick={() => {
                    if (sortField === 'name') setSortAsc(!sortAsc);
                    else {
                      setSortField('name');
                      setSortAsc(true);
                    }
                  }}
                  className="py-2.5 pl-4 pr-2 border-b border-slate-800 cursor-pointer hover:text-slate-100 w-[50%]"
                >
                  Name {sortField === 'name' ? (sortAsc ? '↑' : '↓') : ''}
                </th>
                <th scope="col" className="py-2.5 px-3 border-b border-slate-800 text-left w-[14%]">
                  {mode === 'archive' ? 'Compressed' : 'Kind'}
                </th>
                <th
                  scope="col"
                  onClick={() => {
                    if (sortField === 'size') setSortAsc(!sortAsc);
                    else {
                      setSortField('size');
                      setSortAsc(true);
                    }
                  }}
                  className="py-2.5 px-3 border-b border-slate-800 text-right cursor-pointer hover:text-slate-100 w-[14%]"
                >
                  Size {sortField === 'size' ? (sortAsc ? '↑' : '↓') : ''}
                </th>
                <th
                  scope="col"
                  onClick={() => {
                    if (sortField === 'modified') setSortAsc(!sortAsc);
                    else {
                      setSortField('modified');
                      setSortAsc(true);
                    }
                  }}
                  className="py-2.5 px-4 border-b border-slate-800 text-right cursor-pointer hover:text-slate-100 w-[22%]"
                >
                  Modified {sortField === 'modified' ? (sortAsc ? '↑' : '↓') : ''}
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/50 text-[13px]">
              {mode === 'archive' ? (
                archiveItems.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-16 text-center text-slate-500 text-xs">
                      No matching entries in archive
                    </td>
                  </tr>
                ) : (
                  archiveItems.map((item) => {
                    const isSelected = selectedItems.has(item.path);
                    const displayName = search.trim()
                      ? item.path
                      : item.path.split('/').pop() || item.path;

                    return (
                      <tr
                        key={item.path}
                        onClick={(e) => onToggleSelect(item.path, e.ctrlKey || e.metaKey)}
                        onDoubleClick={() => {
                          if (item.isDir) {
                            onNavigateArchive(item.path);
                          } else {
                            onPreviewArchive(item);
                          }
                        }}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-sky-500/15 text-slate-50'
                            : 'hover:bg-slate-850/80 text-slate-200'
                        }`}
                      >
                        <th
                          scope="row"
                          className={`py-2 pl-4 pr-2 font-normal text-left ${
                            isSelected ? '!bg-sky-500/15' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            {getFileIcon(item.isDir, displayName)}
                            <span className="truncate font-medium">{displayName}</span>
                            {item.encrypted && <Lock className="w-3 h-3 text-sky-400 shrink-0" />}
                          </div>
                        </th>
                        <td className="py-2 px-3 text-xs text-slate-400">
                          {item.isDir
                            ? 'Folder'
                            : item.compressedSize
                            ? formatBytes(item.compressedSize)
                            : '—'}
                        </td>
                        <td className="py-2 px-3 text-right text-xs text-slate-300 tabular-nums">
                          {item.isDir ? '—' : formatBytes(item.size)}
                        </td>
                        <td className="py-2 px-4 text-right text-xs text-slate-400 tabular-nums">
                          {item.modified || '—'}
                        </td>
                      </tr>
                    );
                  })
                )
              ) : (
                explorerItems.map((item) => {
                  const isSelected = selectedItems.has(item.path);
                  const isVideo = !item.isDir && isVideoPath(item.name);

                  return (
                    <tr
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
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-sky-500/15 text-slate-50'
                          : 'hover:bg-slate-850/80 text-slate-200'
                      }`}
                    >
                      <th
                        scope="row"
                        className={`py-2 pl-4 pr-2 font-normal text-left ${
                          isSelected ? '!bg-sky-500/15' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          {getFileIcon(item.isDir, item.name, item.isArchive)}
                          <span className="truncate font-medium">{item.name}</span>
                        </div>
                      </th>
                      <td className="py-2 px-3 text-xs text-slate-400">
                        {item.isDir ? 'Folder' : item.isArchive ? 'Archive' : 'File'}
                      </td>
                      <td className="py-2 px-3 text-right text-xs text-slate-300 tabular-nums">
                        {item.isDir ? '—' : formatBytes(item.size)}
                      </td>
                      <td className="py-2 px-4 text-right text-xs text-slate-400 tabular-nums">
                        {item.modified || '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Contextual Quick-Compress Bar when an item is selected */}
      {mode === 'explorer' && activeTargetItem && (
        <div className="px-4 py-2.5 border-t border-slate-800/80 bg-slate-850 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Archive className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="text-xs text-slate-300 truncate">
              Quick compress <strong className="text-slate-100">{activeTargetItem.name}</strong> as:
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {RADIAL_ZIP_CHOICES.map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => onQuickCompressChoice?.(ch, activeTargetItem.path)}
                className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-sky-600 text-slate-200 hover:text-white border border-slate-750 hover:border-sky-500 text-xs font-medium transition"
              >
                {ch.label}
              </button>
            ))}
          </div>
        </div>
      )}

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
