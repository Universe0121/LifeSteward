import { useMemo, useState } from "react";
import timeline_events from "../mocks/timeline_events.json";

type LifeEvent = { event_type: string; event_content: string; event_time: string; emotion: string; importance_score: number };
type EventFilter = "all" | "study" | "exercise" | "sleep";
const event_labels: Record<string, string> = { study: "学习", exercise: "运动", sleep: "作息" };
const date_options = Object.keys(timeline_events);

export default function Timeline() {
  const [selected_date, setSelectedDate] = useState("2026-08-24");
  const [event_filter, setEventFilter] = useState<EventFilter>("all");
  const [expanded_id, setExpandedId] = useState<string | null>(null);
  const day_events = timeline_events[selected_date as keyof typeof timeline_events] as LifeEvent[];
  const filtered_events = useMemo(() => event_filter === "all" ? day_events : day_events.filter((event) => event.event_type === event_filter), [day_events, event_filter]);
  const selected_label = selected_date.slice(5).replace("-", "月") + "日";

  return (
    <section className="content-page">
      <header className="page-heading"><div><span className="eyebrow">2026年{selected_label}</span><h1>个人时间轴</h1></div><button className="profile-chip reset-date" onClick={() => setSelectedDate("2026-08-24")} aria-label="回到今天">●</button></header>
      <div className="date-strip" aria-label="日期选择">{date_options.map((date) => { const day = date.slice(-2); return <button className={date === selected_date ? "selected-date" : "date-button"} key={date} onClick={() => { setSelectedDate(date); setExpandedId(null); }}>{day}</button>; })}</div>
      <div className="filter-row">{([["all", "全部"], ["study", "学习"], ["exercise", "运动"], ["sleep", "作息"]] as const).map(([value, label]) => <button className={event_filter === value ? "filter-button active" : "filter-button"} key={value} onClick={() => setEventFilter(value)}>{label}</button>)}</div>
      <div className="section-title"><h2>生活记录</h2><span className="eyebrow">{filtered_events.length} 条记录</span></div>
      <div className="timeline-list">
        {filtered_events.length === 0 && <div className="empty-state">这一天还没有该类型的记录。</div>}
        {filtered_events.map((event, index) => { const event_id = `${selected_date}-${event.event_time}-${index}`; const is_expanded = expanded_id === event_id; return <article className={`timeline-card ${index === 0 ? "featured" : ""} ${is_expanded ? "expanded" : ""}`} key={event_id} onClick={() => setExpandedId(is_expanded ? null : event_id)}><span className="timeline-node" /><div className="timeline-copy"><span className="event-type">{event_labels[event.event_type] ?? event.event_type}</span><h3>{event.event_content}</h3><p>{event.event_time} · {event.emotion}</p>{is_expanded && <div className="event-detail">重要程度 {(event.importance_score * 100).toFixed(0)}%<br />来源：life_events</div>}</div><span className="importance">{is_expanded ? "收起" : event.importance_score.toFixed(1)}</span></article>; })}
      </div>
    </section>
  );
}
