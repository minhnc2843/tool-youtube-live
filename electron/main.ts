import { app, BrowserWindow, dialog, ipcMain, Menu, Tray, protocol, net } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";

protocol.registerSchemesAsPrivileged([
  { scheme: "media", privileges: { secure: true, supportFetchAPI: true, standard: true, bypassCSP: true } }
]);
import { FFmpegManager } from "./ffmpeg/manager";
import { probeVideo } from "./ffmpeg/probe";
import { SettingsStore } from "./storage/settings";
import { systemStats } from "./system/stats";
import { saveStreamCredential, getStreamCredential, deleteStreamCredential } from "./storage/credentials";
import { loadStreams, saveStream, deleteStream as dbDeleteStream, getHistory, insertRun, updateRun, closeDatabase } from "./storage/database";

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

const settings = new SettingsStore();
const manager = new FFmpegManager(() => mainWindow);

// Apply settings
const currentSettings = settings.get();
manager.setStartDelay((currentSettings.startDelay || 2) * 1000);

function getTrayIconPath(): string {
  if (isDev) {
    return path.join(app.getAppPath(), "resources", "tray.ico");
  }
  return path.join(process.resourcesPath, "tray.ico");
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 940,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#080b12",
    icon: getTrayIconPath(),
    title: "Phát Trực Tiếp Đa Luồng",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (isDev) mainWindow.loadURL("http://127.0.0.1:5173");
  else mainWindow.loadFile(path.join(app.getAppPath(), "dist", "index.html"));

  mainWindow.on("close", (event) => {
    if (manager.activeCount() > 0 && !isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  protocol.handle("media", (request) => {
    const rawPath = request.url.replace(/^media:\/\/\/?/, "");
    const decodedPath = decodeURIComponent(rawPath);
    return net.fetch(pathToFileURL(decodedPath).toString());
  });

  createWindow();

  try {
    const iconPath = getTrayIconPath();
    tray = new Tray(iconPath);
    tray.setToolTip("Phát Trực Tiếp Đa Luồng");
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: "Mở ứng dụng", click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      }},
      { label: "Dừng tất cả", click: () => manager.stopAll() },
      { type: "separator" },
      { label: "Thoát", click: () => { isQuitting = true; manager.stopAll().then(() => app.quit()); } }
    ]));
    tray.on("double-click", () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      } else {
        createWindow();
      }
    });
  } catch (err) {
    console.error("[Main] Failed to create tray icon:", err);
  }

  // --- Video IPC ---
  ipcMain.handle("video:select", async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
      filters: [{ name: "Video", extensions: ["mp4", "mov", "mkv", "avi", "webm", "m4v"] }]
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle("video:probe", async (_e, filePath: string) => {
    try {
      return await probeVideo(filePath, manager.ffprobePath());
    } catch (err) {
      return { error: (err as Error).message };
    }
  });

  // --- FFmpeg IPC ---
  ipcMain.handle("ffmpeg:status", async () => manager.checkFfmpeg());

  ipcMain.handle("stream:start", async (_e, config) => {
    try {
      return await manager.start(config);
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });
  ipcMain.handle("stream:stop", async (_e, id: string) => manager.stop(id));
  ipcMain.handle("stream:restart", async (_e, config) => manager.restart(config));
  ipcMain.handle("stream:startAll", async (_e, configs) => manager.startAll(configs));
  ipcMain.handle("stream:stopAll", async () => manager.stopAll());
  ipcMain.handle("stream:getStatus", async () => manager.statuses());

  // --- Logs IPC ---
  ipcMain.handle("logs:get", async (_e, id: string) => manager.logs(id));
  ipcMain.handle("logs:clear", async (_e, id: string) => manager.clearLogs(id));

  // --- Settings IPC ---
  ipcMain.handle("settings:get", async () => settings.get());
  ipcMain.handle("settings:set", async (_e, value) => {
    const result = settings.set(value);
    manager.setStartDelay((result.startDelay || 2) * 1000);
    return result;
  });

  // --- System IPC ---
  ipcMain.handle("system:stats", async () => systemStats());

  // --- Credential IPC ---
  ipcMain.handle("credential:save", async (_e, streamId: string, key: string) => {
    try {
      saveStreamCredential(streamId, key);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  ipcMain.handle("credential:get", async (_e, streamId: string) => {
    try {
      return { ok: true, key: getStreamCredential(streamId) };
    } catch {
      return { ok: true, key: "" };
    }
  });

  ipcMain.handle("credential:delete", async (_e, streamId: string) => {
    deleteStreamCredential(streamId);
    return { ok: true };
  });

  // --- Persistence IPC ---
  ipcMain.handle("streams:load", async () => {
    try {
      return loadStreams();
    } catch {
      return [];
    }
  });

  ipcMain.handle("streams:save", async (_e, stream) => {
    try {
      saveStream(stream);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  ipcMain.handle("streams:delete", async (_e, id: string) => {
    try {
      await manager.stop(id);
      dbDeleteStream(id);
      deleteStreamCredential(id);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  // --- History IPC ---
  ipcMain.handle("history:get", async (_e, filter?: string) => {
    try {
      return getHistory(filter);
    } catch {
      return [];
    }
  });

  ipcMain.handle("history:insert", async (_e, run) => {
    try {
      return { ok: true, id: insertRun(run) };
    } catch {
      return { ok: false };
    }
  });

  ipcMain.handle("history:update", async (_e, id: number, updates) => {
    try {
      updateRun(id, updates);
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });
});

app.on("before-quit", async () => {
  isQuitting = true;
  await manager.stopAll();
  closeDatabase();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && isQuitting) app.quit();
});