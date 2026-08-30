import { useCallback, useEffect, useMemo, useState } from "react";
import { getLifeEvents, type LifeEvent } from "../api";
import { useAuth } from "../auth";

type EventFilter = "all" | "study" | "exercise" | "sleep";
const query_days = 30;
const event_labels: Record<string, string> = { study: "学习", exercise: "运动", sleep: "作息", work: "工作", meal: "饮食", mood: "情绪" };

function local_date_key(value = new Date()): string { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`; }
function add_days(value: string, amount: number): string { const date = new Date(`${value}T12:00:00`); date.setDate(date.getDate() + amount); return local_date_key(date); }
function parse_event_date(value: string | null | undefined): Date | null {
  if (!value) return null;
  const normalized = value.trim().replace(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})(?::(\d{2}))?$/, (_match, date, time, seconds) => `${date}T${time}:${seconds || "00"}`);
  const result = new Date(normalized);
  return Number.isNaN(result.getTime()) ? null : result;
}
function date_key(value: Date): string { return local_date_key(value); }
function event_date(event: LifeEvent): string { const date = parse_event_date(event.event_time ?? event.created_at); return date ? date_key(date) : ""; }
function event_time(event: LifeEvent): string { const date = parse_event_date(event.event_time ?? event.created_at); return date ? date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "时间未记录"; }
function date_label(value: string): string { const date = new Date(`${value}T12:00:00`); return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`; }
function build_month_grid(month_date: Date): string[] { const first = new Date(month_date.getFullYear(), month_date.getMonth(), 1); const start = new Date(first); start.setDate(first.getDate() - first.getDay()); return Array.from({ length: 42 }, (_, index) => { const date = new Date(start); date.setDate(start.getDate() + index); return date_key(date); }); }

function event_summary(event: LifeEvent): string {
  const candidate = event as LifeEvent & { ai_summary?: string; summary?: string };
  return candidate.ai_summary?.trim() || candidate.summary?.trim() || event.event_content;
}

function emotion_label(value: string | null | undefined): string {
  const normalized = value?.trim().toLocaleLowerCase();
  return !normalized || normalized === "none" || normalized === "null" ? "未记录情绪" : value!.trim();
}

export default function Timeline() {
  const { user_id } = useAuth();
  const today = local_date_key();
  const [dates, setDates] = useState(() => Array.from({ length: 31 }, (_, index) => add_days(today, -(30 - index))));
  const [selected_date, setSelectedDate] = useState(today);
  const [event_filter, setEventFilter] = useState<EventFilter>("all");
  const [expanded_id, setExpandedId] = useState<number | null>(null);
  const [life_events, setLifeEvents] = useState<LifeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload_token, setReloadToken] = useState(0);
  const [calendar_visible, setCalendarVisible] = useState(false);
  const [calendar_month, setCalendarMonth] = useState(() => new Date());

  const load_events = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getLifeEvents(user_id, query_days);
      setLifeEvents(response.items);
      setDates((current) => [...new Set([...current, ...response.items.map(event_date).filter(Boolean)])].sort().slice(-31));
    } catch {
      setError("时间轴加载失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }, [user_id]);

  useEffect(() => { void load_events(); }, [load_events, reload_token]);

  const visible_events = useMemo(() => life_events.filter((event) => event_date(event) === selected_date && (event_filter === "all" || event.event_type === event_filter)), [event_filter, life_events, selected_date]);
  const month_dates = useMemo(() => build_month_grid(calendar_month), [calendar_month]);
  const event_dates = useMemo(() => new Set(life_events.map(event_date)), [life_events]);

  function choose_date(value: string) {
    setSelectedDate(value);
    setExpandedId(null);
    setCalendarVisible(false);
    setDates((current) => current.includes(value) ? current : [...current, value].sort().slice(-31));
  }

  function open_calendar() {
    const selected = new Date(`${selected_date}T12:00:00`);
    setCalendarMonth(Number.isNaN(selected.getTime()) ? new Date() : selected);
    setCalendarVisible(true);
  }

  return <section className="content-page timeline-page">
    <header className="page-heading"><div><span className="eyebrow">{date_label(selected_date)}</span><h1>日历</h1></div><button className="plain-icon-button" aria-label="打开大日历选择日期" onClick={open_calendar}>▣</button></header>
    <div className="date-strip timeline-date-strip" aria-label="日期选择">{dates.map((date) => <button className={date === selected_date ? "selected-date" : "date-button"} key={date} onClick={() => choose_date(date)}><span>{date === today ? "今天" : `${new Date(`${date}T12:00:00`).getMonth() + 1}月`}</span><strong>{date.slice(-2)}</strong></button>)}</div>
    <div className="filter-row">{([["all", "全部"], ["study", "学习"], ["exercise", "运动"], ["sleep", "作息"]] as const).map(([value, label]) => <button className={event_filter === value ? "filter-button active" : "filter-button"} key={value} onClick={() => { setEventFilter(value); setExpandedId(null); }}>{label}</button>)}</div>
    <div className="section-title"><h2>生活记录</h2><span className="eyebrow">{visible_events.length} 条记录</span></div>
    <div className="timeline-list">
      {loading && <div className="empty-state">正在加载生活记录...</div>}
      {!loading && error && <div className="empty-state">{error}<button onClick={() => setReloadToken((value) => value + 1)}>重新加载</button></div>}
      {!loading && !error && visible_events.length === 0 && <div className="empty-state">这一天还没有该类型的记录。</div>}
      {!loading && !error && visible_events.map((event, index) => { const expanded = expanded_id === event.life_event_id; return <button className={`timeline-card ${index === 0 ? "featured" : ""}${expanded ? " expanded" : ""}`} key={event.life_event_id} onClick={() => setExpandedId(expanded ? null : event.life_event_id)}><span className="timeline-node" /><div className="timeline-copy"><span className="event-type">{event_labels[event.event_type] ?? event.event_type}</span><h3>{event_summary(event)}</h3><p>{event_time(event)} · {emotion_label(event.emotion)}</p>{expanded && <div className="event-detail"><strong>你当时告诉 AI 的原话</strong><br />{event.source_text || event.event_content}<br /><span>重要程度 {Math.round((Number(event.importance_score) || 0) * 100)}% · 来源 {event.source || "life_events"}</span></div>}</div><span className="importance">{expanded ? "收起" : (Number(event.importance_score) || 0).toFixed(1)}</span></button>; })}
    </div>
    {calendar_visible && <div className="calendar-overlay" role="dialog" aria-modal="true" aria-label="选择日期"><div className="calendar-modal"><div className="modal-heading"><h2>选择日期</h2><button className="plain-icon-button" aria-label="关闭大日历" onClick={() => setCalendarVisible(false)}>×</button></div><div className="month-heading"><button className="plain-icon-button" aria-label="上一个月" onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>‹</button><strong>{calendar_month.getFullYear()}年{calendar_month.getMonth() + 1}月</strong><button className="plain-icon-button" aria-label="下一个月" onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>›</button></div><div className="week-grid">{["日", "一", "二", "三", "四", "五", "六"].map((label) => <span key={label}>{label}</span>)}</div><div className="month-grid">{month_dates.map((date) => { const date_object = new Date(`${date}T12:00:00`); const in_month = date_object.getMonth() === calendar_month.getMonth(); const selected = date === selected_date; return <button className={`month-day${selected ? " selected" : ""}${in_month ? "" : " outside"}`} key={date} onClick={() => choose_date(date)}>{date.slice(-2)}{event_dates.has(date) && <i />}</button>; })}</div><button className="today-button" onClick={() => choose_date(today)}>回到今天</button></div></div>}
  </section>;
}
