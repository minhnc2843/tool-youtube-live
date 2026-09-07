import { useEffect, useState } from "react";
import type { HistoryRecord } from "../types";
import { formatDuration } from "../utils/format";

const FILTERS = ["All", "LIVE", "COMPLETED", "ERROR"] as const;

export function HistoryPage() {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [filter, setFilter] = useState<string>("All");

  useEffect(() => {
    window.desktop.getHistory(filter === "All" ? undefined : filter).then(setRecords);
  }, [filter]);

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    try {
      return new Date(d + "Z").toLocaleString("vi-VN");
    } catch {
      return d;
    }
  };

  return (
    <section className="history-page">
      <div className="section-head">
        <div><h2>Lịch sử phát</h2><p>Nhật ký các phiên phát trực tiếp</p></div>
      </div>

      <div className="history-filters">
        {FILTERS.map(f => (
          <button key={f} className={`btn ${filter === f ? 'primary' : 'secondary'}`} onClick={() => setFilter(f)}>{f === "All" ? "Tất cả" : f}</button>
        ))}
      </div>

      {records.length === 0 ? (
        <div className="empty">Chưa có lịch sử phát trực tiếp.</div>
      ) : (
        <div className="history-table-wrap">
          <table className="history-table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Luồng</th>
                <th>Video</th>
                <th>Độ phân giải</th>
                <th>Thời lượng</th>
                <th>Trạng thái</th>
                <th>Reconnect</th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id}>
                  <td>{formatDate(r.started_at)}</td>
                  <td>{r.stream_name}</td>
                  <td className="history-video">{r.video_path?.split(/[\\/]/).pop() || "—"}</td>
                  <td>{r.resolution || "—"}</td>
                  <td>{r.duration_seconds > 0 ? formatDuration(r.duration_seconds) : "—"}</td>
                  <td><span className={`history-status status-${r.status?.toLowerCase()}`}>{r.status}</span></td>
                  <td>{r.reconnect_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
