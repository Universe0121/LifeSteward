import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { useWorkspace, local_date_key } from "../workspace";

function date_label(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function weekday_label(value: string): string {
  return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][new Date(`${value}T12:00:00`).getDay()];
}

export default function Home() {
  const { display_name } = useAuth();
  const { data, toggle_task } = useWorkspace();
  const today = local_date_key();
  const [search, setSearch] = useState("");
  const today_tasks = useMemo(() => data.tasks.filter((task) => task.task_date === today), [data.tasks, today]);
  const visible_tasks = today_tasks.filter((task) => task.task_name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const completed_count = today_tasks.filter((task) => task.completed).length;
  const project_copy = data.project_description === "创建仪表盘菜单，梳理用户流程" ? "为用户量身定制每日计划" : data.project_description;

  return <section className="home-page">
    <header className="home-hero">
      <span className="eyebrow light">{weekday_label(today)}，{date_label(today)}</span>
      <h1>嗨，{display_name || "朋友"}!</h1>
      <p>开启你今天的学习之旅</p>
      <label className="home-search"><span>⌕</span><input aria-label="搜索任务或项目" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索任务或项目" /></label>
    </header>

    <div className="section-title home-section-title"><h2>项目</h2><Link to="/customize">编辑全部</Link></div>
    <div className="project-scroller">
      <Link className="project-card dark-card" to="/today-plan"><span className="card-symbol">♙</span><span className="card-arrow">↗</span><h2>今日计划</h2><p>{project_copy}</p><strong>● 进行中 · {data.plans.filter((plan) => plan.plan_date === today).length || today_tasks.length} 个任务</strong></Link>
      <Link className="project-card blue-card" to="/sleep"><span className="card-symbol">◔</span><h2>睡眠时间</h2><p>记录总结这一周的作息</p><strong>● 模拟数据 · 近 5 天</strong></Link>
    </div>

    <div className="section-title home-section-title"><h2>任务</h2><span className="eyebrow">{completed_count}/{today_tasks.length} 已完成</span></div>
    <div className="task-list">
      {visible_tasks.length === 0 && <div className="empty-state">今天还没有匹配的任务。</div>}
      {visible_tasks.map((task) => <div className={`task-row${task.completed ? " completed" : ""}`} key={task.task_id}>
        <button className="task-checkbox" aria-label={`标记${task.task_name}`} onClick={() => toggle_task(task.task_id)}>{task.completed ? "✓" : ""}</button>
        <span>{task.task_name}</span>
      </div>)}
    </div>
    <Link className="task-manage-cta" to="/tasks">＋ 添加或管理今日任务</Link>
    <Link className="home-chat-cta" to="/chat">和 LifeAgent 聊聊今天 <span>→</span></Link>
  </section>;
}
