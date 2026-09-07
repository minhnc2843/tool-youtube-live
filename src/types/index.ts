export type AspectRatio = "9:16" | "16:9";
export type StreamStatus = "OFFLINE" | "STARTING" | "LIVE" | "STOPPING" | "ERROR" | "COMPLETED" | "RECONNECTING";

export interface VideoInfo {
  duration: number;
  size: number;
  bitrate: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  hasAudio: boolean;
  error?: string;
}

export interface StreamConfig {
  id: string;
  name: string;
  videoPath: string;
  videoInfo?: VideoInfo;
  aspectRatio: AspectRatio;
  streamKey: string;
  loop: boolean;
  bitrate: number;
  fps: number;
  audioBitrate: number;
  hasAudio: boolean;
  autoReconnect: boolean;
  reconnectDelay: number;
  maxReconnectAttempts: number;
}

export interface StreamRuntime {
  id: string;
  state: StreamStatus;
  startTime?: number;
  restartCount: number;
}

export interface AppSettings {
  defaultAspectRatio: AspectRatio;
  defaultFps: number;
  defaultBitrate: number;
  audioBitrate: number;
  loop: boolean;
  autoReconnect: boolean;
  reconnectDelay: number;
  startDelay: number;
  maxReconnectAttempts: number;
  ffmpegPath?: string;
}

export interface SystemStats {
  cpu: number;
  ramTotal: number;
  ramFree: number;
  ramUsed: number;
  platform: string;
  arch: string;
}

export interface HistoryRecord {
  id: number;
  stream_id: string;
  stream_name: string;
  video_path: string;
  resolution: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  status: string;
  error_message: string | null;
  reconnect_count: number;
}

export interface StreamDbRecord {
  id: string;
  name: string;
  video_path: string;
  aspect_ratio: string;
  loop_video: number;
  bitrate: number;
  fps: number;
  audio_bitrate: number;
  auto_reconnect: number;
  reconnect_delay: number;
  max_reconnect_attempts: number;
  sort_order: number;
}

declare global {
  interface Window {
    desktop: {
      selectVideo(): Promise<string | null>;
      probeVideo(path: string): Promise<VideoInfo>;
      ffmpegStatus(): Promise<{ok: boolean; path: string; version?: string; ffprobePath?: string}>;
      startStream(config: StreamConfig): Promise<{ok: boolean; error?: string}>;
      stopStream(id: string): Promise<{ok: boolean; error?: string}>;
      restartStream(config: StreamConfig): Promise<{ok: boolean; error?: string}>;
      startAll(configs: StreamConfig[]): Promise<{ok: boolean}>;
      stopAll(): Promise<{ok: boolean}>;
      getStatuses(): Promise<StreamRuntime[]>;
      getLogs(id: string): Promise<string[]>;
      clearLogs(id: string): Promise<void>;
      getSettings(): Promise<AppSettings>;
      setSettings(settings: Partial<AppSettings>): Promise<AppSettings>;
      getSystemStats(): Promise<SystemStats>;
      saveCredential(streamId: string, key: string): Promise<{ok: boolean}>;
      getCredential(streamId: string): Promise<{ok: boolean; key: string}>;
      deleteCredential(streamId: string): Promise<{ok: boolean}>;
      loadStreams(): Promise<StreamDbRecord[]>;
      saveStreamData(stream: Partial<StreamDbRecord> & {id: string}): Promise<{ok: boolean}>;
      deleteStreamData(id: string): Promise<{ok: boolean}>;
      getHistory(filter?: string): Promise<HistoryRecord[]>;
      insertHistoryRun(run: unknown): Promise<{ok: boolean; id?: number}>;
      updateHistoryRun(id: number, updates: unknown): Promise<{ok: boolean}>;
      onStatus(cb: (x: StreamRuntime) => void): () => void;
      onLog(cb: (x: {id: string; logs: string[]}) => void): () => void;
    };
  }
}