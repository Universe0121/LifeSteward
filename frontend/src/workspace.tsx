import { createContext, ReactNode, SetStateAction, useContext, useEffect, useMemo, useState } from "react";
import workspace from "./mocks/workspace.json";
import { plan_identity } from "./planning";

export type WorkspaceTask = {
  task_id: string;
  task_name: string;
  completed: boolean;
  task_date: string;
};

export type DailyPlan = {
  plan_id: string;
  plan_date: string;
  task_name: string;
  start_time: string;
  duration_minutes: number;
  difficulty: number;
  completed: boolean;
};

export type PlanDraft = Omit<DailyPlan, "plan_id" | "plan_date" | "completed">;

export type Workspace = {
  project_name: string;
  project_description: string;
  tasks: WorkspaceTask[];
  plans: DailyPlan[];
  theme: "light" | "dark";
};

const legacy_storage_key = "lifeagent_workspace_10001";
const metadata_storage_key = "lifeagent_workspace_metadata_v2";
const tasks_storage_key = "lifeagent_workspace_tasks_v2";
const plans_storage_key = "lifeagent_workspace_plans_v2";
const storage_version_key = "lifeagent_workspace_storage_version";
const storage_version = "2";

export function local_date_key(value = new Date()): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export function add_days(value: string, amount: number): string {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return local_date_key(date);
}

const today_key = local_date_key();
const default_tasks: WorkspaceTask[] = (workspace.tasks as Array<{ task_id: string; task_name: string; completed: boolean }>).map((task) => ({
  task_id: task.task_id,
  task_name: task.task_name.trim(),
  completed: task.completed === true,
  task_date: today_key,
}));
const default_plans: DailyPlan[] = [
  { plan_id: "plan_demo_001", plan_date: today_key, task_name: "完成 10 道 C++ 题目", start_time: "09:00", duration_minutes: 60, difficulty: 0.7, completed: true },
  { plan_id: "plan_demo_002", plan_date: today_key, task_name: "背 50 个英语单词", start_time: "14:00", duration_minutes: 30, difficulty: 0.5, completed: false },
  { plan_id: "plan_demo_003", plan_date: today_key, task_name: "去操场跑步", start_time: "18:30", duration_minutes: 45, difficulty: 0.4, completed: false },
];

export const default_workspace: Workspace = {
  project_name: workspace.project_name,
  project_description: workspace.project_description,
  tasks: default_tasks,
  plans: default_plans,
  theme: "light",
};

function clone_default_workspace(): Workspace {
  return {
    project_name: default_workspace.project_name,
    project_description: default_workspace.project_description,
    tasks: default_workspace.tasks.map((task) => ({ ...task })),
    plans: default_workspace.plans.map((plan) => ({ ...plan })),
    theme: default_workspace.theme,
  };
}

function valid_date(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parse_clock(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours <= 23 && minutes <= 59 ? hours * 60 + minutes : null;
}

function normalize_task(value: unknown): WorkspaceTask | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<WorkspaceTask>;
  const task_name = typeof candidate.task_name === "string" ? candidate.task_name.trim() : "";
  if (typeof candidate.task_id !== "string" || !task_name) return null;
  return {
    task_id: candidate.task_id,
    task_name,
    completed: candidate.completed === true,
    task_date: valid_date(candidate.task_date) ? candidate.task_date : today_key,
  };
}

export function normalize_plan_draft(value: unknown): PlanDraft | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<PlanDraft>;
  const task_name = typeof candidate.task_name === "string" ? candidate.task_name.trim() : "";
  const start_time = typeof candidate.start_time === "string" ? candidate.start_time.trim() : "";
  const duration_minutes = typeof candidate.duration_minutes === "number" ? Math.trunc(candidate.duration_minutes) : Number(candidate.duration_minutes);
  const difficulty = typeof candidate.difficulty === "number" ? candidate.difficulty : Number(candidate.difficulty);
  if (!task_name || parse_clock(start_time) === null || !Number.isFinite(duration_minutes) || duration_minutes < 1 || duration_minutes > 1440) return null;
  return { task_name, start_time, duration_minutes, difficulty: Number.isFinite(difficulty) ? Math.max(0, Math.min(1, difficulty)) : 0.5 };
}

function normalize_plan(value: unknown): DailyPlan | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<DailyPlan>;
  if (typeof candidate.plan_id !== "string" || !valid_date(candidate.plan_date)) return null;
  const draft = normalize_plan_draft(candidate);
  return draft ? { ...draft, plan_id: candidate.plan_id, plan_date: candidate.plan_date, completed: candidate.completed === true } : null;
}

function normalize_task_list(value: unknown, fallback: WorkspaceTask[]): WorkspaceTask[] {
  return Array.isArray(value) ? value.map(normalize_task).filter((task): task is WorkspaceTask => task !== null) : fallback.map((task) => ({ ...task }));
}

function normalize_plan_list(value: unknown, fallback: DailyPlan[]): DailyPlan[] {
  return Array.isArray(value) ? value.map(normalize_plan).filter((plan): plan is DailyPlan => plan !== null) : fallback.map((plan) => ({ ...plan }));
}

function parse_json(value: string | null): unknown {
  if (!value) return null;
  try { return JSON.parse(value) as unknown; } catch { return null; }
}

function normalize_workspace(value: unknown): Workspace {
  if (!value || typeof value !== "object") return clone_default_workspace();
  const candidate = value as Partial<Workspace> & { items?: unknown[] };
  const items = Array.isArray(candidate.items) ? candidate.items : [];
  const raw_tasks = Array.isArray(candidate.tasks) ? candidate.tasks : items.filter((item) => !(item && typeof item === "object" && "start_time" in item));
  const raw_plans = Array.isArray(candidate.plans) ? candidate.plans : items.filter((item) => item && typeof item === "object" && "start_time" in item);
  return {
    project_name: typeof candidate.project_name === "string" ? candidate.project_name : default_workspace.project_name,
    project_description: typeof candidate.project_description === "string" ? candidate.project_description : default_workspace.project_description,
    tasks: normalize_task_list(raw_tasks, default_tasks),
    plans: normalize_plan_list(raw_plans, default_plans),
    theme: candidate.theme === "dark" ? "dark" : "light",
  };
}

function load_workspace(): Workspace {
  try {
    const legacy = normalize_workspace(localStorage.getItem(legacy_storage_key) ? parse_json(localStorage.getItem(legacy_storage_key)) : null);
    const metadata = parse_json(localStorage.getItem(metadata_storage_key));
    const metadata_record = metadata && typeof metadata === "object" ? metadata as Partial<Workspace> : {};
    const task_value = localStorage.getItem(tasks_storage_key);
    const plan_value = localStorage.getItem(plans_storage_key);
    const result: Workspace = {
      project_name: typeof metadata_record.project_name === "string" ? metadata_record.project_name : legacy.project_name,
      project_description: typeof metadata_record.project_description === "string" ? metadata_record.project_description : legacy.project_description,
      theme: metadata_record.theme === "dark" ? "dark" : legacy.theme,
      tasks: normalize_task_list(task_value === null ? null : parse_json(task_value), task_value === null ? legacy.tasks : []),
      plans: normalize_plan_list(plan_value === null ? null : parse_json(plan_value), plan_value === null ? legacy.plans : []),
    };
    if (localStorage.getItem(storage_version_key) !== storage_version || task_value === null || plan_value === null || !metadata) {
      persist_workspace(result);
    }
    return result;
  } catch {
    return clone_default_workspace();
  }
}

function persist_workspace(data: Workspace): void {
  try {
    localStorage.setItem(metadata_storage_key, JSON.stringify({ project_name: data.project_name, project_description: data.project_description, theme: data.theme }));
    localStorage.setItem(tasks_storage_key, JSON.stringify(data.tasks));
    localStorage.setItem(plans_storage_key, JSON.stringify(data.plans));
    localStorage.setItem(storage_version_key, storage_version);
  } catch {
    // Local persistence is best effort; the current session remains usable.
  }
}

function make_id(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

type WorkspaceContextValue = {
  data: Workspace;
  update_workspace: (next: SetStateAction<Workspace>) => void;
  toggle_theme: () => void;
  reset_workspace: () => void;
  add_task: (task_name: string, task_date?: string) => boolean;
  toggle_task: (task_id: string) => void;
  edit_task: (task_id: string, task_name: string, task_date?: string) => boolean;
  remove_task: (task_id: string) => void;
  add_plan: (plan: PlanDraft, plan_date?: string) => boolean;
  add_plans: (items: PlanDraft[], plan_date?: string) => void;
  edit_plan: (plan_id: string, plan: PlanDraft, plan_date?: string) => boolean;
  toggle_plan: (plan_id: string) => void;
  remove_plan: (plan_id: string) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Workspace>(load_workspace);

  useEffect(() => {
    persist_workspace(data);
    document.documentElement.dataset.theme = data.theme;
  }, [data]);

  const value = useMemo<WorkspaceContextValue>(() => ({
    data,
    update_workspace: (next) => setData((current) => normalize_workspace(typeof next === "function" ? next(current) : next)),
    toggle_theme: () => setData((current) => ({ ...current, theme: current.theme === "light" ? "dark" : "light" })),
    reset_workspace: () => setData(clone_default_workspace()),
    add_task: (task_name, task_date = local_date_key()) => {
      const normalized_name = task_name.trim();
      if (!normalized_name || !valid_date(task_date)) return false;
      const duplicate = data.tasks.some((task) => task.task_date === task_date && task.task_name.toLocaleLowerCase() === normalized_name.toLocaleLowerCase());
      if (duplicate) return false;
      setData((current) => current.tasks.some((task) => task.task_date === task_date && task.task_name.toLocaleLowerCase() === normalized_name.toLocaleLowerCase())
        ? current
        : { ...current, tasks: [...current.tasks, { task_id: make_id("task"), task_name: normalized_name, completed: false, task_date }] });
      return true;
    },
    toggle_task: (task_id) => setData((current) => ({ ...current, tasks: current.tasks.map((task) => task.task_id === task_id ? { ...task, completed: !task.completed } : task) })),
    edit_task: (task_id, task_name, task_date = local_date_key()) => {
      const normalized_name = task_name.trim();
      if (!normalized_name || !valid_date(task_date)) return false;
      const task = data.tasks.find((item) => item.task_id === task_id);
      if (!task || data.tasks.some((item) => item.task_id !== task_id && item.task_date === task_date && item.task_name.toLocaleLowerCase() === normalized_name.toLocaleLowerCase())) return false;
      setData((current) => ({ ...current, tasks: current.tasks.map((task) => task.task_id === task_id ? { ...task, task_name: normalized_name, task_date } : task) }));
      return true;
    },
    remove_task: (task_id) => setData((current) => ({ ...current, tasks: current.tasks.filter((task) => task.task_id !== task_id) })),
    add_plan: (item, plan_date = local_date_key()) => {
      const normalized = normalize_plan_draft(item);
      if (!normalized || !valid_date(plan_date)) return false;
      const duplicate = data.plans.some((plan) => plan_identity(plan, plan.plan_date) === plan_identity(normalized, plan_date));
      if (duplicate) return false;
      setData((current) => current.plans.some((plan) => plan_identity(plan, plan.plan_date) === plan_identity(normalized, plan_date))
        ? current
        : { ...current, plans: [...current.plans, { ...normalized, plan_id: make_id("plan"), plan_date, completed: false }] });
      return true;
    },
    add_plans: (items, plan_date = local_date_key()) => {
      if (!valid_date(plan_date)) return;
      setData((current) => {
        const next = [...current.plans];
        for (const item of items) {
          const normalized = normalize_plan_draft(item);
          if (!normalized || next.some((plan) => plan.plan_date === plan_date && plan.task_name.toLocaleLowerCase() === normalized.task_name.toLocaleLowerCase() && plan.start_time === normalized.start_time)) continue;
          next.push({ ...normalized, plan_id: make_id("plan"), plan_date, completed: false });
        }
        return { ...current, plans: next };
      });
    },
    edit_plan: (plan_id, item, plan_date = local_date_key()) => {
      const normalized = normalize_plan_draft(item);
      if (!normalized || !valid_date(plan_date)) return false;
      const plan = data.plans.find((item) => item.plan_id === plan_id);
      if (!plan || data.plans.some((item) => item.plan_id !== plan_id && plan_identity(item, item.plan_date) === plan_identity(normalized, plan_date))) return false;
      setData((current) => ({ ...current, plans: current.plans.map((plan) => plan.plan_id === plan_id ? { ...normalized, plan_id, plan_date, completed: plan.completed } : plan) }));
      return true;
    },
    toggle_plan: (plan_id) => setData((current) => ({ ...current, plans: current.plans.map((plan) => plan.plan_id === plan_id ? { ...plan, completed: !plan.completed } : plan) })),
    remove_plan: (plan_id) => setData((current) => ({ ...current, plans: current.plans.filter((plan) => plan.plan_id !== plan_id) })),
  }), [data]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return context;
}
