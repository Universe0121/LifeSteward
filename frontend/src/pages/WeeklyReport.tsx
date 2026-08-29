import { useEffect, useMemo, useState } from "react";

import {
  generateWeeklyReport,
  getWeeklyReports,
  type WeeklyReportRecord,
} from "../api";

const default_user_id = "10001";

function reportTitle(report: WeeklyReportRecord): string {
  const overview = report.report_data.overview;
  if (overview && typeof overview === "object" && "title" in overview) {
    const title = (overview as { title?: unknown }).title;
    if (typeof title === "string" && title.trim()) return title;
  }
  return `${report.week_start} 至 ${report.week_end} 周报`;
}

function reportDate(report: WeeklyReportRecord): string {
  return `${report.week_start} - ${report.week_end}`;
}

export default function WeeklyReport() {
  const [user_id, setUserId] = useState(default_user_id);
  const [week_start, setWeekStart] = useState("");
  const [reports, setReports] = useState<WeeklyReportRecord[]>([]);
  const [selected_id, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [reload_token, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getWeeklyReports(user_id)
      .then((response) => {
        if (cancelled) return;
        setReports(response.items);
        setSelectedId((current) => current ?? response.items[0]?.report_id ?? null);
      })
      .catch(() => {
        if (!cancelled) setError("周报加载失败，请确认后端服务和数据库已启动。");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reload_token, user_id]);

  const selected_report = useMemo(
    () => reports.find((report) => report.report_id === selected_id) ?? reports[0] ?? null,
    [reports, selected_id],
  );

  async function handleGenerate() {
    if (!user_id.trim() || generating) return;
    setGenerating(true);
    setError("");
    try {
      const generated = await generateWeeklyReport(user_id.trim(), week_start || undefined);
      setReports((current) => [generated, ...current.filter((report) => report.report_id !== generated.report_id)]);
      setSelectedId(generated.report_id);
    } catch {
      setError("周报生成失败，请检查数据库连接和模型配置。");
    } finally {
      setGenerating(false);
    }
  }

  function handleUserChange(value: string) {
    setUserId(value);
    setReports([]);
    setSelectedId(null);
  }

  return (
    <section className="content-page weekly-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">LifeAgent · 每周回顾</span>
          <h1>周报</h1>
        </div>
        <span className="weekly-mark" aria-hidden="true">✦</span>
      </header>

      <section className="weekly-generate-card">
        <div className="weekly-card-heading">
          <div>
            <span className="eyebrow">WEEKLY LOG</span>
            <h2>生成一页本周地图</h2>
          </div>
          <span className="weekly-card-icon" aria-hidden="true">↗</span>
        </div>
        <p>根据已记录的生活事件，整理活动占比、完成事项和下周建议。</p>
        <div className="weekly-form-row">
          <label>
            用户 ID
            <input value={user_id} onChange={(event) => handleUserChange(event.target.value)} inputMode="numeric" />
          </label>
          <label>
            周起始日
            <input type="date" value={week_start} onChange={(event) => setWeekStart(event.target.value)} />
          </label>
        </div>
        <button className="weekly-generate-button" type="button" onClick={handleGenerate} disabled={generating || !user_id.trim()}>
          {generating ? "正在生成…" : "生成周报"}
          <span aria-hidden="true">→</span>
        </button>
      </section>

      {error && <div className="weekly-error" role="alert">{error}<button type="button" onClick={() => setReloadToken((value) => value + 1)}>重试</button></div>}

      <div className="section-title weekly-history-title">
        <h2>历史周报</h2>
        <span className="eyebrow">{loading ? "加载中" : `${reports.length} 份`}</span>
      </div>

      {!loading && reports.length > 0 && (
        <div className="weekly-report-list">
          {reports.map((report) => (
            <button className={`weekly-report-row${selected_report?.report_id === report.report_id ? " selected" : ""}`} type="button" key={report.report_id} onClick={() => setSelectedId(report.report_id)}>
              <span className="weekly-row-index">{String(report.report_id).padStart(2, "0")}</span>
              <span className="weekly-row-copy"><strong>{reportTitle(report)}</strong><small>{reportDate(report)}</small></span>
              <span className="weekly-row-arrow" aria-hidden="true">→</span>
            </button>
          ))}
        </div>
      )}

      {!loading && reports.length === 0 && !error && <div className="empty-state weekly-empty">还没有周报，先生成第一份回顾。</div>}

      {selected_report && (
        <section className="weekly-preview">
          <div className="weekly-preview-heading">
            <div>
              <span className="eyebrow">{reportDate(selected_report)}</span>
              <h2>{reportTitle(selected_report)}</h2>
            </div>
            <a href={selected_report.poster_url} target="_blank" rel="noreferrer">打开海报 ↗</a>
          </div>
          <div className="weekly-poster-frame">
            <img src={selected_report.poster_url} alt={`${reportTitle(selected_report)} 海报`} />
          </div>
        </section>
      )}
    </section>
  );
}
