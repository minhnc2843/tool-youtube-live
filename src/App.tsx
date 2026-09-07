import { useEffect, useCallback, useMemo, useState, useRef } from "react";
import { Activity, CircleStop, Gauge, Radio, Settings, Plus, Play, Clock, Cpu, MemoryStick } from "lucide-react";
import { StreamCard } from "./components/StreamCard";
import { Dashboard } from "./components/Dashboard";
import { HistoryPage } from "./components/HistoryPage";
import { SettingsPage } from "./components/SettingsPage";
import { ToastContainer } from "./components/Toast";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { ToastProvider, useToast } from "./hooks/useToast";
import type { StreamConfig, StreamRuntime, AppSettings, SystemStats, StreamDbRecord } from "./types";
import "./styles.css";

function dbToConfig(db: StreamDbRecord, streamKey: string): StreamConfig {
  return {
    id: db.id,
    name: db.name,
    videoPath: db.video_path,
    aspectRatio: (db.aspect_ratio === "9:16" ? "9:16" : "16:9"),
    streamKey,
    loop: !!db.loop_video,
    bitrate: db.bitrate,
    fps: db.fps,
    audioBitrate: db.audio_bitrate || 128,
    hasAudio: true,
    autoReconnect: !!db.auto_reconnect,
    reconnectDelay: db.reconnect_delay,
    maxReconnectAttempts: db.max_reconnect_attempts
  };
}

function configToDb(c: StreamConfig): Partial<StreamDbRecord> & { id: string } {
  return {
    id: c.id,
    name: c.name,
    video_path: c.videoPath,
    aspect_ratio: c.aspectRatio,
    loop_video: c.loop ? 1 : 0,
    bitrate: c.bitrate,
    fps: c.fps,
    audio_bitrate: c.audioBitrate || 128,
    auto_reconnect: c.autoReconnect ? 1 : 0,
    reconnect_delay: c.reconnectDelay,
    max_reconnect_attempts: c.maxReconnectAttempts
  };
}

const defaultConfig = (n: number, settings?: AppSettings): StreamConfig => ({
  id: crypto.randomUUID(),
  name: `YouTube Stream ${String(n).padStart(2, "0")}`,
  videoPath: "",
  aspectRatio: settings?.defaultAspectRatio ?? "16:9",
  streamKey: "",
  loop: settings?.loop ?? true,
  bitrate: settings?.defaultBitrate ?? 5000,
  fps: settings?.defaultFps ?? 30,
  audioBitrate: settings?.audioBitrate ?? 128,
  hasAudio: true,
  autoReconnect: settings?.autoReconnect ?? true,
  reconnectDelay: settings?.reconnectDelay ?? 5,
  maxReconnectAttempts: settings?.maxReconnectAttempts ?? 10
});

function AppInner() {
  const [streams, setStreams] = useState<StreamConfig[]>([]);
  const [runtime, setRuntime] = useState<Record<string, StreamRuntime>>({});
  const [logs, setLogs] = useState<Record<string, string[]>>({});
  const [ffmpeg, setFfmpeg] = useState<{ok: boolean; path: string; version?: string; ffprobePath?: string}>({ok: false, path: ""});
  const [stats, setStats] = useState<SystemStats>({cpu: 0, ramUsed: 0, ramTotal: 1, ramFree: 1, platform: "", arch: ""});
  const [tab, setTab] = useState("dashboard");
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [loaded, setLoaded] = useState(false);
  const { addToast } = useToast();

  // Confirm dialog state
  const [confirm, setConfirm] = useState<{open: boolean; title: string; message: string; danger?: boolean; onConfirm: () => void}>({open: false, title: "", message: "", onConfirm: () => {}});

  const saveTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Load initial data
  useEffect(() => {
    const init = async () => {
      const [ffmpegResult, statusList, settingsResult] = await Promise.all([
        window.desktop.ffmpegStatus(),
        window.desktop.getStatuses(),
        window.desktop.getSettings()
      ]);
      setFfmpeg(ffmpegResult);
      setRuntime(Object.fromEntries(statusList.map(x => [x.id, x])));
      setAppSettings(settingsResult);

      // Load persisted streams
      try {
        const dbStreams = await window.desktop.loadStreams();
        if (dbStreams.length > 0) {
          const configs: StreamConfig[] = [];
          for (const db of dbStreams) {
            const credResult = await window.desktop.getCredential(db.id);
            configs.push(dbToConfig(db, credResult.ok ? credResult.key : ""));
          }
          setStreams(configs);
        } else {
          setStreams([defaultConfig(1, settingsResult)]);
        }
      } catch {
        setStreams([defaultConfig(1, settingsResult)]);
      }
      setLoaded(true);
    };
    init();

    const offStatus = window.desktop.onStatus((x: any) => setRuntime(prev => ({ ...prev, [x.id]: x })));
    const offLog = window.desktop.onLog((x: any) => setLogs(prev => ({ ...prev, [x.id]: x.logs })));
    const timer = setInterval(() => window.desktop.getSystemStats().then(setStats), 2000);
    return () => { offStatus(); offLog(); clearInterval(timer); };
  }, []); // eslint-disable-line

  // Save stream to DB (debounced)
  const persistStream = useCallback((config: StreamConfig) => {
    if (saveTimeouts.current[config.id]) clearTimeout(saveTimeouts.current[config.id]);
    saveTimeouts.current[config.id] = setTimeout(() => {
      window.desktop.saveStreamData(configToDb(config));
    }, 500);
  }, []);

  const update = useCallback((id: string, next: StreamConfig) => {
    setStreams(s => s.map(x => x.id === id ? next : x));
    persistStream(next);
  }, [persistStream]);

  const add = useCallback(() => {
    const config = defaultConfig(streams.length + 1, appSettings ?? undefined);
    setStreams(s => [...s, config]);
    window.desktop.saveStreamData(configToDb(config));
    addToast("success", `Đã thêm ${config.name}`);
  }, [streams.length, appSettings, addToast]);

  const remove = useCallback((id: string) => {
    const stream = streams.find(s => s.id === id);
    setStreams(s => s.filter(x => x.id !== id));
    window.desktop.deleteStreamData(id);
    addToast("info", `Đã xóa ${stream?.name || 'luồng'}`);
  }, [streams, addToast]);

  const confirmDelete = useCallback((id: string) => {
    const stream = streams.find(s => s.id === id);
    setConfirm({
      open: true,
      title: "Xóa luồng",
      message: `Bạn có chắc muốn xóa "${stream?.name}"? Thao tác này không thể hoàn tác.`,
      danger: true,
      onConfirm: () => { remove(id); setConfirm(c => ({ ...c, open: false })); }
    });
  }, [streams, remove]);

  const start = useCallback(async (s: StreamConfig) => {
    if (!s.videoPath) { addToast("warning", "Vui lòng chọn video."); return; }
    if (!s.streamKey) { addToast("warning", "Vui lòng nhập Stream Key."); return; }
    const result = await window.desktop.startStream(s);
    if (result.ok) {
      addToast("success", `${s.name} đã bắt đầu`);
    } else {
      addToast("error", result.error ?? "Không thể bắt đầu stream.");
    }
  }, [addToast]);

  const stop = useCallback(async (id: string) => {
    const stream = streams.find(s => s.id === id);
    await window.desktop.stopStream(id);
    addToast("info", `${stream?.name || 'Stream'} đã dừng`);
  }, [streams, addToast]);

  const restart = useCallback(async (s: StreamConfig) => {
    addToast("info", `Đang restart ${s.name}...`);
    await window.desktop.restartStream(s);
  }, [addToast]);

  const startAll = useCallback(async () => {
    const valid = streams.filter(s => s.videoPath && s.streamKey);
    if (!valid.length) { addToast("warning", "Chưa có stream hợp lệ để bắt đầu."); return; }
    addToast("info", `Đang bắt đầu ${valid.length} luồng...`);
    await window.desktop.startAll(valid);
    addToast("success", "Đã gửi lệnh bắt đầu tất cả.");
  }, [streams, addToast]);

  const confirmStopAll = useCallback(() => {
    const activeCount = Object.values(runtime).filter(x => ["STARTING", "LIVE", "RECONNECTING"].includes(x.state)).length;
    if (activeCount === 0) {
      addToast("info", "Không có luồng nào đang chạy.");
      return;
    }
    setConfirm({
      open: true,
      title: "Dừng tất cả",
      message: `Bạn có chắc muốn dừng ${activeCount} luồng đang hoạt động?`,
      danger: true,
      onConfirm: async () => {
        setConfirm(c => ({ ...c, open: false }));
        await window.desktop.stopAll();
        addToast("info", "Đã dừng tất cả luồng.");
      }
    });
  }, [runtime, addToast]);

  const active = useMemo(() => Object.values(runtime).filter(x => ["STARTING", "LIVE", "RECONNECTING", "STOPPING"].includes(x.state)).length, [runtime]);
  const live = useMemo(() => Object.values(runtime).filter(x => x.state === "LIVE").length, [runtime]);
  const errors = useMemo(() => Object.values(runtime).filter(x => x.state === "ERROR").length, [runtime]);
  const ram = useMemo(() => stats.ramTotal > 0 ? Math.round((stats.ramUsed / stats.ramTotal) * 100) : 0, [stats]);

  if (!loaded) return <div className="app"><div className="loading">Đang tải...</div></div>;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon"><Radio size={22} /></div>
          <div><b>PHÁT TRỰC TIẾP</b><span>ĐA LUỒNG</span></div>
        </div>
        <nav>
          {([
            ["dashboard", "Dashboard", Gauge],
            ["streams", "Streams", Activity],
            ["history", "Lịch sử", Clock],
            ["settings", "Cài đặt", Settings]
          ] as const).map(([id, label, Icon]) => (
            <button className={tab === id ? "nav active" : "nav"} key={id} onClick={() => setTab(id)}>
              <Icon size={18} />{label}
              {id === "streams" && active > 0 && <span className="nav-badge">{active}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="engine">
            <span className={ffmpeg.ok ? "online-dot" : "offline-dot"} />
            <div><b>FFmpeg Engine</b><small>{ffmpeg.ok ? "READY" : "NOT FOUND"}</small></div>
          </div>
          <small className="version">YouTube Multi-Stream Manager · v0.1.0</small>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <div className="eyebrow">BROADCAST CONTROL CENTER</div>
            <h1>Phát trực tiếp đa luồng</h1>
          </div>
          <div className="top-actions">
            <button className="btn secondary" onClick={confirmStopAll}><CircleStop size={17} /> DỪNG TẤT CẢ</button>
            <button className="btn start" onClick={startAll}><Play size={17} fill="currentColor" /> BẮT ĐẦU TẤT CẢ</button>
          </div>
        </header>

        {/* Stats bar - always visible */}
        <div className="stats-grid">
          <div className="stat"><span>ACTIVE STREAMS</span><strong>{active}</strong><small>đang xử lý</small></div>
          <div className="stat live-stat"><span>LIVE</span><strong>{live}</strong><small>đang phát YouTube</small></div>
          <div className="stat"><span>ERROR</span><strong className={errors > 0 ? 'error-value' : ''}>{errors}</strong><small>cần kiểm tra</small></div>
          <div className="stat"><span>CPU</span><strong className={stats.cpu > 85 ? 'warn-value' : ''}>{stats.cpu}%</strong><small><Cpu size={13} /> system</small></div>
          <div className="stat"><span>RAM</span><strong>{ram}%</strong><small><MemoryStick size={13} /> used</small></div>
        </div>

        {/* Tab content */}
        {tab === "dashboard" && <Dashboard runtime={runtime} stats={stats} totalStreams={streams.length} />}

        {tab === "streams" && (
          <section className="content">
            <div className="section-head">
              <div><h2>Danh sách luồng</h2><p>Mỗi luồng sử dụng một FFmpeg process độc lập.</p></div>
              <button className="btn primary" onClick={add} id="add-stream-btn"><Plus size={18} /> THÊM LUỒNG</button>
            </div>
            <div className="stream-grid">
              {streams.map(s => (
                <StreamCard
                  key={s.id}
                  config={s}
                  runtime={runtime[s.id]}
                  logs={logs[s.id] ?? []}
                  onChange={n => update(s.id, n)}
                  onDelete={() => remove(s.id)}
                  onConfirmDelete={() => confirmDelete(s.id)}
                  onStart={() => start(s)}
                  onStop={() => stop(s.id)}
                  onRestart={() => restart(s)}
                />
              ))}
            </div>
          </section>
        )}

        {tab === "history" && <HistoryPage />}
        {tab === "settings" && <SettingsPage ffmpeg={ffmpeg} />}
      </main>

      <ConfirmDialog
        open={confirm.open}
        title={confirm.title}
        message={confirm.message}
        danger={confirm.danger}
        onConfirm={confirm.onConfirm}
        onCancel={() => setConfirm(c => ({ ...c, open: false }))}
      />
      <ToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}