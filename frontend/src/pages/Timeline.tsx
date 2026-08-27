import { useEffect, useMemo, useState } from "react";

import { getLifeEvents, type LifeEvent } from "../api";

type EventFilter = "all" | "study" | "exercise" | "sleep" | "schedule" | "reminder";

const current_user_id = 10001;
const event_labels: Record<string, string> = {
  study: "学习",
  exercise: "运动",
  sleep: "作息",
  schedule: "日程",
  reminder: "提醒",
};

function dateKey(value: string): string {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calendarDates(anchor: string, past: number, future: number): string[] {
  const dates: string[] = [];
  const today = new Date(`${anchor}T12:00:00`);
  for (let offset = -past; offset <= future; offset += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + offset);
    dates.push(dateKey(date.toISOString()));
  }
  return dates;
}

function eventDate(event: LifeEvent): string {
  return dateKey(event.event_time ?? event.created_at);
}

function eventTime(event: LifeEvent): string {
  return new Date(event.event_time ?? event.created_at).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Timeline() {
  const today_key = dateKey(new Date().toISOString());
  const [selected_date, setSelectedDate] = useState(today_key);
  const date_options = useMemo(() => calendarDates(selected_date, 3, 3), [selected_date]);
  const [event_filter, setEventFilter] = useState<EventFilter>("all");
  const [expanded_id, setExpandedId] = useState<number | null>(null);
  const [life_events, setLifeEvents] = useState<LifeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload_token, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getLifeEvents(current_user_id, 7, {
      start_date: date_options[0] ?? "",
      end_date: date_options[date_options.length - 1] ?? "",
    })
      .then((response) => { if (!cancelled) setLifeEvents(response.items); })
      .catch((request_error: unknown) => { if (!cancelled) setError(request_error instanceof Error ? request_error.message : "时间轴加载失败，请稍后重试。"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload_token, date_options]);

  const day_events = useMemo(
    () => life_events.filter((event) => eventDate(event) === selected_date),
    [life_events, selected_date],
  );
  const filtered_events = useMemo(
    () => event_filter === "all" ? day_events : day_events.filter((event) => event.event_type === event_filter),
    [day_events, event_filter],
  );
  const selected_label = selected_date.slice(5).replace("-", "月") + "日";
  const selected_index = date_options.indexOf(selected_date);

  function shiftDate(direction: -1 | 1) {
    const next_date = date_options[selected_index + direction];
    if (next_date) { setSelectedDate(next_date); setExpandedId(null); }
  }

  return (
    <section className="content-page timeline-page">
      <header className="page-heading"><div><span className="eyebrow">{selected_date.slice(0, 4)}年{selected_label}</span><h1>个人时间轴</h1></div><button className="profile-chip reset-date" onClick={() => setSelectedDate(today_key)} aria-label="回到今天">●</button></header>
      <div className="timeline-toolbar"><button className="soft-button" onClick={() => shiftDate(-1)} disabled={selected_index <= 0}>‹ <span>上一天</span></button><strong>{selected_label}</strong><button className="soft-button" onClick={() => shiftDate(1)} disabled={selected_index >= date_options.length - 1}><span>下一天</span> ›</button></div>
      <div className="date-picker-row"><label htmlFor="timeline-date-picker">选择日期</label><input id="timeline-date-picker" className="date-picker" type="date" min="2000-01-01" max="2099-12-31" value={selected_date} onChange={(event) => { setSelectedDate(event.target.value); setExpandedId(null); }} /></div>
      <div className="date-strip" aria-label="日期选择（含未来日期）">{date_options.map((date) => <button className={date === selected_date ? "selected-date" : "date-button"} key={date} onClick={() => { setSelectedDate(date); setExpandedId(null); }}>{date.slice(-2)}</button>)}</div>
      <div className="filter-row">{([['all', '全部'], ['study', '学习'], ['exercise', '运动'], ['sleep', '作息'], ['schedule', '日程'], ['reminder', '提醒']] as const).map(([value, label]) => <button className={event_filter === value ? "filter-button active" : "filter-button"} key={value} onClick={() => setEventFilter(value)}>{label}</button>)}</div>
      <div className="section-title"><h2>生活记录</h2><span className="eyebrow">{filtered_events.length} 条记录</span></div>
      <div className="timeline-list">
        {loading && <div className="empty-state">正在加载生活记录…</div>}
        {!loading && error && <div className="empty-state" role="alert">{error}<br /><button onClick={() => setReloadToken((value) => value + 1)}>重新加载</button></div>}
        {!loading && !error && filtered_events.length === 0 && <div className="empty-state">这一天还没有该类型的记录。</div>}
        {!loading && !error && filtered_events.map((event, index) => { const is_expanded = expanded_id === event.life_event_id; return <article className={`timeline-card ${index === 0 ? "featured" : ""} ${is_expanded ? "expanded" : ""}`} key={event.life_event_id} onClick={() => setExpandedId(is_expanded ? null : event.life_event_id)}><span className="timeline-node" /><div className="timeline-copy"><span className="event-type">{event_labels[event.event_type] ?? event.event_type}</span><h3>{event.event_content}</h3><p>{eventTime(event)} · {event.emotion || "未记录情绪"}</p>{is_expanded && <div className="event-detail">重要程度 {(event.importance_score * 100).toFixed(0)}%<br />来源：{event.source || "life_events"}</div>}</div><span className="importance">{is_expanded ? "收起" : event.importance_score.toFixed(1)}</span></article>; })}
      </div>
    </section>
  );
}
