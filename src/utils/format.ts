export function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${units[i]}`;
}

export function formatDuration(seconds: number) {
  if (!seconds || !Number.isFinite(seconds)) return "00:00:00";
  const s = Math.floor(seconds);
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map(v => String(v).padStart(2, "0")).join(":");
}