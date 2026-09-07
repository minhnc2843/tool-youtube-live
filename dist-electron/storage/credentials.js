"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveStreamCredential = saveStreamCredential;
exports.getStreamCredential = getStreamCredential;
exports.deleteStreamCredential = deleteStreamCredential;
const electron_1 = require("electron");
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const electron_2 = require("electron");
const CRED_FILE = "stream-credentials.json";
function getCredPath() {
    return node_path_1.default.join(electron_2.app.getPath("userData"), CRED_FILE);
}
function readStore() {
    try {
        const data = node_fs_1.default.readFileSync(getCredPath(), "utf8");
        return JSON.parse(data);
    }
    catch {
        return {};
    }
}
function writeStore(store) {
    const dir = node_path_1.default.dirname(getCredPath());
    node_fs_1.default.mkdirSync(dir, { recursive: true });
    node_fs_1.default.writeFileSync(getCredPath(), JSON.stringify(store, null, 2), "utf8");
}
function saveStreamCredential(streamId, key) {
    const store = readStore();
    if (electron_1.safeStorage.isEncryptionAvailable()) {
        const encrypted = electron_1.safeStorage.encryptString(key);
        store[streamId] = encrypted.toString("base64");
    }
    else {
        // Fallback: base64 encode (not truly secure, but better than plaintext)
        store[streamId] = Buffer.from(key).toString("base64");
    }
    writeStore(store);
}
function getStreamCredential(streamId) {
    const store = readStore();
    const value = store[streamId];
    if (!value)
        return "";
    try {
        if (electron_1.safeStorage.isEncryptionAvailable()) {
            return electron_1.safeStorage.decryptString(Buffer.from(value, "base64"));
        }
        else {
            return Buffer.from(value, "base64").toString("utf8");
        }
    }
    catch {
        return "";
    }
}
function deleteStreamCredential(streamId) {
    const store = readStore();
    delete store[streamId];
    writeStore(store);
}
