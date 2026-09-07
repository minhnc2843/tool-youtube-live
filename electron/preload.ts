import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktop", {
  // Video
  selectVideo: () => ipcRenderer.invoke("video:select"),
  probeVideo: (path: string) => ipcRenderer.invoke("video:probe", path),

  // FFmpeg
  ffmpegStatus: () => ipcRenderer.invoke("ffmpeg:status"),

  // Stream control
  startStream: (config: unknown) => ipcRenderer.invoke("stream:start", config),
  stopStream: (id: string) => ipcRenderer.invoke("stream:stop", id),
  restartStream: (config: unknown) => ipcRenderer.invoke("stream:restart", config),
  startAll: (configs: unknown[]) => ipcRenderer.invoke("stream:startAll", configs),
  stopAll: () => ipcRenderer.invoke("stream:stopAll"),
  getStatuses: () => ipcRenderer.invoke("stream:getStatus"),

  // Logs
  getLogs: (id: string) => ipcRenderer.invoke("logs:get", id),
  clearLogs: (id: string) => ipcRenderer.invoke("logs:clear", id),

  // Settings
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSettings: (settings: unknown) => ipcRenderer.invoke("settings:set", settings),

  // System
  getSystemStats: () => ipcRenderer.invoke("system:stats"),

  // Credentials (secure stream key storage)
  saveCredential: (streamId: string, key: string) => ipcRenderer.invoke("credential:save", streamId, key),
  getCredential: (streamId: string) => ipcRenderer.invoke("credential:get", streamId),
  deleteCredential: (streamId: string) => ipcRenderer.invoke("credential:delete", streamId),

  // Stream persistence
  loadStreams: () => ipcRenderer.invoke("streams:load"),
  saveStreamData: (stream: unknown) => ipcRenderer.invoke("streams:save", stream),
  deleteStreamData: (id: string) => ipcRenderer.invoke("streams:delete", id),

  // History
  getHistory: (filter?: string) => ipcRenderer.invoke("history:get", filter),
  insertHistoryRun: (run: unknown) => ipcRenderer.invoke("history:insert", run),
  updateHistoryRun: (id: number, updates: unknown) => ipcRenderer.invoke("history:update", id, updates),

  // Event listeners
  onStatus: (callback: (payload: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown) => callback(payload);
    ipcRenderer.on("stream:status", handler);
    return () => ipcRenderer.removeListener("stream:status", handler);
  },
  onLog: (callback: (payload: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown) => callback(payload);
    ipcRenderer.on("stream:log", handler);
    return () => ipcRenderer.removeListener("stream:log", handler);
  }
});