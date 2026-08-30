import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth";
import { useWorkspace } from "../workspace";

export default function Customize() {
  const { display_name, logout } = useAuth();
  const { data, update_workspace, add_task, toggle_task, remove_task, edit_task, toggle_theme } = useWorkspace();
  const [new_task, setNewTask] = useState("");
  const [editing_task_id, setEditingTaskId] = useState<string | null>(null);
  const [editing_task_name, setEditingTaskName] = useState("");
  const [saved, setSaved] = useState(false);
  const saved_timer_ref = useRef<number | null>(null);

  useEffect(() => () => { if (saved_timer_ref.current !== null) window.clearTimeout(saved_timer_ref.current); }, []);

  function addTask() {
    const task_name = new_task.trim();
    if (!task_name) return;
    add_task(task_name);
    setNewTask("");
  }

  function save_settings() {
    setSaved(true);
    if (saved_timer_ref.current !== null) window.clearTimeout(saved_timer_ref.current);
    saved_timer_ref.current = window.setTimeout(() => setSaved(false), 1600);
  }

  function save_task_edit(task_id: string) {
    if (editing_task_name.trim()) edit_task(task_id, editing_task_name.trim());
    setEditingTaskId(null);
  }

  return <section className="content-page customize-page">
    <header className="page-heading"><div><span className="eyebrow">工作区设置</span><h1>自主 DIY</h1></div></header>
    <p className="page-description">调整你的项目内容与视觉风格，保存后首页会即时应用。</p>

    <div className="settings-card"><span className="settings-icon">▣</span><h2>项目内容</h2><p>编辑卡片上展示的文字</p><label>项目名称<input value={data.project_name} onChange={(event) => update_workspace((current) => ({ ...current, project_name: event.target.value }))} /></label><label>一句话描述<textarea value={data.project_description} onChange={(event) => update_workspace((current) => ({ ...current, project_description: event.target.value }))} /></label></div>

    <div className="settings-card"><span className="settings-icon">☷</span><h2>新增任务</h2><p>快速添加一条待办事项</p><div className="add-task-row"><input value={new_task} onChange={(event) => setNewTask(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addTask(); }} placeholder="例如：整理客户反馈" /><button disabled={!new_task.trim()} onClick={addTask}>添加</button></div><div className="editable-task-list">{data.tasks.map((task) => <div className="editable-task" key={task.task_id}><button aria-label={`切换${task.task_name}完成状态`} onClick={() => toggle_task(task.task_id)}>{task.completed ? "✓" : "○"}</button>{editing_task_id === task.task_id ? <input autoFocus value={editing_task_name} onChange={(event) => setEditingTaskName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") save_task_edit(task.task_id); }} onBlur={() => save_task_edit(task.task_id)} /> : <span className={task.completed ? "line-through" : ""}>{task.task_name}</span>}<button aria-label={`编辑${task.task_name}`} onClick={() => { setEditingTaskId(task.task_id); setEditingTaskName(task.task_name); }}>编辑</button><button aria-label={`删除${task.task_name}`} onClick={() => remove_task(task.task_id)}>×</button></div>)}</div></div>

    <div className="settings-card"><span className="settings-icon">◐</span><h2>视觉偏好</h2><p>选择最适合你的主题</p><div className="theme-options"><button className={`theme-option${data.theme === "light" ? " selected" : ""}`} onClick={() => data.theme !== "light" && toggle_theme()}><span className="theme-preview light-preview" />浅色</button><button className={`theme-option${data.theme === "dark" ? " selected" : ""}`} onClick={() => data.theme !== "dark" && toggle_theme()}><span className="theme-preview dark-preview" />深色</button></div></div>
    <button className="save-button" onClick={save_settings}>{saved ? "已保存" : "保存设置"}</button>
    <div className="account-row"><span>当前用户：{display_name || "朋友"}</span><button onClick={logout}>退出登录</button></div>
    {/* WorkspaceProvider persists the settings to localStorage. */}
  </section>;
}
