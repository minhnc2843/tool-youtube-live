"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsStore = void 0;
const electron_1 = require("electron");
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
class SettingsStore {
    file;
    defaults = {
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
        this.file = node_path_1.default.join(electron_1.app.getPath("userData"), "settings.json");
    }
    get() {
        try {
            return { ...this.defaults, ...JSON.parse(node_fs_1.default.readFileSync(this.file, "utf8")) };
        }
        catch {
            return this.defaults;
        }
    }
    set(value) {
        const next = { ...this.get(), ...value };
        node_fs_1.default.mkdirSync(node_path_1.default.dirname(this.file), { recursive: true });
        node_fs_1.default.writeFileSync(this.file, JSON.stringify(next, null, 2), "utf8");
        return next;
    }
}
exports.SettingsStore = SettingsStore;
