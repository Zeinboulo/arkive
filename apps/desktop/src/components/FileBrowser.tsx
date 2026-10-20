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
  FolderOpen,
  Video,
  Disc,
  CornerDownRight,
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

  // Optional external trigger to pop open the radial wheel (e.g. from Windows Explorer right-click)
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

  // Open wheel automatically if triggered externally (e.g. from Windows Explorer context menu)
  useEffect(() => {
    if (externalWheelTarget && externalWheelTarget.path) {
      setWheel({
        isOpen: true,
        x: Math.round(window.innerWidth / 2),
        y: Math.round(window.innerHeight / 2),
        targetPath: externalWheelTarget.path,
        targetName: externalWheelTarget.name,
        isDir: externalWheelTarget.isDir,
        openedAt: Date.now() - 1000, // Pinned mode
      });
    }
  }, [externalWheelTarget]);

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

  // Focused item for the right inspector panel
  const inspectedItem = useMemo(() => {
    if (mode !== 'explorer') return null;
    const firstSelectedPath = Array.from(selectedItems)[0];
    if (firstSelectedPath) {
      const found = fsItems.find((i) => i.path === firstSelectedPath);
      if (found) return found;
    }
    if (currentFsPath) {
      const base = currentFsPath.replace(/[\\/]$/, '').split(/[\\/]/).pop() || currentFsPath;
      return {
        name: base,
        path: currentFsPath,
        isDir: true,
        size: 0,
        modified: 'Current Directory',
        isArchive: false,
      } as FsItem;
    }
    return null;
  }, [mode, selectedItems, fsItems, currentFsPath]);

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
    if (isDir) return <Folder className="w-3.5 h-3.5 text-sky-400 fill-sky-400/15 shrink-0" />;
    if (isArchive) return <FileArchive className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    const ext = name.split('.').pop()?.toLowerCase();
    if (isVideoPath(name)) {
      return <Video className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
    }
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico'].includes(ext || '')) {
      return <Image className="w-3.5 h-3.5 text-slate-300 shrink-0" />;
    }
    if (['rs', 'ts', 'tsx', 'js', 'json', 'py', 'sql', 'c', 'cpp', 'html', 'css'].includes(ext || '')) {
      return <FileCode className="w-3.5 h-3.5 text-slate-300 shrink-0" />;
    }
    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'zst', 'tgz'].includes(ext || '')) {
      return <FileArchive className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    }
    if (['txt', 'md', 'csv', 'log', 'pdf', 'docx'].includes(ext || '')) {
      return <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
    }
    return <FileIcon className="w-3.5 h-3.5 text-slate-500 shrink-0" />;
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
      className="flex-1 flex flex-col bg-slate-900 overflow-hidden select-none relative"
    >
      {/* Drag & Drop Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-2 rounded bg-slate-950/90 z-40 border border-dashed border-sky-400 flex flex-col items-center justify-center pointer-events-none">
          <FileArchive className="w-10 h-10 text-sky-400 mb-2" />
          <h3 className="text-xs font-mono uppercase tracking-wider text-slate-50">
            Drop Files or Folders to Pack / Inspect
          </h3>
        </div>
      )}

      {/* Address & Filter Bar (Edge-to-Edge Hardware Strip) */}
      <div className="bg-slate-850 px-3 h-9 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5 text-xs flex-1 min-w-0">
          <button
            type="button"
            onClick={handleUp}
            className="p-1 rounded-sm bg-slate-900 hover:bg-slate-800 border border-slate-750 transition text-slate-200 shrink-0"
            title="Up one directory level"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>

          {mode === 'archive' ? (
            <div className="flex items-center gap-1 shrink-0">
              <span className="px-2 py-0.5 rounded-sm bg-emerald-500/15 text-emerald-400 font-mono text-[10.5px] border border-emerald-500/30 flex items-center gap-1">
                <FileArchive className="w-3 h-3" />
                <span>ARCHIVE</span>
              </span>
              <button
                type="button"
                onClick={onCloseArchive}
                className="px-2 py-0.5 rounded-sm bg-slate-900 hover:bg-slate-800 text-slate-300 font-mono text-[10.5px] border border-slate-750 flex items-center gap-1 transition"
                title="Close archive and return to Explorer"
              >
                <X className="w-3 h-3 text-slate-400" />
                <span>EXIT</span>
              </button>
            </div>
          ) : (
            <span className="px-2 py-0.5 rounded-sm bg-slate-900 text-slate-400 font-mono text-[10.5px] border border-slate-800 shrink-0 flex items-center gap-1">
              <FolderOpen className="w-3 h-3 text-sky-400" />
              <span>FS</span>
            </span>
          )}

          {/* Interactive Breadcrumb Path Bar */}
          <div className="flex items-center gap-0.5 font-mono text-[11.5px] text-slate-300 bg-slate-900 px-2.5 py-0.5 rounded-sm border border-slate-800 flex-1 overflow-x-auto whitespace-nowrap">
            {mode === 'archive' ? (
              <>
                <button
                  type="button"
                  onClick={() => onNavigateArchive('')}
                  className="hover:text-sky-400 transition flex items-center gap-1 shrink-0 text-slate-300"
                >
                  <HardDrive className="w-3 h-3 text-emerald-400" />
                  <span>/</span>
                </button>
                {breadcrumbs.map((crumb, idx) => {
                  const fullPath = breadcrumbs.slice(0, idx + 1).join('/');
                  return (
                    <React.Fragment key={fullPath}>
                      <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
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
              <>
                {breadcrumbs.map((crumb, idx) => {
                  let target = breadcrumbs.slice(0, idx + 1).join('/');
                  if (idx === 0 && target.endsWith(':')) target += '/';
                  const isLast = idx === breadcrumbs.length - 1;
                  return (
                    <React.Fragment key={target}>
                      {idx > 0 && <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />}
                      <button
                        type="button"
                        onClick={() => onNavigateFs(target)}
                        className={`px-1 rounded-sm transition ${
                          isLast
                            ? 'font-semibold text-slate-50 bg-slate-800/70'
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

        {/* Filter Input */}
        <div className="relative w-52 shrink-0">
          <Search className="w-3 h-3 absolute left-2.5 top-2 text-slate-500" />
          <input
            type="text"
            placeholder={mode === 'archive' ? 'Filter entries…' : 'Filter directory…'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-sm pl-7 pr-6 py-1 font-mono text-[11px] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-1.5 top-1.5 text-slate-500 hover:text-slate-200"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Main Split Workspace: Semantic Data Table + Right Inspector Panel */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left/Center: Semantic Data Table (modern-web-guidance: responsive-table) */}
        <div
          tabIndex={0}
          role="region"
          aria-label="Directory contents"
          className="arkive-table-region flex-1 bg-slate-900 focus:outline-none"
        >
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-850 border-b border-slate-800 text-[10px] font-mono uppercase tracking-wider text-slate-400 select-none">
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
                  className="py-2 pl-3 pr-2 border-b border-r border-slate-800 cursor-pointer hover:text-slate-100 w-[46%]"
                >
                  Name {sortField === 'name' ? (sortAsc ? '↑' : '↓') : ''}
                </th>
                <th
                  scope="col"
                  className="py-2 px-2.5 border-b border-r border-slate-800 text-left w-[12%]"
                >
                  {mode === 'archive' ? 'Packed' : 'Type'}
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
                  className="py-2 px-2.5 border-b border-r border-slate-800 text-right cursor-pointer hover:text-slate-100 w-[14%]"
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
                  className="py-2 px-2.5 border-b border-r border-slate-800 text-right cursor-pointer hover:text-slate-100 w-[18%]"
                >
                  Modified {sortField === 'modified' ? (sortAsc ? '↑' : '↓') : ''}
                </th>
                <th
                  scope="col"
                  className="py-2 px-2 border-b border-slate-800 text-center w-[10%]"
                >
                  {mode === 'archive' ? 'CRC / Enc' : 'Quick Pack'}
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60 text-xs">
              {mode === 'archive' ? (
                archiveItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-slate-500 font-mono text-xs">
                      [ No matching entries in archive ]
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
                            : 'hover:bg-slate-850 text-slate-200'
                        }`}
                      >
                        <th
                          scope="row"
                          className={`py-1.5 pl-3 pr-2 font-normal text-left border-r border-slate-800/50 ${
                            isSelected ? '!bg-sky-500/15' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            {getFileIcon(item.isDir, displayName)}
                            <span
                              className={`truncate ${
                                item.isDir ? 'font-semibold text-slate-50' : 'text-slate-200'
                              }`}
                            >
                              {displayName}
                            </span>
                          </div>
                        </th>
                        <td className="py-1.5 px-2.5 font-mono text-[11px] text-slate-400 border-r border-slate-800/50">
                          {item.isDir
                            ? 'DIR'
                            : item.compressedSize
                            ? formatBytes(item.compressedSize)
                            : '—'}
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-mono text-[11px] text-slate-300 tabular-nums border-r border-slate-800/50">
                          {item.isDir ? '—' : formatBytes(item.size)}
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-mono text-[11px] text-slate-400 tabular-nums border-r border-slate-800/50">
                          {item.modified || '—'}
                        </td>
                        <td className="py-1.5 px-2 text-center font-mono text-[10px]">
                          {item.encrypted ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-sm bg-sky-500/15 text-sky-400 border border-sky-500/30">
                              <Lock className="w-2.5 h-2.5" />
                              <span>AES</span>
                            </span>
                          ) : (
                            <span className="text-slate-500">{item.crc32 || 'OK'}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )
              ) : explorerItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-500 font-mono text-xs">
                    [ Directory is empty ]
                  </td>
                </tr>
              ) : (
                explorerItems.map((item) => {
                  const isSelected = selectedItems.has(item.path);
                  const isVideo = !item.isDir && isVideoPath(item.name);
                  const ext = item.isDir
                    ? 'DIR'
                    : item.isArchive
                    ? 'ARCHIVE'
                    : isVideo
                    ? 'VIDEO'
                    : item.name.includes('.')
                    ? item.name.split('.').pop()?.toUpperCase() || 'FILE'
                    : 'FILE';

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
                      className={`group cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-sky-500/15 text-slate-50'
                          : 'hover:bg-slate-850 text-slate-200'
                      }`}
                    >
                      <th
                        scope="row"
                        className={`py-1.5 pl-3 pr-2 font-normal text-left border-r border-slate-800/50 ${
                          isSelected ? '!bg-sky-500/15' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {getFileIcon(item.isDir, item.name, item.isArchive)}
                          <span
                            className={`truncate ${
                              item.isArchive
                                ? 'text-emerald-400 font-semibold'
                                : item.isDir
                                ? 'text-slate-100 font-medium'
                                : 'text-slate-200'
                            }`}
                          >
                            {item.name}
                          </span>
                        </div>
                      </th>

                      <td className="py-1.5 px-2.5 font-mono text-[10.5px] text-slate-400 border-r border-slate-800/50">
                        <span
                          className={
                            item.isDir
                              ? 'text-sky-400/90 font-semibold'
                              : item.isArchive
                              ? 'text-emerald-400'
                              : 'text-slate-400'
                          }
                        >
                          {ext}
                        </span>
                      </td>

                      <td className="py-1.5 px-2.5 text-right font-mono text-[11px] text-slate-300 tabular-nums border-r border-slate-800/50">
                        {item.isDir ? '—' : formatBytes(item.size)}
                      </td>

                      <td className="py-1.5 px-2.5 text-right font-mono text-[11px] text-slate-400 tabular-nums border-r border-slate-800/50">
                        {item.modified || '—'}
                      </td>

                      <td className="py-1 px-2 text-center">
                        {item.isArchive ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenArchiveFile(item.path);
                            }}
                            className="px-2 py-0.5 rounded-sm bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 font-mono text-[10px] border border-emerald-500/30 transition"
                          >
                            INSPECT
                          </button>
                        ) : isVideo ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCompressVideoFile?.(item.path);
                            }}
                            className="px-2 py-0.5 rounded-sm bg-slate-850 hover:bg-sky-500/20 text-slate-300 hover:text-sky-400 font-mono text-[10px] border border-slate-700 transition inline-flex items-center gap-1"
                          >
                            <Video className="w-2.5 h-2.5" />
                            <span>ENCODE</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openWheelForItem(e.clientX, e.clientY, item);
                            }}
                            className="px-2 py-0.5 rounded-sm bg-slate-850 hover:bg-sky-500/20 text-slate-300 hover:text-sky-400 font-mono text-[10px] border border-slate-750 hover:border-sky-500/40 transition inline-flex items-center gap-1"
                            title="Click or Right-Click & Hold to open Radial Format Wheel"
                          >
                            <Disc className="w-2.5 h-2.5 text-sky-400" />
                            <span>PACK</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Right Hardware Inspector & Direct Pack Dock */}
        {mode === 'explorer' && inspectedItem && (
          <aside className="hidden lg:flex w-64 shrink-0 flex-col border-l border-slate-800 bg-slate-950/80 p-3 justify-between">
            <div className="space-y-3">
              {/* Target Header */}
              <div className="border-b border-slate-800 pb-2.5">
                <div className="text-[9.5px] font-mono uppercase tracking-wider text-slate-500 mb-1">
                  TARGET INSPECTOR //
                </div>
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 p-1.5 rounded-sm bg-slate-900 border border-slate-800">
                    {getFileIcon(inspectedItem.isDir, inspectedItem.name, inspectedItem.isArchive)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-slate-100 truncate">
                      {inspectedItem.name}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 truncate mt-0.5">
                      {inspectedItem.isDir ? 'Directory' : formatBytes(inspectedItem.size)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Instant Format Matrix */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                    INSTANT PACK FORMAT
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      openWheelForItem(rect.left - 120, rect.top + 80, inspectedItem);
                    }}
                    className="text-[10px] font-mono text-sky-400 hover:underline flex items-center gap-1"
                  >
                    <Disc className="w-3 h-3" />
                    <span>Open Wheel</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {RADIAL_ZIP_CHOICES.map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => onQuickCompressChoice?.(ch, inspectedItem.path)}
                      className={`px-2.5 py-1.5 rounded-sm border text-left transition flex flex-col ${
                        ch.isCustomModal
                          ? 'col-span-2 bg-slate-900 hover:bg-slate-800 border-slate-750 text-slate-200'
                          : 'bg-slate-900 hover:bg-sky-500/15 border-slate-800 hover:border-sky-500/40 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-mono font-bold text-[11px] text-slate-100">
                          {ch.label}
                        </span>
                        <span className="font-mono text-[9.5px] text-sky-400">{ch.code}</span>
                      </div>
                      <span className="text-[9.5px] text-slate-400 truncate mt-0.5">
                        {ch.subtitle}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Gesture Guide Box */}
            <div className="rounded-sm border border-slate-800 bg-slate-900/90 p-2.5 space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-sky-400 uppercase">
                <CornerDownRight className="w-3 h-3" />
                <span>Radial Gesture</span>
              </div>
              <p className="text-[10.5px] text-slate-400 leading-relaxed">
                Press &amp; hold <strong className="text-slate-200 font-mono">Right-Click</strong> on any folder row, drag toward a format slice (<span className="font-mono text-slate-300">.zip</span>, <span className="font-mono text-slate-300">.7z</span>, <span className="font-mono text-slate-300">.tar.zst</span>), and release to pack immediately.
              </p>
            </div>
          </aside>
        )}
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
