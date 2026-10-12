/** Human-readable byte size. Returns '-' for non-positive values when `dash` is set. */
export function formatBytes(bytes: number, dash = false): string {
  if (!bytes || bytes <= 0) return dash ? '-' : '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

const ARCHIVE_EXT = ['zip', '7z', 'rar', 'tar', 'gz', 'bz2', 'xz', 'zst', 'tgz', 'tbz2', 'txz'];
const VIDEO_EXT = ['mp4', 'mkv', 'mov', 'avi', 'webm', 'flv', 'wmv', 'm4v', 'ts'];

const extOf = (p: string) => p.split('.').pop()?.toLowerCase() ?? '';

export const isArchivePath = (p: string) => ARCHIVE_EXT.includes(extOf(p));
export const isVideoPath = (p: string) => VIDEO_EXT.includes(extOf(p));
