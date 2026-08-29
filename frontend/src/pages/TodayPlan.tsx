import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useWorkspace, local_date_key } from "../workspace";

function plan_end_time(start_time: string, duration_minutes: number): string {
  const [hours, minutes] = start_time.split(":").map(Number);
  const total = hours * 60 + minutes + duration_minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function plan_date(start_time: string): Date {
  const [hours, minutes] = start_time.split(":").map(Number);
  const result = new Date();
  result.setHours(hours, minutes, 0, 0);
  return result;
}

export default function TodayPlan() {
  const { data, toggle_plan, remove_plan } = useWorkspace();
  const today = local_date_key();
  const plans = useMemo(() => data.plans.filter((plan) => plan.plan_date === today).sort((a, b) => a.start_time.localeCompare(b.start_time)), [data.plans, today]);
  const [notification_state, setNotificationState] = useState<"idle" | "loading" | "ready" | "denied">("idle");

  useEffect(() => {
    const timer_ids: number[] = [];
    if (plans.length === 0) return;
    for (const plan of plans) {
      if (plan.completed) continue;
      const delay = plan_date(plan.start_time).getTime() - Date.now();
      if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
        timer_ids.push(window.setTimeout(() => {
          if ("Notification" in window && Notification.permission === "granted") new Notification("LifeAgent 计划提醒", { body: `${plan.start_time} 开始：${plan.task_name}` });
        }, delay));
      }
    }
    return () => timer_ids.forEach((timer_id) => window.clearTimeout(timer_id));
  }, [plans]);

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
    <header className="page-heading"><div><span className="eyebrow">今天 · {today}</span><h1>今日计划</h1></div><Link className="plain-icon-button" to="/" aria-label="返回首页">←</Link></header>
    <div className="plan-hero"><span className="eyebrow light">MINUTE BY MINUTE</span><h2>按时间照顾自己的节奏</h2><p>计划精确到分钟，到点后 LifeAgent 会提醒你。</p></div>
    <div className="notification-row"><span>{notification_state === "ready" ? "●" : "○"}</span><span>{notification_state === "ready" ? "浏览器计划提醒已开启" : notification_state === "denied" ? "通知未开启，计划仍会保留" : "开启提醒，在计划时间收到通知"}</span>{notification_state !== "ready" && <button onClick={() => void enable_notifications()}>{notification_state === "loading" ? "请求中..." : "开启提醒"}</button>}</div>
    {plans.length === 0 ? <div className="empty-state">今天还没有精确计划。<Link to="/chat">去聊天安排</Link></div> : <div className="plan-timeline">
      {plans.map((plan, index) => <div className="plan-row" key={plan.plan_id}><div className="plan-time"><strong>{plan.start_time}</strong><small>{plan.duration_minutes} 分钟</small></div><div className="plan-rail"><i className={plan.completed ? "done" : ""} /><b className={index === plans.length - 1 ? "hidden" : ""} /></div><div className={`plan-card${plan.completed ? " completed" : ""}`}><div><strong>{plan.task_name}</strong><small>至 {plan_end_time(plan.start_time, plan.duration_minutes)} · {plan.completed ? "已完成" : "待完成"}</small></div><div className="plan-actions"><button aria-label={`标记${plan.task_name}`} onClick={() => toggle_plan(plan.plan_id)}>{plan.completed ? "撤销" : "完成"}</button><button aria-label={`删除${plan.task_name}`} onClick={() => remove_plan(plan.plan_id)}>删除</button></div></div></div>)}
    </div>}
    <Link className="home-chat-cta" to="/chat">去聊天添加或调整计划 <span>→</span></Link>
  </section>;
}
