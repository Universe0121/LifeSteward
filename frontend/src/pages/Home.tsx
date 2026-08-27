import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import workspace from "../mocks/workspace.json";

type WorkspaceTask = { task_id: string; task_name: string; completed: boolean };

export default function Home() {
  const [tasks, setTasks] = useState<WorkspaceTask[]>(workspace.tasks);
  const completed_count = useMemo(() => tasks.filter((task) => task.completed).length, [tasks]);

  function toggleTask(task_id: string) {
    setTasks((current) => current.map((task) => task.task_id === task_id ? { ...task, completed: !task.completed } : task));
  }

  return (
    <section className="home-page">
      <header className="home-hero">
        <span className="eyebrow light">星期一，8月24日</span>
        <h1>嗨，Marimar!</h1>
        <p>开启你今天的学习之旅</p>
        <div className="home-search"><span>⌕</span><span>搜索任务或项目</span><Link to="/customize">▦</Link></div>
      </header>

      <div className="section-title home-section-title"><h2>项目</h2><Link to="/customize">编辑全部</Link></div>
      <div className="project-scroller">
        <article className="project-card dark-card"><span className="card-symbol">♙</span><span className="card-arrow">↗</span><h2>今日计划</h2><p>为用户量身定制每日计划</p><strong>● 进行中 · {tasks.length} 个任务</strong></article>
        <article className="project-card blue-card"><span className="card-symbol">◔</span><h2>睡眠时间</h2><p>记录总结这一周的作息</p><strong>● 草稿 · 2 个任务</strong></article>
      </div>

      <div className="section-title home-section-title"><h2>任务</h2><span className="eyebrow">{completed_count}/{tasks.length} 已完成</span></div>
      <div className="task-list">
        {tasks.map((task) => <button className={`task-row${task.completed ? " completed" : ""}`} key={task.task_id} onClick={() => toggleTask(task.task_id)}><span className="task-checkbox">{task.completed ? "✓" : ""}</span><span>{task.task_name}</span><span className="task-more">•</span></button>)}
      </div>
      <Link className="home-chat-cta" to="/chat">和 LifeAgent 聊聊今天 <span>→</span></Link>
    </section>
  );
}
