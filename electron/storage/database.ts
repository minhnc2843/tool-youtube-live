import path from "node:path";
import fs from "node:fs";
import { app } from "electron";

// --- Types ---

export interface StreamRecord {
  id: string;
  name: string;
  video_path: string;
  aspect_ratio: string;
  loop_video: number;
  bitrate: number;
  fps: number;
  audio_bitrate: number;
  auto_reconnect: number;
  reconnect_delay: number;
  max_reconnect_attempts: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface HistoryRecord {
  id: number;
  stream_id: string;
  stream_name: string;
  video_path: string;
  resolution: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  status: string;
  error_message: string | null;
  reconnect_count: number;
}

interface DbStore {
  streams: StreamRecord[];
  history: HistoryRecord[];
  nextHistoryId: number;
}

// --- File I/O ---

const DB_FILE = "app-data.json";
let store: DbStore | null = null;

function dbPath(): string {
  return path.join(app.getPath("userData"), DB_FILE);
}

function loadStore(): DbStore {
  if (store) return store;
  try {
    const data = fs.readFileSync(dbPath(), "utf8");
    store = JSON.parse(data) as DbStore;
    // Ensure all fields exist
    if (!store.streams) store.streams = [];
    if (!store.history) store.history = [];
    if (!store.nextHistoryId) store.nextHistoryId = 1;
  } catch {
    store = { streams: [], history: [], nextHistoryId: 1 };
  }
  return store;
}

function persist(): void {
  const s = loadStore();
  const dir = path.dirname(dbPath());
  fs.mkdirSync(dir, { recursive: true });
  // Atomic write via temp file
  const tmp = dbPath() + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(s, null, 2), "utf8");
  fs.renameSync(tmp, dbPath());
}

// --- Stream CRUD ---

export function loadStreams(): StreamRecord[] {
  return loadStore().streams.sort((a, b) => a.sort_order - b.sort_order);
}

export function saveStream(stream: Partial<StreamRecord> & { id: string }): void {
  const s = loadStore();
  const idx = s.streams.findIndex(r => r.id === stream.id);
  if (idx >= 0) {
    // Update existing
    s.streams[idx] = { ...s.streams[idx], ...stream, updated_at: new Date().toISOString() };
  } else {
    // Insert new
    const now = new Date().toISOString();
    const full: StreamRecord = {
      id: stream.id,
      name: stream.name ?? "",
      video_path: stream.video_path ?? "",
      aspect_ratio: stream.aspect_ratio ?? "16:9",
      loop_video: stream.loop_video ?? 1,
      bitrate: stream.bitrate ?? 5000,
      fps: stream.fps ?? 30,
      audio_bitrate: stream.audio_bitrate ?? 128,
      auto_reconnect: stream.auto_reconnect ?? 1,
      reconnect_delay: stream.reconnect_delay ?? 5,
      max_reconnect_attempts: stream.max_reconnect_attempts ?? 10,
      sort_order: stream.sort_order ?? s.streams.length,
      created_at: now,
      updated_at: now
    };
    s.streams.push(full);
  }
  persist();
}

export function deleteStream(id: string): void {
  const s = loadStore();
  s.streams = s.streams.filter(r => r.id !== id);
  persist();
}

// --- History ---

export function insertRun(run: Omit<HistoryRecord, "id">): number {
  const s = loadStore();
  const id = s.nextHistoryId++;
  const record: HistoryRecord = {
    ...run,
    id,
    started_at: run.started_at || new Date().toISOString(),
    ended_at: run.ended_at ?? null,
    duration_seconds: run.duration_seconds ?? 0,
    error_message: run.error_message ?? null,
    reconnect_count: run.reconnect_count ?? 0
  };
  s.history.push(record);
  // Cap history at 500 records
  if (s.history.length > 500) {
    s.history = s.history.slice(-500);
  }
  persist();
  return id;
}

export function updateRun(id: number, updates: Partial<HistoryRecord>): void {
  const s = loadStore();
  const idx = s.history.findIndex(r => r.id === id);
  if (idx >= 0) {
    s.history[idx] = { ...s.history[idx], ...updates };
    persist();
  }
}

export function getHistory(filter?: string, limit = 100): HistoryRecord[] {
  const s = loadStore();
  let records = [...s.history];
  if (filter && filter !== "All") {
    records = records.filter(r => r.status === filter);
  }
  // Sort by started_at descending
  records.sort((a, b) => (b.started_at || "").localeCompare(a.started_at || ""));
  return records.slice(0, limit);
}

export function closeDatabase(): void {
  // Ensure final persist
  if (store) {
    try { persist(); } catch { /* ignore on shutdown */ }
    store = null;
  }
}
