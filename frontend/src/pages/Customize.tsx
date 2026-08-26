import { useState } from "react";
import { useWorkspace } from "../workspace";

export default function Customize() {
  const { data, updateWorkspace, toggleTheme, resetWorkspace } = useWorkspace();
  const [new_task, setNewTask] = useState("");
  const [saved, setSaved] = useState(false);

  function addTask() {
    const task_name = new_task.trim();
    if (!task_name) return;
    updateWorkspace({ ...data, tasks: [...data.tasks, { task_id: `task_${Date.now()}`, task_name, completed: false }] });
    setNewTask("");
  }

  function saveSettings() {
    localStorage.setItem("lifeagent_workspace", JSON.stringify(data));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  }

  function moveTask(task_id: string, direction: -1 | 1) {
    const index = data.tasks.findIndex((task) => task.task_id === task_id);
    const next_index = index + direction;
    if (index < 0 || next_index < 0 || next_index >= data.tasks.length) return;
    const tasks = [...data.tasks];
    [tasks[index], tasks[next_index]] = [tasks[next_index], tasks[index]];
    updateWorkspace({ ...data, tasks });
  }

  return (
    <section className="content-page customize-page">
      <header className="page-heading"><div><span className="eyebrow">工作区设置</span><h1>自主 DIY</h1></div><span className="profile-chip">✦</span></header>
      <p className="page-description">让 LifeAgent 更贴近你的生活方式，修改内容后会同步到首页。</p>

      <div className="settings-card settings-highlight"><div className="settings-card-heading"><span className="settings-icon">▣</span><div><h2>项目内容</h2><p>编辑首页项目卡片上展示的文字</p></div></div><label>项目名称<input value={data.project_name} onChange={(event) => updateWorkspace({ ...data, project_name: event.target.value })} /></label><label>一句话描述<textarea value={data.project_description} onChange={(event) => updateWorkspace({ ...data, project_description: event.target.value })} /></label></div>

      <div className="settings-card"><div className="settings-card-heading"><span className="settings-icon">☷</span><div><h2>任务管理</h2><p>添加任务，也可以调整任务顺序</p></div></div><div className="add-task-row"><input value={new_task} onChange={(event) => setNewTask(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addTask()} placeholder="例如：整理客户反馈" /><button onClick={addTask}>添加</button></div><div className="editable-task-list">{data.tasks.map((task, index) => <div className="editable-task" key={task.task_id}><button className="task-mini-action" onClick={() => updateWorkspace({ ...data, tasks: data.tasks.map((item) => item.task_id === task.task_id ? { ...item, completed: !item.completed } : item) })}>{task.completed ? "✓" : "○"}</button><span className={task.completed ? "line-through" : ""}>{task.task_name}</span><div className="task-order"><button aria-label="上移任务" disabled={index === 0} onClick={() => moveTask(task.task_id, -1)}>↑</button><button aria-label="下移任务" disabled={index === data.tasks.length - 1} onClick={() => moveTask(task.task_id, 1)}>↓</button><button aria-label="删除任务" onClick={() => updateWorkspace({ ...data, tasks: data.tasks.filter((item) => item.task_id !== task.task_id) })}>×</button></div></div>)}</div></div>

      <div className="settings-card"><div className="settings-card-heading"><span className="settings-icon">◐</span><div><h2>视觉偏好</h2><p>选择适合你的主题，立即预览变化</p></div></div><div className="theme-options"><button className={`theme-option${data.theme === "light" ? " selected" : ""}`} onClick={() => data.theme !== "light" && toggleTheme()}><span className="theme-preview light-preview" />浅色</button><button className={`theme-option${data.theme === "dark" ? " selected" : ""}`} onClick={() => data.theme !== "dark" && toggleTheme()}><span className="theme-preview dark-preview" />深色</button></div></div>

      <div className="settings-actions"><button className="text-button" onClick={resetWorkspace}>恢复默认</button><button className="save-button" onClick={saveSettings}>{saved ? "已保存 ✓" : "保存设置"}</button></div>
    </section>
  );
}
