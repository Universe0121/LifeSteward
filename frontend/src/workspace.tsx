import { createContext, ReactNode, SetStateAction, useContext, useEffect, useMemo, useState } from "react";
import workspace from "./mocks/workspace.json";

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

export type Workspace = {
  project_name: string;
  project_description: string;
  tasks: WorkspaceTask[];
  plans: DailyPlan[];
  theme: "light" | "dark";
};

const storage_key = "lifeagent_workspace_10001";

function local_date_key(value = new Date()): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function add_days(value: string, amount: number): string {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return local_date_key(date);
}

const today_key = local_date_key();
const default_workspace: Workspace = {
  project_name: workspace.project_name,
  project_description: workspace.project_description,
  tasks: workspace.tasks.map((task) => ({ ...task, task_date: today_key })),
  plans: [
    { plan_id: "plan_demo_001", plan_date: today_key, task_name: "完成 10 道 C++ 题目", start_time: "09:00", duration_minutes: 60, difficulty: 0.7, completed: true },
    { plan_id: "plan_demo_002", plan_date: today_key, task_name: "背 50 个英语单词", start_time: "14:00", duration_minutes: 30, difficulty: 0.5, completed: false },
    { plan_id: "plan_demo_003", plan_date: today_key, task_name: "去操场跑步", start_time: "18:30", duration_minutes: 45, difficulty: 0.4, completed: false },
  ],
  theme: "light",
};

function normalize_workspace(value: unknown): Workspace {
  if (!value || typeof value !== "object") return default_workspace;
  const candidate = value as Partial<Workspace>;
  const tasks = Array.isArray(candidate.tasks)
    ? candidate.tasks.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const task = item as Partial<WorkspaceTask>;
      const task_name = typeof task.task_name === "string" ? task.task_name.trim() : "";
      if (!task_name || typeof task.task_id !== "string") return [];
      return [{
        task_id: task.task_id,
        task_name,
        completed: task.completed === true,
        task_date: typeof task.task_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(task.task_date) ? task.task_date : today_key,
      }];
    })
    : default_workspace.tasks;
  const plans = Array.isArray(candidate.plans)
    ? candidate.plans.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const plan = item as Partial<DailyPlan>;
      if (typeof plan.plan_id !== "string" || typeof plan.plan_date !== "string" || typeof plan.task_name !== "string" || typeof plan.start_time !== "string") return [];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(plan.plan_date) || !/^\d{2}:\d{2}$/.test(plan.start_time)) return [];
      const duration_minutes = Number(plan.duration_minutes);
      if (!Number.isFinite(duration_minutes) || duration_minutes <= 0) return [];
      return [{
        plan_id: plan.plan_id,
        plan_date: plan.plan_date,
        task_name: plan.task_name.trim(),
        start_time: plan.start_time,
        duration_minutes: Math.trunc(duration_minutes),
        difficulty: typeof plan.difficulty === "number" ? Math.max(0, Math.min(1, plan.difficulty)) : 0.5,
        completed: plan.completed === true,
      }];
    })
    : default_workspace.plans;
  return {
    project_name: typeof candidate.project_name === "string" ? candidate.project_name : default_workspace.project_name,
    project_description: typeof candidate.project_description === "string" ? candidate.project_description : default_workspace.project_description,
    tasks,
    plans,
    theme: candidate.theme === "dark" ? "dark" : "light",
  };
}

function load_workspace(): Workspace {
  try {
    const saved = localStorage.getItem(storage_key);
    return saved ? normalize_workspace(JSON.parse(saved)) : default_workspace;
  } catch {
    return default_workspace;
  }
}

type WorkspaceContextValue = {
  data: Workspace;
  update_workspace: (next: SetStateAction<Workspace>) => void;
  toggle_theme: () => void;
  reset_workspace: () => void;
  add_task: (task_name: string, task_date?: string) => void;
  toggle_task: (task_id: string) => void;
  edit_task: (task_id: string, task_name: string, task_date?: string) => void;
  remove_task: (task_id: string) => void;
  add_plans: (items: Array<Omit<DailyPlan, "plan_id" | "plan_date" | "completed">>, plan_date?: string) => void;
  toggle_plan: (plan_id: string) => void;
  remove_plan: (plan_id: string) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Workspace>(load_workspace);

  useEffect(() => {
    try {
      localStorage.setItem(storage_key, JSON.stringify(data));
      document.documentElement.dataset.theme = data.theme;
    } catch {
      // Local persistence is best effort; the current session remains usable.
    }
  }, [data]);

  const value = useMemo<WorkspaceContextValue>(() => ({
    data,
    update_workspace: setData,
    toggle_theme: () => setData((current) => ({ ...current, theme: current.theme === "light" ? "dark" : "light" })),
    reset_workspace: () => setData(default_workspace),
    add_task: (task_name, task_date = local_date_key()) => {
      const normalized_name = task_name.trim();
      if (!normalized_name) return;
      setData((current) => current.tasks.some((task) => task.task_date === task_date && task.task_name.toLocaleLowerCase() === normalized_name.toLocaleLowerCase())
        ? current
        : {
          ...current,
          tasks: [...current.tasks, { task_id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, task_name: normalized_name, completed: false, task_date }],
        });
    },
    toggle_task: (task_id) => setData((current) => ({ ...current, tasks: current.tasks.map((task) => task.task_id === task_id ? { ...task, completed: !task.completed } : task) })),
    edit_task: (task_id, task_name, task_date = local_date_key()) => {
      const normalized_name = task_name.trim();
      if (!normalized_name) return;
      setData((current) => ({ ...current, tasks: current.tasks.map((task) => task.task_id === task_id ? { ...task, task_name: normalized_name, task_date } : task) }));
    },
    remove_task: (task_id) => setData((current) => ({ ...current, tasks: current.tasks.filter((task) => task.task_id !== task_id) })),
    add_plans: (items, plan_date = local_date_key()) => setData((current) => {
      const next = [...current.plans];
      for (const item of items) {
        const duplicate = next.some((plan) => plan.plan_date === plan_date && plan.task_name.toLocaleLowerCase() === item.task_name.toLocaleLowerCase() && plan.start_time === item.start_time);
        if (!duplicate) next.push({ ...item, plan_id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, plan_date, completed: false });
      }
      return { ...current, plans: next };
    }),
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

export { add_days, local_date_key };
