import { useEffect, useRef, useState } from "react";
import { Play, Square, Trash2, Eye, EyeOff, FileVideo, RotateCcw, Eraser } from "lucide-react";
import type { StreamConfig, StreamRuntime } from "../types";
import { formatBytes, formatDuration } from "../utils/format";
import { useToast } from "../hooks/useToast";

interface Props {
  config: StreamConfig;
  runtime?: StreamRuntime;
  logs: string[];
  onChange: (next: StreamConfig) => void;
  onDelete: () => void;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onConfirmDelete: () => void;
}

const statusLabel: Record<string, string> = {
  OFFLINE: "OFFLINE",
  STARTING: "ĐANG KHỞI ĐỘNG",
  LIVE: "LIVE",
  STOPPING: "ĐANG DỪNG",
  ERROR: "LỖI",
  COMPLETED: "ĐÃ XONG",
  RECONNECTING: "ĐANG KẾT NỐI LẠI"
};

export function StreamCard({ config, runtime, logs, onChange, onDelete, onStart, onStop, onRestart, onConfirmDelete }: Props) {
  const [showKey, setShowKey] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [showLogs, setShowLogs] = useState(false);
  const logRef = useRef<HTMLPreElement>(null);
  const { addToast } = useToast();

  const state = runtime?.state ?? "OFFLINE";
  const running = ["STARTING", "LIVE", "STOPPING", "RECONNECTING"].includes(state);

  useEffect(() => {
    if (!running) { setElapsed(0); return; }
    const t = setInterval(() => {
      if (runtime?.startTime) setElapsed(Math.max(0, (Date.now() - runtime.startTime) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [runtime?.startTime, running]);

  // Auto-scroll logs
  useEffect(() => {
    if (logRef.current && showLogs) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs, showLogs]);

  // Load credential on mount
  useEffect(() => {
    window.desktop.getCredential(config.id).then(result => {
      if (result.ok && result.key && !config.streamKey) {
        onChange({ ...config, streamKey: result.key });
      }
    });
  }, [config.id]); // eslint-disable-line

  const patch = (p: Partial<StreamConfig>) => {
    const next = { ...config, ...p };
    onChange(next);
  };

  const handleStreamKeyChange = (key: string) => {
    patch({ streamKey: key });
    // Save credential securely (debounced via the parent save)
    window.desktop.saveCredential(config.id, key);
  };

  const handleSelectVideo = async () => {
    const path = await window.desktop.selectVideo();
    if (!path) return;
    try {
      const info = await window.desktop.probeVideo(path);
      if ((info as any).error) {
        addToast("error", `Không đọc được video: ${(info as any).error}`);
        // Still set the path even if probe fails
        patch({ videoPath: path, videoInfo: undefined, hasAudio: true });
        return;
      }
      patch({ videoPath: path, videoInfo: info, hasAudio: info.hasAudio ?? true });
      addToast("success", `Đã chọn video: ${path.split(/[\\/]/).pop()}`);
    } catch (e) {
      addToast("error", `Không đọc được video: ${String(e)}`);
      patch({ videoPath: path, videoInfo: undefined, hasAudio: true });
    }
  };

  const handleClearLogs = () => {
    window.desktop.clearLogs(config.id);
    addToast("info", "Đã xóa log");
  };

  return (
    <section className="card" id={`stream-card-${config.id}`}>
      <div className="card-head">
        <div>
          <div className="eyebrow">STREAM</div>
          <input className="title-input" value={config.name} onChange={e => patch({ name: e.target.value })} disabled={running} />
        </div>
        <div className={`status ${state.toLowerCase()}`}>
          <span className="dot" />{statusLabel[state]}
        </div>
      </div>

      {/* Video Preview */}
      <div className="preview">
        {config.videoPath ? (
          <div className={`video-preview-container aspect-${config.aspectRatio.replace(':', '-')}`}>
            <video
              key={config.videoPath}
              src={`media://${encodeURIComponent(config.videoPath)}`}
              muted
              preload="metadata"
              className="video-preview"
              onLoadedMetadata={e => { (e.target as HTMLVideoElement).currentTime = 1; }}
            />
          </div>
        ) : (
          <div className="preview-icon"><FileVideo size={30} /></div>
        )}
        <div className="preview-meta">
          <strong>{config.videoPath ? config.videoPath.split(/[\\/]/).pop() : "Chưa chọn video"}</strong>
          {config.videoInfo && (
            <span>
              {config.videoInfo.width}×{config.videoInfo.height} · {config.videoInfo.fps} FPS · {config.videoInfo.codec} · {formatDuration(config.videoInfo.duration)} · {formatBytes(config.videoInfo.size)}
              {!config.videoInfo.hasAudio && " · Không có audio"}
            </span>
          )}
        </div>
        <button className="btn secondary" disabled={running} onClick={handleSelectVideo}>CHỌN VIDEO</button>
      </div>

      <label className="field-label">Kích thước phát</label>
      <div className="segmented">
        {(["16:9", "9:16"] as const).map(v => (
          <button key={v} disabled={running} className={config.aspectRatio === v ? "active" : ""} onClick={() => patch({ aspectRatio: v })}>
            {v}<small>{v === "16:9" ? "1920×1080" : "1080×1920"}</small>
          </button>
        ))}
      </div>

      <label className="field-label">Mã sự kiện / Stream Key</label>
      <div className="key-wrap">
        <input
          disabled={running}
          type={showKey ? "text" : "password"}
          value={config.streamKey}
          onChange={e => handleStreamKeyChange(e.target.value.trim())}
          placeholder="Dán Stream Key YouTube..."
          autoComplete="off"
        />
        <button className="icon-btn" onClick={() => setShowKey(!showKey)}>
          {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      <div className="rtmp"><span>RTMP SERVER</span><code>rtmp://a.rtmp.youtube.com/live2</code></div>

      <div className="options">
        <label><input type="checkbox" disabled={running} checked={config.loop} onChange={e => patch({ loop: e.target.checked })} /> Lặp video vô hạn</label>
        <label><input type="checkbox" disabled={running} checked={config.autoReconnect} onChange={e => patch({ autoReconnect: e.target.checked })} /> Tự kết nối lại</label>
      </div>

      <div className="advanced-row">
        <label>Bitrate <input type="number" disabled={running} value={config.bitrate} onChange={e => patch({ bitrate: Number(e.target.value) })} min={100} max={50000} /> kbps</label>
        <label>FPS <input type="number" disabled={running} value={config.fps} onChange={e => patch({ fps: Number(e.target.value) })} min={1} max={120} /></label>
      </div>

      <div className="metrics">
        <span>⏱ {formatDuration(elapsed)}</span>
        <span>↻ {runtime?.restartCount ?? 0} reconnect</span>
        <span>H.264 / AAC · {config.bitrate} kbps</span>
      </div>

      <div className="actions">
        {!running ? (
          <button className="btn start" onClick={onStart} id={`start-${config.id}`}>
            <Play size={17} fill="currentColor" /> BẮT ĐẦU PHÁT
          </button>
        ) : (
          <button className="btn stop" onClick={onStop} id={`stop-${config.id}`}>
            <Square size={17} fill="currentColor" /> DỪNG
          </button>
        )}
        <button className="btn secondary" onClick={onRestart} disabled={!running && state !== "ERROR" && state !== "COMPLETED"} id={`restart-${config.id}`}>
          <RotateCcw size={16} /> RESTART
        </button>
        <button className="icon-btn danger" disabled={running} onClick={onConfirmDelete} id={`delete-${config.id}`}>
          <Trash2 size={18} />
        </button>
      </div>

      <div className="logs">
        <div className="logs-header" onClick={() => setShowLogs(!showLogs)}>
          <span className="logs-title">FFmpeg LOG</span>
          <span className="logs-count">{logs.length} dòng</span>
          {logs.length > 0 && (
            <button className="icon-btn" onClick={e => { e.stopPropagation(); handleClearLogs(); }} title="Xóa log">
              <Eraser size={14} />
            </button>
          )}
        </div>
        {showLogs && (
          <pre ref={logRef}>{logs.length ? logs.join("\n") : "Ready to start..."}</pre>
        )}
      </div>
    </section>
  );
}