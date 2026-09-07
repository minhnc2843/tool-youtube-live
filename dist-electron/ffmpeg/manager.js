"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FFmpegManager = void 0;
const node_child_process_1 = require("node:child_process");
const node_fs_1 = __importDefault(require("node:fs"));
const paths_1 = require("./paths");
const command_1 = require("./command");
class FFmpegManager {
    getWindow;
    runtimes = new Map();
    ffmpegPath;
    ffprobePathVal;
    logThrottles = new Map();
    startDelayMs = 2000;
    constructor(getWindow, customFfmpegPath) {
        this.getWindow = getWindow;
        this.ffmpegPath = (0, paths_1.findBinary)("ffmpeg.exe", customFfmpegPath);
        this.ffprobePathVal = (0, paths_1.findBinary)("ffprobe.exe", customFfmpegPath);
    }
    ffprobePath() { return this.ffprobePathVal; }
    setStartDelay(ms) { this.startDelayMs = ms; }
    async checkFfmpeg() {
        return new Promise((resolve) => {
            try {
                const p = (0, node_child_process_1.spawn)(this.ffmpegPath, ["-version"], { windowsHide: true });
                let out = "";
                p.stdout.on("data", d => out += d.toString());
                p.on("error", () => resolve({ ok: false, path: this.ffmpegPath, ffprobePath: this.ffprobePathVal }));
                p.on("close", code => {
                    const version = out.split("\n")[0]?.trim() || undefined;
                    resolve({ ok: code === 0, path: this.ffmpegPath, version, ffprobePath: this.ffprobePathVal });
                });
            }
            catch {
                resolve({ ok: false, path: this.ffmpegPath, ffprobePath: this.ffprobePathVal });
            }
        });
    }
    async start(config) {
        if (this.runtimes.has(config.id)) {
            const existing = this.runtimes.get(config.id);
            if (existing.state !== "OFFLINE" && existing.state !== "ERROR" && existing.state !== "COMPLETED") {
                return { ok: false, error: "Stream đang chạy." };
            }
        }
        if (!config.videoPath)
            return { ok: false, error: "Vui lòng chọn video." };
        if (!node_fs_1.default.existsSync(config.videoPath))
            return { ok: false, error: "Không tìm thấy file video." };
        if (!config.streamKey?.trim())
            return { ok: false, error: "Vui lòng nhập Stream Key YouTube." };
        if (!config.bitrate || config.bitrate < 100)
            return { ok: false, error: "Bitrate không hợp lệ." };
        if (!config.fps || config.fps < 1 || config.fps > 120)
            return { ok: false, error: "FPS không hợp lệ (1-120)." };
        const runtime = {
            config,
            process: null,
            state: "STARTING",
            startTime: Date.now(),
            restartCount: 0,
            logs: [],
            reconnectTimer: null,
            closePromise: null,
            closeResolve: null
        };
        this.runtimes.set(config.id, runtime);
        this.launchProcess(runtime);
        return { ok: true };
    }
    launchProcess(runtime) {
        const { config } = runtime;
        if (!config.videoPath || !node_fs_1.default.existsSync(config.videoPath)) {
            runtime.state = "ERROR";
            this.addLog(runtime, `[StreamManager] File video không tồn tại hoặc đã bị xóa: ${config.videoPath}`);
            this.emitStatus(runtime);
            return;
        }
        try {
            const args = (0, command_1.buildFfmpegArgs)(config);
            this.addLog(runtime, `[StreamManager] Starting FFmpeg for ${config.name}`);
            this.addLog(runtime, `[FFmpeg] Command: ffmpeg ${args.map(a => a.includes(config.streamKey) ? '[STREAM_KEY]' : a).join(' ')}`);
            const p = (0, node_child_process_1.spawn)(this.ffmpegPath, args, { windowsHide: true });
            runtime.process = p;
            runtime.state = "STARTING";
            this.emitStatus(runtime);
            // Create close promise for awaitable stop
            runtime.closePromise = new Promise(resolve => {
                runtime.closeResolve = resolve;
            });
            this.addLog(runtime, `[FFmpeg] Spawned PID ${p.pid}`);
            p.stderr.on("data", data => {
                const text = data.toString();
                const redacted = this.redact(text, config.streamKey);
                this.addLog(runtime, redacted);
                // Only confirm LIVE when actual frames are being encoded
                if (/frame=\s*\d+/.test(text) && runtime.state === "STARTING") {
                    runtime.state = "LIVE";
                    this.addLog(runtime, `[StreamManager] Stream ${config.name} is LIVE`);
                    this.emitStatus(runtime);
                }
            });
            p.stdout.on("data", data => {
                this.addLog(runtime, this.redact(data.toString(), config.streamKey));
            });
            p.on("error", err => {
                this.addLog(runtime, `[FFmpeg] ERROR: ${err.message}`);
                if (runtime.state !== "STOPPING") {
                    runtime.state = "ERROR";
                    this.emitStatus(runtime);
                }
            });
            p.on("close", (code, signal) => {
                this.addLog(runtime, `[FFmpeg] Process exited with code=${code} signal=${signal}`);
                runtime.process = null;
                // Resolve close promise
                if (runtime.closeResolve) {
                    runtime.closeResolve();
                    runtime.closeResolve = null;
                }
                if (runtime.state === "STOPPING") {
                    runtime.state = "OFFLINE";
                    this.emitStatus(runtime);
                    return;
                }
                // Auto-reconnect: depends only on autoReconnect, NOT on loop
                if (config.autoReconnect && runtime.restartCount < config.maxReconnectAttempts) {
                    runtime.restartCount++;
                    runtime.state = "RECONNECTING";
                    this.addLog(runtime, `[StreamManager] Reconnecting in ${config.reconnectDelay}s... (attempt ${runtime.restartCount}/${config.maxReconnectAttempts})`);
                    this.emitStatus(runtime);
                    runtime.reconnectTimer = setTimeout(() => {
                        runtime.reconnectTimer = null;
                        if (runtime.state === "RECONNECTING") {
                            this.launchProcess(runtime);
                        }
                    }, config.reconnectDelay * 1000);
                }
                else {
                    runtime.state = code === 0 ? "COMPLETED" : "ERROR";
                    this.addLog(runtime, `[StreamManager] Stream ${config.name} ended with state: ${runtime.state}`);
                    this.emitStatus(runtime);
                }
            });
        }
        catch (err) {
            runtime.state = "ERROR";
            this.addLog(runtime, `[FFmpeg] Failed to spawn: ${err.message}`);
            this.emitStatus(runtime);
        }
    }
    async stop(id) {
        const r = this.runtimes.get(id);
        if (!r)
            return { ok: true };
        // Cancel any pending reconnect timer
        if (r.reconnectTimer) {
            clearTimeout(r.reconnectTimer);
            r.reconnectTimer = null;
        }
        r.state = "STOPPING";
        this.emitStatus(r);
        if (r.process) {
            const pid = r.process.pid;
            try {
                // On Windows, use taskkill for reliable process tree termination
                if (process.platform === "win32" && pid) {
                    try {
                        (0, node_child_process_1.execSync)(`taskkill /pid ${pid} /t /f`, { windowsHide: true, timeout: 5000 });
                    }
                    catch {
                        // taskkill might fail if process already exited
                        try {
                            r.process.kill("SIGKILL");
                        }
                        catch { /* ignore */ }
                    }
                }
                else {
                    r.process.kill("SIGTERM");
                }
            }
            catch {
                // Process may already be dead
            }
            // Wait for process to actually close (with timeout)
            if (r.closePromise) {
                await Promise.race([
                    r.closePromise,
                    new Promise(resolve => setTimeout(resolve, 5000))
                ]);
            }
        }
        else {
            // No process (e.g. was in RECONNECTING with timer), just mark offline
            r.state = "OFFLINE";
            this.emitStatus(r);
        }
        return { ok: true };
    }
    async restart(config) {
        await this.stop(config.id);
        // Small delay to ensure cleanup
        await new Promise(r => setTimeout(r, 500));
        return this.start(config);
    }
    async startAll(configs) {
        for (const config of configs) {
            const existing = this.runtimes.get(config.id);
            const isActive = existing && ["STARTING", "LIVE", "RECONNECTING", "STOPPING"].includes(existing.state);
            if (!isActive) {
                const result = await this.start(config);
                if (!result.ok) {
                    this.addLogById(config.id, `[StreamManager] Failed to start ${config.name}: ${result.error}`);
                }
                // Configurable delay between starts
                await new Promise(r => setTimeout(r, this.startDelayMs));
            }
        }
        return { ok: true };
    }
    async stopAll() {
        const ids = [...this.runtimes.keys()];
        await Promise.all(ids.map(id => this.stop(id)));
        return { ok: true };
    }
    activeCount() {
        let count = 0;
        for (const r of this.runtimes.values()) {
            if (["STARTING", "LIVE", "RECONNECTING", "STOPPING"].includes(r.state))
                count++;
        }
        return count;
    }
    statuses() {
        return [...this.runtimes.values()].map(r => ({
            id: r.config.id,
            state: r.state,
            startTime: r.startTime,
            restartCount: r.restartCount
        }));
    }
    logs(id) {
        return this.runtimes.get(id)?.logs ?? [];
    }
    clearLogs(id) {
        const r = this.runtimes.get(id);
        if (r)
            r.logs = [];
    }
    redact(text, streamKey) {
        let result = text.replace(/rtmp:\/\/[^\s]+\/live2\/\S+/g, "rtmp://a.rtmp.youtube.com/live2/[REDACTED]");
        if (streamKey) {
            result = result.replace(new RegExp(streamKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[REDACTED]');
        }
        return result;
    }
    addLog(r, text) {
        const now = Date.now();
        const throttleKey = r.config.id;
        const lastEmit = this.logThrottles.get(throttleKey) || 0;
        for (const line of text.split(/\r?\n/).filter(Boolean)) {
            r.logs.push(`[${new Date().toLocaleTimeString()}] ${line}`);
        }
        // Cap log buffer at 500 lines
        if (r.logs.length > 500)
            r.logs.splice(0, r.logs.length - 500);
        // Throttle IPC emissions to max every 500ms per stream
        if (now - lastEmit >= 500) {
            this.logThrottles.set(throttleKey, now);
            this.getWindow()?.webContents.send("stream:log", { id: r.config.id, logs: r.logs.slice(-100) });
        }
    }
    addLogById(id, text) {
        const r = this.runtimes.get(id);
        if (r)
            this.addLog(r, text);
    }
    emitStatus(r) {
        this.getWindow()?.webContents.send("stream:status", {
            id: r.config.id,
            state: r.state,
            startTime: r.startTime,
            restartCount: r.restartCount
        });
    }
}
exports.FFmpegManager = FFmpegManager;
