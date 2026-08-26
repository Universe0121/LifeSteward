import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useWorkspace } from "../workspace";

export default function Home() {
  const { data, updateWorkspace } = useWorkspace();
  const [search_query, setSearchQuery] = useState("");
  const tasks = data.tasks;
  const completed_count = useMemo(() => tasks.filter((task) => task.completed).length, [tasks]);
  const visible_tasks = useMemo(() => tasks.filter((task) => task.task_name.toLowerCase().includes(search_query.toLowerCase().trim())), [tasks, search_query]);
  const completion_rate = tasks.length ? Math.round((completed_count / tasks.length) * 100) : 0;

  function toggleTask(task_id: string) {
    updateWorkspace({ ...data, tasks: tasks.map((task) => task.task_id === task_id ? { ...task, completed: !task.completed } : task) });
  }

  return (
    <section className="home-page">
      <header className="home-hero">
        <span className="eyebrow light">星期一，8月24日</span>
        <h1>嗨，Marimar!</h1>
        <p>开启你今天的学习之旅</p>
        <label className="home-search"><span>⌕</span><input aria-label="搜索任务或项目" value={search_query} onChange={(event) => setSearchQuery(event.target.value)} placeholder="搜索任务或项目" /><Link to="/customize">▦</Link></label>
      </header>

      <div className="section-title home-section-title"><div><span className="eyebrow">今天的空间</span><h2>项目</h2></div><Link to="/customize">编辑全部</Link></div>
      <div className="project-scroller">
        <Link to="/customize" className="project-card dark-card"><span className="card-symbol">♙</span><span className="card-arrow">↗</span><h2>{data.project_name}</h2><p>{data.project_description}</p><strong>● 进行中 · {tasks.length} 个任务</strong></Link>
        <Link to="/timeline" className="project-card blue-card"><span className="card-symbol">◔</span><span className="card-arrow">↗</span><h2>生活时间轴</h2><p>回看今天与过去的生活节奏</p><strong>● 已记录 · 3 个分类</strong></Link>
      </div>

      <div className="stat-grid">
        <article className="stat-card"><span>今日完成率</span><strong>{completion_rate}%</strong><small>{completed_count} / {tasks.length || 0} 项任务</small></article>
        <article className="stat-card accent-stat"><span>连续记录</span><strong>7 天</strong><small>保持住这个节奏</small></article>
        <Link to="/timeline" className="stat-card action-stat"><span>快捷记录</span><strong>＋</strong><small>添加一条生活事件</small></Link>
      </div>

      <div className="section-title home-section-title"><h2>任务</h2><span className="eyebrow">{completed_count}/{tasks.length} 已完成</span></div>
      <div className="task-list">
        {visible_tasks.length === 0 && <div className="empty-state">没有找到匹配的任务。</div>}
        {visible_tasks.map((task) => <button className={`task-row${task.completed ? " completed" : ""}`} key={task.task_id} onClick={() => toggleTask(task.task_id)}><span className="task-checkbox">{task.completed ? "✓" : ""}</span><span>{task.task_name}</span><span className="task-more">•</span></button>)}
      </div>
      <Link className="home-chat-cta" to="/chat">和 LifeAgent 聊聊今天 <span>→</span></Link>
    </section>
  );
}
