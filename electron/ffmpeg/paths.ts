import path from "node:path";
import fs from "node:fs";
import { app } from "electron";

export function findBinary(name: "ffmpeg.exe" | "ffprobe.exe", customPath?: string): string {
  if (customPath) {
    const custom = customPath.endsWith(name) ? customPath : path.join(customPath, name);
    if (fs.existsSync(custom)) return custom;
  }
  const candidates = [
    path.join(process.resourcesPath, "ffmpeg", name),
    path.join(app.getAppPath(), "resources", "ffmpeg", name),
    name // fallback to PATH
  ];
  return candidates.find(p => {
    try { return fs.existsSync(p); } catch { return false; }
  }) ?? name;
}