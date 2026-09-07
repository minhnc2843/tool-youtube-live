"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadStreams = loadStreams;
exports.saveStream = saveStream;
exports.deleteStream = deleteStream;
exports.insertRun = insertRun;
exports.updateRun = updateRun;
exports.getHistory = getHistory;
exports.closeDatabase = closeDatabase;
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const electron_1 = require("electron");
// --- File I/O ---
const DB_FILE = "app-data.json";
let store = null;
function dbPath() {
    return node_path_1.default.join(electron_1.app.getPath("userData"), DB_FILE);
}
function loadStore() {
    if (store)
        return store;
    try {
        const data = node_fs_1.default.readFileSync(dbPath(), "utf8");
        store = JSON.parse(data);
        // Ensure all fields exist
        if (!store.streams)
            store.streams = [];
        if (!store.history)
            store.history = [];
        if (!store.nextHistoryId)
            store.nextHistoryId = 1;
    }
    catch {
        store = { streams: [], history: [], nextHistoryId: 1 };
    }
    return store;
}
function persist() {
    const s = loadStore();
    const dir = node_path_1.default.dirname(dbPath());
    node_fs_1.default.mkdirSync(dir, { recursive: true });
    // Atomic write via temp file
    const tmp = dbPath() + ".tmp";
    node_fs_1.default.writeFileSync(tmp, JSON.stringify(s, null, 2), "utf8");
    node_fs_1.default.renameSync(tmp, dbPath());
}
// --- Stream CRUD ---
function loadStreams() {
    return loadStore().streams.sort((a, b) => a.sort_order - b.sort_order);
}
function saveStream(stream) {
    const s = loadStore();
    const idx = s.streams.findIndex(r => r.id === stream.id);
    if (idx >= 0) {
        // Update existing
        s.streams[idx] = { ...s.streams[idx], ...stream, updated_at: new Date().toISOString() };
    }
    else {
        // Insert new
        const now = new Date().toISOString();
        const full = {
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
function deleteStream(id) {
    const s = loadStore();
    s.streams = s.streams.filter(r => r.id !== id);
    persist();
}
// --- History ---
function insertRun(run) {
    const s = loadStore();
    const id = s.nextHistoryId++;
    const record = {
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
function updateRun(id, updates) {
    const s = loadStore();
    const idx = s.history.findIndex(r => r.id === id);
    if (idx >= 0) {
        s.history[idx] = { ...s.history[idx], ...updates };
        persist();
    }
}
function getHistory(filter, limit = 100) {
    const s = loadStore();
    let records = [...s.history];
    if (filter && filter !== "All") {
        records = records.filter(r => r.status === filter);
    }
    // Sort by started_at descending
    records.sort((a, b) => (b.started_at || "").localeCompare(a.started_at || ""));
    return records.slice(0, limit);
}
function closeDatabase() {
    // Ensure final persist
    if (store) {
        try {
            persist();
        }
        catch { /* ignore on shutdown */ }
        store = null;
    }
}
