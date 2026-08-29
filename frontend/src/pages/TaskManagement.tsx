import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useWorkspace, local_date_key } from "../workspace";

function add_days(value: string, amount: number): string {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return local_date_key(date);
}

function date_label(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function week_label(value: string, today: string): string {
  if (value === today) return "今天";
  return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][new Date(`${value}T12:00:00`).getDay()];
}

export default function TaskManagement() {
  const { data, toggle_task, add_task, edit_task, remove_task } = useWorkspace();
  const [search_params, setSearchParams] = useSearchParams();
  const today = local_date_key();
  const date_options = useMemo(() => Array.from({ length: 31 }, (_, index) => add_days(today, index)), [today]);
  const [selected_date, setSelectedDate] = useState(today);
  const [editing_id, setEditingId] = useState<string | null>(null);
  const [draft_name, setDraftName] = useState("");
  const [draft_date, setDraftDate] = useState(today);
  const tasks = data.tasks.filter((task) => task.task_date === selected_date);

  useEffect(() => {
    const task_id = search_params.get("edit");
    if (!task_id) return;
    const task = data.tasks.find((item) => item.task_id === task_id);
    if (!task) return;
    setEditingId(task.task_id);
    setDraftName(task.task_name);
    setDraftDate(task.task_date);
    setSelectedDate(task.task_date);
    setSearchParams({}, { replace: true });
  }, [data.tasks, search_params, setSearchParams]);

  function open_new() {
    setEditingId(null);
    setDraftName("");
    setDraftDate(selected_date);
  }

  function open_edit(task_id: string) {
    const task = data.tasks.find((item) => item.task_id === task_id);
    if (!task) return;
    setEditingId(task.task_id);
    setDraftName(task.task_name);
    setDraftDate(task.task_date);
  }

  function save_task() {
    const name = draft_name.trim();
    if (!name) return;
    if (editing_id) edit_task(editing_id, name, draft_date);
    else add_task(name, draft_date);
    setSelectedDate(draft_date);
    open_new();
  }

  function delete_task(task_id: string) {
    if (window.confirm("确定删除这条任务吗？")) remove_task(task_id);
  }

  return <section className="content-page task-management-page">
    <header className="page-heading"><div><span className="eyebrow">只安排哪一天做什么</span><h1>任务清单</h1></div><Link className="plain-icon-button" to="/" aria-label="返回首页">←</Link></header>
    <p className="page-description">任务不设置具体时间；需要精确到分钟的内容请放进今日计划。</p>
    <div className="date-strip task-date-strip" aria-label="选择任务日期">{date_options.map((date) => <button className={date === selected_date ? "selected-date" : "date-button"} key={date} onClick={() => { setSelectedDate(date); setEditingId(null); }}><span>{week_label(date, today)}</span><strong>{date.slice(-2)}</strong></button>)}</div>
    <div className="section-title"><h2>{date_label(selected_date)}</h2><span className="eyebrow">{tasks.length} 项</span></div>
    <div className="task-management-list">
      {tasks.length === 0 && <div className="empty-state">这一天还没有任务，添加一个不带具体时间的待办事项。</div>}
      {tasks.map((task) => <div className="managed-task-row" key={task.task_id}>
        <button className={`task-checkbox${task.completed ? " checked" : ""}`} aria-label={`标记${task.task_name}`} onClick={() => toggle_task(task.task_id)}>{task.completed ? "✓" : ""}</button>
        <span className={task.completed ? "line-through" : ""}>{task.task_name}</span>
        <div className="task-row-actions"><button aria-label={`编辑${task.task_name}`} onClick={() => open_edit(task.task_id)}>编辑</button><button aria-label={`删除${task.task_name}`} onClick={() => delete_task(task.task_id)}>删除</button></div>
      </div>)}
    </div>
    <section className="task-editor">
      <div className="section-title editor-title"><h2>{editing_id ? "编辑任务" : "新增任务"}</h2><button className="text-button" onClick={open_new}>清空</button></div>
      <label>任务内容<input value={draft_name} onChange={(event) => setDraftName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") save_task(); }} placeholder="例如：整理客户反馈" /></label>
      <label>安排日期<select value={draft_date} onChange={(event) => setDraftDate(event.target.value)}>{date_options.map((date) => <option key={date} value={date}>{date_label(date)} · {week_label(date, today)}</option>)}</select></label>
      <button className="save-button" disabled={!draft_name.trim()} onClick={save_task}>{editing_id ? "保存修改" : "添加任务"}</button>
    </section>
  </section>;
}
