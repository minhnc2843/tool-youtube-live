import { Cpu, MemoryStick, Activity, Radio, AlertTriangle, Wifi } from "lucide-react";
import type { StreamRuntime, SystemStats } from "../types";
import { formatBytes } from "../utils/format";

interface Props {
  runtime: Record<string, StreamRuntime>;
  stats: SystemStats;
  totalStreams: number;
}

export function Dashboard({ runtime, stats, totalStreams }: Props) {
  const runtimes = Object.values(runtime);
  const active = runtimes.filter(x => ["STARTING", "LIVE", "RECONNECTING", "STOPPING"].includes(x.state)).length;
  const live = runtimes.filter(x => x.state === "LIVE").length;
  const errors = runtimes.filter(x => x.state === "ERROR").length;
  const reconnecting = runtimes.filter(x => x.state === "RECONNECTING").length;
  const ram = stats.ramTotal > 0 ? Math.round((stats.ramUsed / stats.ramTotal) * 100) : 0;

  return (
    <section className="dashboard-page">
      <div className="section-head">
        <div><h2>Dashboard</h2><p>Tổng quan hệ thống phát trực tiếp</p></div>
      </div>

      <div className="dashboard-grid">
        <div className="dash-card">
          <div className="dash-card-icon"><Activity size={20} /></div>
          <div className="dash-card-info">
            <span className="dash-label">TỔNG LUỒNG</span>
            <strong>{totalStreams}</strong>
            <small>đã cấu hình</small>
          </div>
        </div>

        <div className="dash-card">
          <div className="dash-card-icon active-icon"><Wifi size={20} /></div>
          <div className="dash-card-info">
            <span className="dash-label">ACTIVE</span>
            <strong>{active}</strong>
            <small>đang xử lý</small>
          </div>
        </div>

        <div className="dash-card live-card">
          <div className="dash-card-icon live-icon"><Radio size={20} /></div>
          <div className="dash-card-info">
            <span className="dash-label">LIVE</span>
            <strong className="live-value">{live}</strong>
            <small>đang phát YouTube</small>
          </div>
        </div>

        <div className={`dash-card ${errors > 0 ? 'error-card' : ''}`}>
          <div className={`dash-card-icon ${errors > 0 ? 'error-icon' : ''}`}><AlertTriangle size={20} /></div>
          <div className="dash-card-info">
            <span className="dash-label">ERROR</span>
            <strong className={errors > 0 ? 'error-value' : ''}>{errors}</strong>
            <small>cần kiểm tra</small>
          </div>
        </div>

        {reconnecting > 0 && (
          <div className="dash-card warn-card">
            <div className="dash-card-icon warn-icon"><Wifi size={20} /></div>
            <div className="dash-card-info">
              <span className="dash-label">RECONNECTING</span>
              <strong>{reconnecting}</strong>
              <small>đang kết nối lại</small>
            </div>
          </div>
        )}
      </div>

      <h3 className="dash-section-title">Tài nguyên hệ thống</h3>
      <div className="resource-grid">
        <div className="resource-card">
          <div className="resource-header">
            <Cpu size={16} />
            <span>CPU</span>
          </div>
          <div className="resource-bar-track">
            <div className={`resource-bar ${stats.cpu > 85 ? 'bar-danger' : stats.cpu > 60 ? 'bar-warn' : 'bar-ok'}`} style={{ width: `${stats.cpu}%` }} />
          </div>
          <div className="resource-value">
            <strong>{stats.cpu}%</strong>
            {stats.cpu > 85 && <span className="resource-warn">⚠ HIGH CPU USAGE</span>}
          </div>
        </div>

        <div className="resource-card">
          <div className="resource-header">
            <MemoryStick size={16} />
            <span>RAM</span>
          </div>
          <div className="resource-bar-track">
            <div className={`resource-bar ${ram > 85 ? 'bar-danger' : ram > 60 ? 'bar-warn' : 'bar-ok'}`} style={{ width: `${ram}%` }} />
          </div>
          <div className="resource-value">
            <strong>{ram}%</strong>
            <small>{formatBytes(stats.ramUsed)} / {formatBytes(stats.ramTotal)}</small>
          </div>
        </div>

        <div className="resource-card">
          <div className="resource-header">
            <Activity size={16} />
            <span>FFmpeg Processes</span>
          </div>
          <div className="resource-value" style={{ marginTop: 12 }}>
            <strong>{active}</strong>
            <small>đang hoạt động</small>
          </div>
        </div>
      </div>
    </section>
  );
}
