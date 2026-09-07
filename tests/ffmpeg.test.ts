import { describe, it, expect } from "vitest";
import { buildFfmpegArgs, StreamConfig } from "../electron/ffmpeg/command";

describe("FFmpeg Command Builder", () => {
  it("should generate correct RTMP output URL and basic flags", () => {
    const config: StreamConfig = {
      id: "stream-1",
      name: "Test Stream",
      videoPath: "C:/videos/test.mp4",
      aspectRatio: "16:9",
      streamKey: "live_12345_abc",
      loop: true,
      bitrate: 4500,
      fps: 30,
      audioBitrate: 128,
      autoReconnect: true,
      reconnectDelay: 3000,
      maxReconnectAttempts: 5,
      hasAudio: true,
    };

    const args = buildFfmpegArgs(config);

    expect(args).toContain("rtmp://a.rtmp.youtube.com/live2/live_12345_abc");
    expect(args).toContain("-stream_loop");
    expect(args).toContain("-1");
    expect(args).toContain("-b:a");
    expect(args).toContain("128k");
    expect(args).toContain("-f");
    expect(args).toContain("flv");
  });

  it("should add correct aspect ratio scaling for 9:16 vertical video", () => {
    const config: StreamConfig = {
      id: "stream-2",
      name: "Vertical Shorts",
      videoPath: "C:/videos/vertical.mp4",
      aspectRatio: "9:16",
      streamKey: "live_67890_def",
      loop: false,
      bitrate: 4500,
      fps: 30,
      audioBitrate: 192,
      autoReconnect: true,
      reconnectDelay: 3000,
      maxReconnectAttempts: 5,
      hasAudio: false,
    };

    const args = buildFfmpegArgs(config);

    const vfIndex = args.indexOf("-vf");
    expect(vfIndex).toBeGreaterThan(-1);
    const vfValue = args[vfIndex + 1];
    expect(vfValue).toContain("1080:1920");
    expect(args).toContain("anullsrc=channel_layout=stereo:sample_rate=48000");
  });
});
