"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findBinary = findBinary;
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const electron_1 = require("electron");
function findBinary(name, customPath) {
    if (customPath) {
        const custom = customPath.endsWith(name) ? customPath : node_path_1.default.join(customPath, name);
        if (node_fs_1.default.existsSync(custom))
            return custom;
    }
    const candidates = [
        node_path_1.default.join(process.resourcesPath, "ffmpeg", name),
        node_path_1.default.join(electron_1.app.getAppPath(), "resources", "ffmpeg", name),
        name // fallback to PATH
    ];
    return candidates.find(p => {
        try {
            return node_fs_1.default.existsSync(p);
        }
        catch {
            return false;
        }
    }) ?? name;
}
