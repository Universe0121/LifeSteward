import { useState } from "react";
import { useAuth } from "../auth";
import profile_data from "../mocks/user_profile.json";

const profile_labels: Record<string, string> = { learning_style: "学习方式", sleep_habit: "作息习惯", tone: "交流偏好", lang: "语言" };
const profile_values: Record<string, string> = { short_task: "短任务、逐步完成", late_sleep: "偏晚入睡", friendly: "朋友式交流", "zh-CN": "简体中文" };
const profile_details: Record<string, string> = {
  learning_style: "更适合把大目标拆成短任务，完成一个小步骤后再继续下一步。",
  sleep_habit: "目前记录显示入睡时间偏晚。可以先固定起床时间，再逐步提前睡前准备。",
  tone: "你偏好朋友式、温和直接的交流方式。",
  lang: "当前使用简体中文。",
};

export default function Profile() {
  const { display_name } = useAuth();
  const [expanded_key, setExpandedKey] = useState<string | null>(null);
  const profile_items = [
    ...Object.entries(profile_data).filter(([key]) => key !== "user_preferences"),
    ...Object.entries(profile_data.user_preferences).map(([key, value]) => [key, value] as const),
  ];
  return <section className="content-page">
    <header className="page-heading"><div><span className="eyebrow">了解自己，调整节奏</span><h1>个人画像</h1></div></header>
    <div className="profile-hero"><div className="large-avatar">{(display_name || "朋友").slice(0, 1)}</div><div><h2>{display_name || "朋友"}</h2><p>你的生活正在被温柔地记录</p></div></div>
    <div className="profile-section"><div className="section-title"><h2>习惯与偏好</h2><span className="eyebrow">user_profile</span></div><div className="profile-list">
      {profile_items.map(([key, value]) => { const expanded = expanded_key === key; const display_value = profile_values[String(value)] ?? (String(value) || "暂未记录"); return <button className={`profile-row${expanded ? " expanded" : ""}`} key={key} onClick={() => setExpandedKey(expanded ? null : key)}><span className="row-icon">✦</span><span>{profile_labels[key] ?? key}</span><strong>{display_value}</strong><span className="row-chevron">{expanded ? "⌃" : "⌄"}</span>{expanded && <small className="profile-detail">{profile_details[key] ?? "暂时没有更多分析。"}</small>}</button>; })}
    </div></div>
    <div className="tip-card"><span className="tip-icon">✧</span><div><strong>画像会随着你的生活更新</strong><p>每一次记录，都会帮助 LifeAgent 更懂你。</p></div></div>
  </section>;
}
