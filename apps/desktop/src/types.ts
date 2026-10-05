export type ArchiveFormat =
  | 'zip'
  | '7z'
  | 'tar'
  | 'tar.gz'
  | 'tar.bz2'
  | 'tar.xz'
  | 'tar.zst'
  | 'rar';

export interface Entry {
  path: string;
  size: number;
  compressedSize: number | null;
  isDir: boolean;
  modified: string | null;
  encrypted: boolean;
  crc32: number | null;
}

export interface FsItem {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modified: string;
  isArchive: boolean;
}

export interface QuickPlace {
  name: string;
  path: string;
}

export interface ExternalAction {
  action: 'create' | 'extract' | 'open' | 'browse';
  path: string;
}

export interface ArchiveInfo {
  path: string;
  format: ArchiveFormat;
  formatLabel: string;
  archiveSize: number;
  files: number;
  dirs: number;
  totalSize: number;
  packedSize: number | null;
  ratio: number;
  encrypted: boolean;
  canAdd: boolean;
}

export interface BenchResult {
  codec: string;
  codecLabel: string;
  level: number;
  nativeLevel: number;
  threads: number;
  inputBytes: number;
  outputBytes: number;
  ratio: number;
  savingPct: number;
  compressMs: number;
  decompressMs: number;
  compressMbS: number;
  decompressMbS: number;
  pareto: boolean;
}

export interface BenchReport {
  dataset: string;
  inputBytes: number;
  cpuThreads: number;
  results: BenchResult[];
  elapsedMs: number;
}

export interface RepairReport {
  found: number;
  recovered: number;
  verified: number;
  unverifiable: number;
  dropped: string[];
  output: string;
}

export interface ProgressUpdate {
  done: number;
  total: number;
  current: string;
  percent: number;
  speedMbS: number;
}

declare global {
  interface Window {
    arkive?: {
      isDesktop: boolean;

      // Dialogs
      openArchiveDialog: () => Promise<string | null>;
      openFilesDialog: () => Promise<string[]>;
      openFolderDialog: () => Promise<string | null>;
      saveArchiveDialog: (defaultName?: string) => Promise<string | null>;
      selectFolderDialog: () => Promise<string | null>;

      // Filesystem Explorer
      readDirectory: (dirPath?: string) => Promise<{ currentPath: string; items: FsItem[] }>;
      getQuickPlaces: () => Promise<QuickPlace[]>;

      // Shell & External Action
      getStartupAction: () => Promise<ExternalAction | null>;
      onExternalAction: (callback: (action: ExternalAction) => void) => () => void;
      registerContextMenu: () => Promise<boolean>;
      unregisterContextMenu: () => Promise<boolean>;
      isContextMenuRegistered: () => Promise<boolean>;

      // Archive Operations
      listArchive: (path: string, password?: string | null) => Promise<Entry[]>;
      getArchiveInfo: (path: string, password?: string | null) => Promise<ArchiveInfo>;
      createArchive: (options: any) => Promise<string>;
      extractArchive: (options: any) => Promise<string>;
      testArchive: (path: string, password?: string | null) => Promise<string>;
      repairArchive: (archive: string, output?: string | null) => Promise<RepairReport>;
      readEntry: (
        path: string,
        entry: string,
        password?: string | null,
        maxBytes?: number
      ) => Promise<string>;
      runBenchmark: (config: any) => Promise<BenchReport>;
    };
  }
}
