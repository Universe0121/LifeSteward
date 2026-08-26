import { FormEvent, useEffect, useMemo, useState } from "react";

import { getLifeEvents, type LifeEvent } from "../api";

type EventFilter = "all" | "study" | "exercise" | "sleep";

const current_user_id = 10001;
const query_days = 7;
const event_labels: Record<string, string> = { study: "学习", exercise: "运动", sleep: "作息" };

function dateKey(value: string): string {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function recentDates(days: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    dates.push(dateKey(date.toISOString()));
  }
  return dates;
}

function eventDate(event: LifeEvent): string {
  return dateKey(event.event_time ?? event.created_at);
}

function eventTime(event: LifeEvent): string {
  return new Date(event.event_time ?? event.created_at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

export default function Timeline() {
  const date_options = useMemo(() => recentDates(query_days), []);
  const [selected_date, setSelectedDate] = useState(date_options[date_options.length - 1] ?? "");
  const [event_filter, setEventFilter] = useState<EventFilter>("all");
  const [expanded_id, setExpandedId] = useState<number | null>(null);
  const [life_events, setLifeEvents] = useState<LifeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload_token, setReloadToken] = useState(0);
  const [show_event_form, setShowEventForm] = useState(false);
  const [event_form, setEventForm] = useState({ event_type: "study", event_content: "", event_time: "12:00", emotion: "calm" });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getLifeEvents(current_user_id, query_days)
      .then((response) => { if (!cancelled) setLifeEvents(response.items); })
      .catch(() => { if (!cancelled) setError("时间轴加载失败，请稍后重试。"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload_token]);

  const day_events = useMemo(
    () => life_events.filter((event) => eventDate(event) === selected_date).sort((left, right) => eventTime(left).localeCompare(eventTime(right))),
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

  function addEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const event_content = event_form.event_content.trim();
    if (!event_content) return;
    const created_at = new Date().toISOString();
    const next_event: LifeEvent = {
      life_event_id: Date.now(),
      user_id: String(current_user_id),
      conversation_id: "frontend_quick_record",
      event_type: event_form.event_type,
      event_content,
      event_time: new Date(`${selected_date}T${event_form.event_time}:00`).toISOString(),
      emotion: event_form.emotion,
      importance_score: 0.7,
      source: "frontend_demo",
      source_text: event_content,
      created_at,
    };
    setLifeEvents((current) => [...current, next_event]);
    setEventForm({ event_type: "study", event_content: "", event_time: "12:00", emotion: "calm" });
    setShowEventForm(false);
  }

  return (
    <section className="content-page timeline-page">
      <header className="page-heading"><div><span className="eyebrow">{selected_date.slice(0, 4)}年{selected_label}</span><h1>个人时间轴</h1></div><button className="profile-chip reset-date" onClick={() => setSelectedDate(date_options[date_options.length - 1] ?? "")} aria-label="回到今天">●</button></header>
      <div className="timeline-toolbar"><button className="soft-button" onClick={() => shiftDate(-1)} disabled={selected_index <= 0}>‹ <span>上一天</span></button><strong>{selected_label}</strong><button className="soft-button" onClick={() => shiftDate(1)} disabled={selected_index >= date_options.length - 1}><span>下一天</span> ›</button></div>
      <div className="date-strip" aria-label="日期选择">{date_options.map((date) => <button className={date === selected_date ? "selected-date" : "date-button"} key={date} onClick={() => { setSelectedDate(date); setExpandedId(null); }}>{date.slice(-2)}</button>)}</div>
      <div className="filter-row">{([['all', '全部'], ['study', '学习'], ['exercise', '运动'], ['sleep', '作息']] as const).map(([value, label]) => <button className={event_filter === value ? "filter-button active" : "filter-button"} key={value} onClick={() => setEventFilter(value)}>{label}</button>)}</div>
      <div className="section-title"><div><span className="eyebrow">记录你的节奏</span><h2>生活记录</h2></div><span className="eyebrow">{filtered_events.length} 条记录</span></div>
      <div className="timeline-list">
        {loading && <div className="empty-state">正在加载生活记录…</div>}
        {!loading && error && <div className="empty-state">{error}<br /><button onClick={() => setReloadToken((value) => value + 1)}>重新加载</button></div>}
        {!loading && !error && filtered_events.length === 0 && <div className="empty-state">这一天还没有该类型的记录。</div>}
        {!loading && !error && filtered_events.map((life_event, index) => { const is_expanded = expanded_id === life_event.life_event_id; return <article className={`timeline-card ${index === 0 ? "featured" : ""} ${is_expanded ? "expanded" : ""}`} key={life_event.life_event_id} onClick={() => setExpandedId(is_expanded ? null : life_event.life_event_id)}><span className="timeline-node" /><div className="timeline-copy"><span className="event-type">{event_labels[life_event.event_type] ?? life_event.event_type}</span><h3>{life_event.event_content}</h3><p>{eventTime(life_event)} · {life_event.emotion || "未记录情绪"}</p>{is_expanded && <div className="event-detail">重要程度 {(life_event.importance_score * 100).toFixed(0)}%<br />来源：{life_event.source || "life_events"}</div>}</div><span className="importance">{is_expanded ? "收起" : life_event.importance_score.toFixed(1)}</span></article>; })}
      </div>
      {show_event_form && <form className="event-form" onSubmit={addEvent}><div className="form-heading"><div><span className="eyebrow">{selected_label}</span><h2>新增记录</h2></div><button type="button" className="icon-button" onClick={() => setShowEventForm(false)}>×</button></div><input aria-label="事件内容" value={event_form.event_content} onChange={(event) => setEventForm({ ...event_form, event_content: event.target.value })} placeholder="例如：完成一小时阅读" autoFocus /><div className="form-grid"><select value={event_form.event_type} onChange={(event) => setEventForm({ ...event_form, event_type: event.target.value })}><option value="study">学习</option><option value="exercise">运动</option><option value="sleep">作息</option></select><input type="time" value={event_form.event_time} onChange={(event) => setEventForm({ ...event_form, event_time: event.target.value })} /><input value={event_form.emotion} onChange={(event) => setEventForm({ ...event_form, emotion: event.target.value })} placeholder="情绪" /></div><button className="save-button" type="submit">保存记录</button></form>}
      {!show_event_form && <button className="floating-add" onClick={() => setShowEventForm(true)}>＋ <span>新增记录</span></button>}
    </section>
  );
}
