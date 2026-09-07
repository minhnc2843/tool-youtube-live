export type AspectRatio = "9:16" | "16:9";

export interface StreamConfig {
  id: string;
  name: string;
  videoPath: string;
  aspectRatio: AspectRatio;
  streamKey: string;
  loop: boolean;
  bitrate: number;
  fps: number;
  audioBitrate: number;
  autoReconnect: boolean;
  reconnectDelay: number;
  maxReconnectAttempts: number;
  hasAudio: boolean;
}

export const DEFAULT_RTMP_URL = "rtmp://a.rtmp.youtube.com/live2";

export function buildFfmpegArgs(c: StreamConfig): string[] {
  const [w, h] = c.aspectRatio === "9:16" ? [1080, 1920] : [1920, 1080];
  // Use ceil to ensure even dimensions for H.264 yuv420p
  const vf = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black,setsar=1`;

  const args: string[] = [];
  if (c.loop) args.push("-stream_loop", "-1");
  args.push("-re", "-i", c.videoPath);

  // If video has no audio, generate silent audio
  if (!c.hasAudio) {
    args.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000");
  }

  args.push(
    "-vf", vf,
    "-r", String(c.fps),
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-pix_fmt", "yuv420p",
    "-b:v", `${c.bitrate}k`,
    "-maxrate", `${c.bitrate}k`,
    "-bufsize", `${c.bitrate * 2}k`,
    "-g", String(c.fps * 2),
    "-keyint_min", String(c.fps * 2),
    "-sc_threshold", "0",
    "-c:a", "aac",
    "-b:a", `${c.audioBitrate || 128}k`,
    "-ar", "48000"
  );

  // Map streams explicitly
  if (!c.hasAudio) {
    args.push("-map", "0:v:0", "-map", "1:a:0", "-shortest");
  }

  args.push(
    "-f", "flv",
    `${DEFAULT_RTMP_URL}/${c.streamKey}`
  );
  return args;
}