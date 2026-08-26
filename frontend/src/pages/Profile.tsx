import user_profile from "../mocks/user_profile.json";
import timeline_events from "../mocks/timeline_events.json";

const profile_labels: Record<string, string> = { learning_style: "学习方式", sleep_habit: "作息习惯" };
const profile_values: Record<string, string> = { short_task: "短任务、逐步完成", late_sleep: "偏晚入睡", friendly: "朋友式交流", "zh-CN": "简体中文" };

export default function Profile() {
  const profile_items = Object.entries(user_profile).filter(([key]) => key !== "user_preferences");
  const all_events = Object.values(timeline_events).flat();
  const study_count = all_events.filter((event) => event.event_type === "study").length;
  const exercise_count = all_events.filter((event) => event.event_type === "exercise").length;
  return (
    <section className="content-page">
      <header className="page-heading"><div><span className="eyebrow">了解自己，调整节奏</span><h1>个人画像</h1></div><span className="profile-chip">你</span></header>
      <div className="profile-hero"><div className="large-avatar">M</div><div><h2>Marimar</h2><p>你的生活正在被温柔地记录</p></div></div>
      <div className="profile-stats"><article><strong>{all_events.length}</strong><span>生活记录</span></article><article><strong>{study_count}</strong><span>学习事件</span></article><article><strong>{exercise_count}</strong><span>运动事件</span></article></div>
      <div className="profile-section"><div className="section-title"><h2>习惯与偏好</h2><span className="eyebrow">user_profile</span></div><div className="profile-list">
        {profile_items.map(([key, value]) => <div className="profile-row" key={key}><span className="row-icon">✦</span><span>{profile_labels[key] ?? key}</span><strong>{profile_values[String(value)] ?? String(value)}</strong></div>)}
        <div className="profile-row"><span className="row-icon">♡</span><span>交流偏好</span><strong>{profile_values[user_profile.user_preferences.tone]}</strong></div>
      </div></div>
      <div className="insight-card"><div className="insight-orb">✧</div><div><span className="eyebrow">本周观察</span><h3>你在专注之后，也会主动留出恢复时间。</h3><p>继续保持学习、运动和休息之间的平衡。</p></div></div>
      <div className="tip-card"><span className="tip-icon">✧</span><div><strong>画像会随着你的生活更新</strong><p>每一次记录，都会帮助 LifeAgent 更懂你。</p></div></div>
    </section>
  );
}
