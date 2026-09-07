"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.probeVideo = probeVideo;
const node_child_process_1 = require("node:child_process");
function parseFps(rate) {
    if (!rate)
        return 0;
    const parts = rate.split("/");
    if (parts.length === 2) {
        const num = Number(parts[0]);
        const den = Number(parts[1]);
        return den > 0 ? Math.round((num / den) * 100) / 100 : 0;
    }
    return Number(rate) || 0;
}
function probeVideo(filePath, ffprobePath) {
    return new Promise((resolve, reject) => {
        const p = (0, node_child_process_1.spawn)(ffprobePath, [
            "-v", "error",
            "-show_entries", "format=duration,size,bit_rate:stream=index,codec_type,codec_name,width,height,r_frame_rate",
            "-of", "json",
            filePath
        ], { windowsHide: true });
        let out = "", err = "";
        p.stdout.on("data", d => out += d.toString());
        p.stderr.on("data", d => err += d.toString());
        p.on("error", e => reject(new Error(`FFprobe không khởi động được: ${e.message}`)));
        p.on("close", code => {
            if (code !== 0)
                return reject(new Error(err || `ffprobe exited with code ${code}`));
            try {
                // Strip any non-JSON prefix
                const jsonStart = out.indexOf("{");
                const jsonStr = jsonStart >= 0 ? out.substring(jsonStart) : out;
                const data = JSON.parse(jsonStr);
                const streams = data.streams ?? [];
                const video = streams.find((s) => s.codec_type === "video");
                const hasAudio = streams.some((s) => s.codec_type === "audio");
                resolve({
                    duration: Number(data.format?.duration ?? 0),
                    size: Number(data.format?.size ?? 0),
                    bitrate: Number(data.format?.bit_rate ?? 0),
                    width: video?.width ?? 0,
                    height: video?.height ?? 0,
                    fps: parseFps(video?.r_frame_rate ?? "0/1"),
                    codec: video?.codec_name ?? "unknown",
                    hasAudio
                });
            }
            catch (e) {
                reject(new Error(`Không parse được video metadata: ${e.message}`));
            }
        });
    });
}
