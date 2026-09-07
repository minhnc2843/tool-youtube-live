import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

export interface AppSettings {
  defaultAspectRatio: "9:16" | "16:9";
  defaultFps: number;
  defaultBitrate: number;
  audioBitrate: number;
  loop: boolean;
  autoReconnect: boolean;
  reconnectDelay: number;
  startDelay: number;
  maxReconnectAttempts: number;
  ffmpegPath?: string;
}

export class SettingsStore {
  private file: string;
  private defaults: AppSettings = {
    defaultAspectRatio: "16:9",
    defaultFps: 30,
    defaultBitrate: 5000,
    audioBitrate: 128,
    loop: true,
    autoReconnect: true,
    reconnectDelay: 5,
    startDelay: 2,
    maxReconnectAttempts: 10
  };

  constructor() {
    this.file = path.join(app.getPath("userData"), "settings.json");
  }

  get(): AppSettings {
    try { return { ...this.defaults, ...JSON.parse(fs.readFileSync(this.file, "utf8")) }; }
    catch { return this.defaults; }
  }

  set(value: Partial<AppSettings>) {
    const next = { ...this.get(), ...value };
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(next, null, 2), "utf8");
    return next;
  }
}