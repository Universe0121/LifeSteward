import { useEffect, useState } from "react";
import workspace from "../mocks/workspace.json";

type WorkspaceTask = { task_id: string; task_name: string; completed: boolean };
type Workspace = { project_name: string; project_description: string; tasks: WorkspaceTask[] };

const storage_key = "lifeagent_workspace";

function loadWorkspace(): Workspace {
  const saved = localStorage.getItem(storage_key);
  return saved ? JSON.parse(saved) as Workspace : workspace as Workspace;
}

export default function Customize() {
  const [data, setData] = useState<Workspace>(loadWorkspace);
  const [new_task, setNewTask] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => { localStorage.setItem(storage_key, JSON.stringify(data)); }, [data]);

  function addTask() {
    const task_name = new_task.trim();
    if (!task_name) return;
    setData((current) => ({ ...current, tasks: [...current.tasks, { task_id: `task_${Date.now()}`, task_name, completed: false }] }));
    setNewTask("");
  }

  function saveSettings() {
    localStorage.setItem(storage_key, JSON.stringify(data));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  }

  return (
    <section className="content-page customize-page">
      <header className="page-heading"><div><span className="eyebrow">工作区设置</span><h1>自主 DIY</h1></div><span className="theme-orb" /></header>
      <p className="page-description">调整你的项目内容与视觉风格，保存后首页会即时应用。</p>

      <div className="settings-card"><span className="settings-icon">▣</span><h2>项目内容</h2><p>编辑卡片上展示的文字</p><label>项目名称<input value={data.project_name} onChange={(event) => setData({ ...data, project_name: event.target.value })} /></label><label>一句话描述<textarea value={data.project_description} onChange={(event) => setData({ ...data, project_description: event.target.value })} /></label></div>

      <div className="settings-card"><span className="settings-icon">☷</span><h2>新增任务</h2><p>快速添加一条待办事项</p><div className="add-task-row"><input value={new_task} onChange={(event) => setNewTask(event.target.value)} placeholder="例如：整理客户反馈" /><button onClick={addTask}>添加</button></div><div className="editable-task-list">{data.tasks.map((task) => <div className="editable-task" key={task.task_id}><button onClick={() => setData({ ...data, tasks: data.tasks.map((item) => item.task_id === task.task_id ? { ...item, completed: !item.completed } : item) })}>{task.completed ? "✓" : "○"}</button><span className={task.completed ? "line-through" : ""}>{task.task_name}</span><button onClick={() => setData({ ...data, tasks: data.tasks.filter((item) => item.task_id !== task.task_id) })}>×</button></div>)}</div></div>

      <div className="settings-card"><span className="settings-icon">◐</span><h2>视觉偏好</h2><p>选择最适合你的主题</p><div className="theme-options"><button className="theme-option selected"><span className="theme-preview light-preview" />浅色</button><button className="theme-option"><span className="theme-preview dark-preview" />深色</button></div></div>
      <button className="save-button" onClick={saveSettings}>{saved ? "已保存" : "保存设置"}</button>
    </section>
  );
}
