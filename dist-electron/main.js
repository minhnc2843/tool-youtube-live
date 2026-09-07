"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const node_path_1 = __importDefault(require("node:path"));
const node_url_1 = require("node:url");
electron_1.protocol.registerSchemesAsPrivileged([
    { scheme: "media", privileges: { secure: true, supportFetchAPI: true, standard: true, bypassCSP: true } }
]);
const manager_1 = require("./ffmpeg/manager");
const probe_1 = require("./ffmpeg/probe");
const settings_1 = require("./storage/settings");
const stats_1 = require("./system/stats");
const credentials_1 = require("./storage/credentials");
const database_1 = require("./storage/database");
const isDev = !electron_1.app.isPackaged;
let mainWindow = null;
let tray = null;
let isQuitting = false;
const settings = new settings_1.SettingsStore();
const manager = new manager_1.FFmpegManager(() => mainWindow);
// Apply settings
const currentSettings = settings.get();
manager.setStartDelay((currentSettings.startDelay || 2) * 1000);
function getTrayIconPath() {
    if (isDev) {
        return node_path_1.default.join(electron_1.app.getAppPath(), "resources", "tray.ico");
    }
    return node_path_1.default.join(process.resourcesPath, "tray.ico");
}
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1500,
        height: 940,
        minWidth: 1100,
        minHeight: 700,
        backgroundColor: "#080b12",
        icon: getTrayIconPath(),
        title: "Phát Trực Tiếp Đa Luồng",
        webPreferences: {
            preload: node_path_1.default.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    });
    if (isDev)
        mainWindow.loadURL("http://127.0.0.1:5173");
    else
        mainWindow.loadFile(node_path_1.default.join(electron_1.app.getAppPath(), "dist", "index.html"));
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
electron_1.app.whenReady().then(() => {
    electron_1.protocol.handle("media", (request) => {
        const rawPath = request.url.replace(/^media:\/\/\/?/, "");
        const decodedPath = decodeURIComponent(rawPath);
        return electron_1.net.fetch((0, node_url_1.pathToFileURL)(decodedPath).toString());
    });
    createWindow();
    try {
        const iconPath = getTrayIconPath();
        tray = new electron_1.Tray(iconPath);
        tray.setToolTip("Phát Trực Tiếp Đa Luồng");
        tray.setContextMenu(electron_1.Menu.buildFromTemplate([
            { label: "Mở ứng dụng", click: () => {
                    if (mainWindow) {
                        mainWindow.show();
                        mainWindow.focus();
                    }
                    else {
                        createWindow();
                    }
                } },
            { label: "Dừng tất cả", click: () => manager.stopAll() },
            { type: "separator" },
            { label: "Thoát", click: () => { isQuitting = true; manager.stopAll().then(() => electron_1.app.quit()); } }
        ]));
        tray.on("double-click", () => {
            if (mainWindow) {
                mainWindow.show();
                mainWindow.focus();
            }
            else {
                createWindow();
            }
        });
    }
    catch (err) {
        console.error("[Main] Failed to create tray icon:", err);
    }
    // --- Video IPC ---
    electron_1.ipcMain.handle("video:select", async () => {
        if (!mainWindow)
            return null;
        const result = await electron_1.dialog.showOpenDialog(mainWindow, {
            properties: ["openFile"],
            filters: [{ name: "Video", extensions: ["mp4", "mov", "mkv", "avi", "webm", "m4v"] }]
        });
        return result.canceled ? null : result.filePaths[0];
    });
    electron_1.ipcMain.handle("video:probe", async (_e, filePath) => {
        try {
            return await (0, probe_1.probeVideo)(filePath, manager.ffprobePath());
        }
        catch (err) {
            return { error: err.message };
        }
    });
    // --- FFmpeg IPC ---
    electron_1.ipcMain.handle("ffmpeg:status", async () => manager.checkFfmpeg());
    electron_1.ipcMain.handle("stream:start", async (_e, config) => {
        try {
            return await manager.start(config);
        }
        catch (err) {
            return { ok: false, error: err.message };
        }
    });
    electron_1.ipcMain.handle("stream:stop", async (_e, id) => manager.stop(id));
    electron_1.ipcMain.handle("stream:restart", async (_e, config) => manager.restart(config));
    electron_1.ipcMain.handle("stream:startAll", async (_e, configs) => manager.startAll(configs));
    electron_1.ipcMain.handle("stream:stopAll", async () => manager.stopAll());
    electron_1.ipcMain.handle("stream:getStatus", async () => manager.statuses());
    // --- Logs IPC ---
    electron_1.ipcMain.handle("logs:get", async (_e, id) => manager.logs(id));
    electron_1.ipcMain.handle("logs:clear", async (_e, id) => manager.clearLogs(id));
    // --- Settings IPC ---
    electron_1.ipcMain.handle("settings:get", async () => settings.get());
    electron_1.ipcMain.handle("settings:set", async (_e, value) => {
        const result = settings.set(value);
        manager.setStartDelay((result.startDelay || 2) * 1000);
        return result;
    });
    // --- System IPC ---
    electron_1.ipcMain.handle("system:stats", async () => (0, stats_1.systemStats)());
    // --- Credential IPC ---
    electron_1.ipcMain.handle("credential:save", async (_e, streamId, key) => {
        try {
            (0, credentials_1.saveStreamCredential)(streamId, key);
            return { ok: true };
        }
        catch (err) {
            return { ok: false, error: err.message };
        }
    });
    electron_1.ipcMain.handle("credential:get", async (_e, streamId) => {
        try {
            return { ok: true, key: (0, credentials_1.getStreamCredential)(streamId) };
        }
        catch {
            return { ok: true, key: "" };
        }
    });
    electron_1.ipcMain.handle("credential:delete", async (_e, streamId) => {
        (0, credentials_1.deleteStreamCredential)(streamId);
        return { ok: true };
    });
    // --- Persistence IPC ---
    electron_1.ipcMain.handle("streams:load", async () => {
        try {
            return (0, database_1.loadStreams)();
        }
        catch {
            return [];
        }
    });
    electron_1.ipcMain.handle("streams:save", async (_e, stream) => {
        try {
            (0, database_1.saveStream)(stream);
            return { ok: true };
        }
        catch (err) {
            return { ok: false, error: err.message };
        }
    });
    electron_1.ipcMain.handle("streams:delete", async (_e, id) => {
        try {
            await manager.stop(id);
            (0, database_1.deleteStream)(id);
            (0, credentials_1.deleteStreamCredential)(id);
            return { ok: true };
        }
        catch (err) {
            return { ok: false, error: err.message };
        }
    });
    // --- History IPC ---
    electron_1.ipcMain.handle("history:get", async (_e, filter) => {
        try {
            return (0, database_1.getHistory)(filter);
        }
        catch {
            return [];
        }
    });
    electron_1.ipcMain.handle("history:insert", async (_e, run) => {
        try {
            return { ok: true, id: (0, database_1.insertRun)(run) };
        }
        catch {
            return { ok: false };
        }
    });
    electron_1.ipcMain.handle("history:update", async (_e, id, updates) => {
        try {
            (0, database_1.updateRun)(id, updates);
            return { ok: true };
        }
        catch {
            return { ok: false };
        }
    });
});
electron_1.app.on("before-quit", async () => {
    isQuitting = true;
    await manager.stopAll();
    (0, database_1.closeDatabase)();
});
electron_1.app.on("window-all-closed", () => {
    if (process.platform !== "darwin" && isQuitting)
        electron_1.app.quit();
});
