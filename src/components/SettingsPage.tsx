import { useEffect, useState } from "react";
import type { AppSettings } from "../types";
import { useToast } from "../hooks/useToast";

interface Props {
  ffmpeg: { ok: boolean; path: string; version?: string; ffprobePath?: string };
}

export function SettingsPage({ ffmpeg }: Props) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const { addToast } = useToast();

  useEffect(() => {
    window.desktop.getSettings().then(setSettings);
  }, []);

  if (!settings) return <div className="empty">Đang tải cài đặt...</div>;

  const patch = (p: Partial<AppSettings>) => {
    const next = { ...settings, ...p };
    setSettings(next);
    window.desktop.setSettings(next).then(() => {
      addToast("success", "Đã lưu cài đặt");
    });
  };

  return (
    <section className="settings-page">
      <div className="section-head">
        <div><h2>Cài đặt hệ thống</h2><p>Cấu hình mặc định cho các luồng mới.</p></div>
      </div>

      <div className="settings-card">
        <h4 className="settings-group-title">FFmpeg Engine</h4>
        <div className="setting">
          <span>Trạng thái FFmpeg</span>
          <div><b>{ffmpeg.ok ? "✓ Đã sẵn sàng" : "✕ Chưa tìm thấy"}</b><small>{ffmpeg.path}</small></div>
        </div>
        {ffmpeg.version && (
          <div className="setting">
            <span>Phiên bản</span>
            <div><small>{ffmpeg.version}</small></div>
          </div>
        )}
        {ffmpeg.ffprobePath && (
          <div className="setting">
            <span>FFprobe</span>
            <div><small>{ffmpeg.ffprobePath}</small></div>
          </div>
        )}
      </div>

      <div className="settings-card">
        <h4 className="settings-group-title">Video mặc định</h4>
        <div className="setting">
          <span>Định dạng mặc định</span>
          <select value={settings.defaultAspectRatio} onChange={e => patch({ defaultAspectRatio: e.target.value as "16:9" | "9:16" })}>
            <option value="16:9">16:9 (1920×1080)</option>
            <option value="9:16">9:16 (1080×1920)</option>
          </select>
        </div>
        <div className="setting">
          <span>FPS mặc định</span>
          <input type="number" min={1} max={120} value={settings.defaultFps} onChange={e => patch({ defaultFps: Number(e.target.value) })} />
        </div>
        <div className="setting">
          <span>Bitrate video (kbps)</span>
          <input type="number" min={100} max={50000} value={settings.defaultBitrate} onChange={e => patch({ defaultBitrate: Number(e.target.value) })} />
        </div>
        <div className="setting">
          <span>Bitrate audio (kbps)</span>
          <input type="number" min={32} max={320} value={settings.audioBitrate} onChange={e => patch({ audioBitrate: Number(e.target.value) })} />
        </div>
        <div className="setting">
          <span>Lặp video mặc định</span>
          <label className="toggle"><input type="checkbox" checked={settings.loop} onChange={e => patch({ loop: e.target.checked })} /><span className="toggle-slider" /></label>
        </div>
      </div>

      <div className="settings-card">
        <h4 className="settings-group-title">Kết nối</h4>
        <div className="setting">
          <span>Tự kết nối lại</span>
          <label className="toggle"><input type="checkbox" checked={settings.autoReconnect} onChange={e => patch({ autoReconnect: e.target.checked })} /><span className="toggle-slider" /></label>
        </div>
        <div className="setting">
          <span>Delay reconnect (giây)</span>
          <input type="number" min={1} max={300} value={settings.reconnectDelay} onChange={e => patch({ reconnectDelay: Number(e.target.value) })} />
        </div>
        <div className="setting">
          <span>Số lần reconnect tối đa</span>
          <input type="number" min={1} max={999} value={settings.maxReconnectAttempts} onChange={e => patch({ maxReconnectAttempts: Number(e.target.value) })} />
        </div>
        <div className="setting">
          <span>Delay giữa các luồng (giây)</span>
          <input type="number" min={0} max={30} value={settings.startDelay} onChange={e => patch({ startDelay: Number(e.target.value) })} />
        </div>
      </div>
    </section>
  );
}
