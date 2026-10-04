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
      openArchiveDialog: () => Promise<string | null>;
      openFilesDialog: () => Promise<string[]>;
      saveArchiveDialog: (defaultName?: string) => Promise<string | null>;
      selectFolderDialog: () => Promise<string | null>;
      listArchive: (path: string, password?: string | null) => Promise<Entry[]>;
      getArchiveInfo: (path: string, password?: string | null) => Promise<ArchiveInfo>;
      createArchive: (options: any) => Promise<string>;
      extractArchive: (options: any) => Promise<string>;
      testArchive: (path: string, password?: string | null) => Promise<string>;
      repairArchive: (archive: string, output?: string | null) => Promise<string>;
      runBenchmark: (config: any) => Promise<BenchReport>;
    };
  }
}
