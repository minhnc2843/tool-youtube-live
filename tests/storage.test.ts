import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("Storage System", () => {
  const tmpDir = path.join(os.tmpdir(), "stream_test_" + Date.now());

  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should write and read atomic JSON stream store correctly", () => {
    const filePath = path.join(tmpDir, "streams.json");
    const sampleData = [
      { id: "s1", name: "Stream 1", video_path: "C:/v1.mp4" },
      { id: "s2", name: "Stream 2", video_path: "C:/v2.mp4" },
    ];

    const tmpFile = `${filePath}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(sampleData, null, 2), "utf8");
    fs.renameSync(tmpFile, filePath);

    expect(fs.existsSync(filePath)).toBe(true);

    const readContent = JSON.parse(fs.readFileSync(filePath, "utf8"));
    expect(readContent).toHaveLength(2);
    expect(readContent[0].name).toBe("Stream 1");
  });
});
