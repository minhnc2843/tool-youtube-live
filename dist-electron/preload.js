"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld("desktop", {
    // Video
    selectVideo: () => electron_1.ipcRenderer.invoke("video:select"),
    probeVideo: (path) => electron_1.ipcRenderer.invoke("video:probe", path),
    // FFmpeg
    ffmpegStatus: () => electron_1.ipcRenderer.invoke("ffmpeg:status"),
    // Stream control
    startStream: (config) => electron_1.ipcRenderer.invoke("stream:start", config),
    stopStream: (id) => electron_1.ipcRenderer.invoke("stream:stop", id),
    restartStream: (config) => electron_1.ipcRenderer.invoke("stream:restart", config),
    startAll: (configs) => electron_1.ipcRenderer.invoke("stream:startAll", configs),
    stopAll: () => electron_1.ipcRenderer.invoke("stream:stopAll"),
    getStatuses: () => electron_1.ipcRenderer.invoke("stream:getStatus"),
    // Logs
    getLogs: (id) => electron_1.ipcRenderer.invoke("logs:get", id),
    clearLogs: (id) => electron_1.ipcRenderer.invoke("logs:clear", id),
    // Settings
    getSettings: () => electron_1.ipcRenderer.invoke("settings:get"),
    setSettings: (settings) => electron_1.ipcRenderer.invoke("settings:set", settings),
    // System
    getSystemStats: () => electron_1.ipcRenderer.invoke("system:stats"),
    // Credentials (secure stream key storage)
    saveCredential: (streamId, key) => electron_1.ipcRenderer.invoke("credential:save", streamId, key),
    getCredential: (streamId) => electron_1.ipcRenderer.invoke("credential:get", streamId),
    deleteCredential: (streamId) => electron_1.ipcRenderer.invoke("credential:delete", streamId),
    // Stream persistence
    loadStreams: () => electron_1.ipcRenderer.invoke("streams:load"),
    saveStreamData: (stream) => electron_1.ipcRenderer.invoke("streams:save", stream),
    deleteStreamData: (id) => electron_1.ipcRenderer.invoke("streams:delete", id),
    // History
    getHistory: (filter) => electron_1.ipcRenderer.invoke("history:get", filter),
    insertHistoryRun: (run) => electron_1.ipcRenderer.invoke("history:insert", run),
    updateHistoryRun: (id, updates) => electron_1.ipcRenderer.invoke("history:update", id, updates),
    // Event listeners
    onStatus: (callback) => {
        const handler = (_event, payload) => callback(payload);
        electron_1.ipcRenderer.on("stream:status", handler);
        return () => electron_1.ipcRenderer.removeListener("stream:status", handler);
    },
    onLog: (callback) => {
        const handler = (_event, payload) => callback(payload);
        electron_1.ipcRenderer.on("stream:log", handler);
        return () => electron_1.ipcRenderer.removeListener("stream:log", handler);
    }
});
