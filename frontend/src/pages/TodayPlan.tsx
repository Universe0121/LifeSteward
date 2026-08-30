import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { normalize_plan_draft, useWorkspace, add_days, local_date_key, type DailyPlan, type PlanDraft } from "../workspace";

function plan_end_time(start_time: string, duration_minutes: number): string {
  const [hours, minutes] = start_time.split(":").map(Number);
  const total = hours * 60 + minutes + duration_minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function date_label(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function week_label(value: string, today: string): string {
  if (value === today) return "今天";
  return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][new Date(`${value}T12:00:00`).getDay()];
}

function initial_draft(): PlanDraft {
  return { task_name: "", start_time: "09:00", duration_minutes: 30, difficulty: 0.5 };
}

export default function TodayPlan() {
  const { data, add_plan, edit_plan, toggle_plan, remove_plan } = useWorkspace();
  const today = local_date_key();
  const date_options = useMemo(() => Array.from({ length: 31 }, (_, index) => add_days(today, index)), [today]);
  const [selected_date, setSelectedDate] = useState(today);
  const [editing_id, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PlanDraft>(initial_draft);
  const [duration_text, setDurationText] = useState("30");
  const [form_error, setFormError] = useState("");
  const [notification_state, setNotificationState] = useState<"idle" | "loading" | "ready" | "denied">("idle");

  const plans = useMemo(() => data.plans.filter((plan) => plan.plan_date === selected_date).sort((a, b) => a.start_time.localeCompare(b.start_time)), [data.plans, selected_date]);
  const today_plans = useMemo(() => data.plans.filter((plan) => plan.plan_date === today), [data.plans, today]);

  useEffect(() => {
    const timer_ids: number[] = [];
    if (today_plans.length === 0) return;
    for (const plan of today_plans) {
      if (plan.completed) continue;
      const [hours, minutes] = plan.start_time.split(":").map(Number);
      const target = new Date();
      target.setHours(hours, minutes, 0, 0);
      const delay = target.getTime() - Date.now();
      if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
        timer_ids.push(window.setTimeout(() => {
          if ("Notification" in window && Notification.permission === "granted") new Notification("LifeAgent 计划提醒", { body: `${plan.start_time} 开始：${plan.task_name}` });
        }, delay));
      }
    }
    return () => timer_ids.forEach((timer_id) => window.clearTimeout(timer_id));
  }, [today_plans]);

  function open_new() {
    setEditingId(null);
    setDraft(initial_draft());
    setDurationText("30");
    setFormError("");
  }

  function open_edit(plan: DailyPlan) {
    setEditingId(plan.plan_id);
    setDraft({ task_name: plan.task_name, start_time: plan.start_time, duration_minutes: plan.duration_minutes, difficulty: plan.difficulty });
    setDurationText(String(plan.duration_minutes));
    setSelectedDate(plan.plan_date);
    setFormError("");
  }

  function save_plan() {
    const candidate: PlanDraft = { ...draft, task_name: draft.task_name.trim(), duration_minutes: Number(duration_text) };
    if (!normalize_plan_draft(candidate)) {
      setFormError("请填写任务名称、有效的 HH:mm 时间，以及 1-1440 分钟的时长。");
      return;
    }
    const saved = editing_id ? edit_plan(editing_id, candidate, selected_date) : add_plan(candidate, selected_date);
    if (!saved) {
      setFormError("相同日期、时间和名称的计划已经存在，或计划内容无效。");
      return;
    }
    open_new();
  }

  function delete_plan(plan: DailyPlan) {
    if (window.confirm(`确定删除“${plan.task_name}”吗？`)) remove_plan(plan.plan_id);
  }

  async function enable_notifications() {
    if (!("Notification" in window)) {
      setNotificationState("denied");
      return;
    }
    setNotificationState("loading");
    const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    setNotificationState(permission === "granted" ? "ready" : "denied");
  }

  return <section className="content-page today-plan-page">
    <header className="page-heading"><div><span className="eyebrow">计划日期 · {date_label(selected_date)}</span><h1>今日计划</h1></div><Link className="plain-icon-button" to="/" aria-label="返回首页">←</Link></header>
    <div className="plan-hero"><span className="eyebrow light">MINUTE BY MINUTE</span><h2>按时间照顾自己的节奏</h2><p>计划精确到分钟，到点后 LifeAgent 会提醒你。</p></div>
    <div className="notification-row"><span>{notification_state === "ready" ? "●" : "○"}</span><span>{notification_state === "ready" ? "浏览器计划提醒已开启" : notification_state === "denied" ? "通知未开启，计划仍会保留" : "开启提醒，在计划时间收到通知"}</span>{notification_state !== "ready" && <button onClick={() => void enable_notifications()}>{notification_state === "loading" ? "请求中..." : "开启提醒"}</button>}</div>
    <div className="date-strip plan-date-strip" aria-label="选择计划日期">{date_options.map((date) => <button className={date === selected_date ? "selected-date" : "date-button"} key={date} onClick={() => { setSelectedDate(date); open_new(); }}><span>{week_label(date, today)}</span><strong>{date.slice(-2)}</strong></button>)}</div>
    <div className="section-title"><h2>{date_label(selected_date)}</h2><span className="eyebrow">{plans.length} 项</span></div>
    {plans.length === 0 ? <div className="empty-state">这一天还没有精确计划。</div> : <div className="plan-timeline">
      {plans.map((plan, index) => <div className="plan-row" key={plan.plan_id}><div className="plan-time"><strong>{plan.start_time}</strong><small>{plan.duration_minutes} 分钟</small></div><div className="plan-rail"><i className={plan.completed ? "done" : ""} /><b className={index === plans.length - 1 ? "hidden" : ""} /></div><div className={`plan-card${plan.completed ? " completed" : ""}`}><div><strong>{plan.task_name}</strong><small>至 {plan_end_time(plan.start_time, plan.duration_minutes)} · {plan.completed ? "已完成" : "待完成"}</small></div><div className="plan-actions"><button aria-label={`标记${plan.task_name}`} onClick={() => toggle_plan(plan.plan_id)}>{plan.completed ? "撤销" : "完成"}</button><button aria-label={`编辑${plan.task_name}`} onClick={() => open_edit(plan)}>编辑</button><button aria-label={`删除${plan.task_name}`} onClick={() => delete_plan(plan)}>删除</button></div></div></div>)}
    </div>}
    <section className="plan-editor"><div className="section-title editor-title"><h2>{editing_id ? "编辑计划" : "新增计划"}</h2><button className="text-button" onClick={open_new}>清空</button></div><label>计划内容<input value={draft.task_name} onChange={(event) => setDraft((current) => ({ ...current, task_name: event.target.value }))} placeholder="例如：专注学习数学" /></label><div className="plan-form-grid"><label>开始时间<input type="time" value={draft.start_time} onChange={(event) => setDraft((current) => ({ ...current, start_time: event.target.value }))} /></label><label>时长（分钟）<input type="number" min="1" max="1440" value={duration_text} onChange={(event) => setDurationText(event.target.value)} /></label></div><label>难度<select value={String(draft.difficulty)} onChange={(event) => setDraft((current) => ({ ...current, difficulty: Number(event.target.value) }))}><option value="0.3">轻松</option><option value="0.5">适中</option><option value="0.7">有挑战</option><option value="1">高强度</option></select></label>{form_error && <p className="form-error" role="alert">{form_error}</p>}<button className="save-button" onClick={save_plan}>{editing_id ? "保存修改" : "添加到今日计划"}</button></section>
    <Link className="home-chat-cta" to="/chat">去聊天添加或调整计划 <span>→</span></Link>
  </section>;
}
