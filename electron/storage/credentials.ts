import { safeStorage } from "electron";
import path from "node:path";
import fs from "node:fs";
import { app } from "electron";

const CRED_FILE = "stream-credentials.json";

function getCredPath(): string {
  return path.join(app.getPath("userData"), CRED_FILE);
}

function readStore(): Record<string, string> {
  try {
    const data = fs.readFileSync(getCredPath(), "utf8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, string>): void {
  const dir = path.dirname(getCredPath());
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getCredPath(), JSON.stringify(store, null, 2), "utf8");
}

export function saveStreamCredential(streamId: string, key: string): void {
  const store = readStore();
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(key);
    store[streamId] = encrypted.toString("base64");
  } else {
    // Fallback: base64 encode (not truly secure, but better than plaintext)
    store[streamId] = Buffer.from(key).toString("base64");
  }
  writeStore(store);
}

export function getStreamCredential(streamId: string): string {
  const store = readStore();
  const value = store[streamId];
  if (!value) return "";
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(value, "base64"));
    } else {
      return Buffer.from(value, "base64").toString("utf8");
    }
  } catch {
    return "";
  }
}

export function deleteStreamCredential(streamId: string): void {
  const store = readStore();
  delete store[streamId];
  writeStore(store);
}
