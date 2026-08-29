import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, SetStateAction, useContext, useEffect, useMemo, useState } from 'react';
import workspace from '../mocks/workspace.json';
import { sync_plan_notifications, type NotificationSyncResult } from '../services/notificationService';
import { plan_identity } from '../domain/planning';
import { dark_colors, light_colors, ThemeColors } from '../theme';
import { local_date_key } from '../utils/date';

export type DailyPlan = {
  plan_id: string;
  plan_date: string;
  task_name: string;
  start_time: string;
  duration_minutes: number;
  difficulty: number;
  completed: boolean;
};

export type WorkspaceTask = {
  task_id: string;
  task_name: string;
  completed: boolean;
  task_date: string;
};

export type Workspace = {
  project_name: string;
  project_description: string;
  tasks: WorkspaceTask[];
  plans: DailyPlan[];
  theme: 'light' | 'dark';
};

const storage_key = 'lifeagent_workspace';
const today_key = local_date_key();

const default_tasks: WorkspaceTask[] = (workspace.tasks as Array<{ task_id: string; task_name: string; completed: boolean }>).map((task) => ({
  ...task,
  task_date: today_key,
}));

const default_plans: DailyPlan[] = [
  {
    plan_id: 'plan_demo_001',
    plan_date: today_key,
    task_name: '完成 10 道 C++ 题目',
    start_time: '09:00',
    duration_minutes: 60,
    difficulty: 0.7,
    completed: true,
  },
  {
    plan_id: 'plan_demo_002',
    plan_date: today_key,
    task_name: '背 50 个英语单词',
    start_time: '14:00',
    duration_minutes: 30,
    difficulty: 0.5,
    completed: false,
  },
  {
    plan_id: 'plan_demo_003',
    plan_date: today_key,
    task_name: '去操场跑步',
    start_time: '18:30',
    duration_minutes: 45,
    difficulty: 0.4,
    completed: false,
  },
];

export const default_workspace: Workspace = {
  ...workspace,
  tasks: default_tasks,
  plans: default_plans,
  theme: 'light',
};

function normalize_task(value: unknown): WorkspaceTask | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<WorkspaceTask>;
  if (typeof candidate.task_id !== 'string' || typeof candidate.task_name !== 'string' || typeof candidate.completed !== 'boolean') return null;
  const task_name = candidate.task_name.trim();
  if (!task_name) return null;
  return {
    task_id: candidate.task_id,
    task_name,
    completed: candidate.completed,
    task_date: typeof candidate.task_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(candidate.task_date)
      ? candidate.task_date
      : today_key,
  };
}

function normalize_plan(value: unknown): DailyPlan | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<DailyPlan>;
  if (
    typeof candidate.plan_id !== 'string'
    || typeof candidate.plan_date !== 'string'
    || typeof candidate.task_name !== 'string'
    || typeof candidate.start_time !== 'string'
    || typeof candidate.duration_minutes !== 'number'
  ) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate.plan_date) || !/^\d{2}:\d{2}$/.test(candidate.start_time)) return null;
  return {
    plan_id: candidate.plan_id,
    plan_date: candidate.plan_date,
    task_name: candidate.task_name.trim(),
    start_time: candidate.start_time,
    duration_minutes: Math.max(1, Math.trunc(candidate.duration_minutes)),
    difficulty: typeof candidate.difficulty === 'number' ? Math.max(0, Math.min(1, candidate.difficulty)) : 0.5,
    completed: candidate.completed === true,
  };
}

function normalize_workspace(value: unknown): Workspace {
  if (!value || typeof value !== 'object') return default_workspace;
  const candidate = value as Partial<Workspace>;
  const tasks = Array.isArray(candidate.tasks)
    ? candidate.tasks.map(normalize_task).filter((task): task is WorkspaceTask => task !== null)
    : default_workspace.tasks;
  const plans = Array.isArray(candidate.plans)
    ? candidate.plans.map(normalize_plan).filter((plan): plan is DailyPlan => plan !== null && Boolean(plan.task_name))
    : default_workspace.plans;
  return {
    project_name: typeof candidate.project_name === 'string' ? candidate.project_name : default_workspace.project_name,
    project_description: typeof candidate.project_description === 'string'
      ? candidate.project_description
      : default_workspace.project_description,
    tasks,
    plans,
    theme: candidate.theme === 'dark' ? 'dark' : 'light',
  };
}

type ContextValue = {
  data: Workspace;
  colors: ThemeColors;
  ready: boolean;
  notification_state: 'loading' | 'ready' | 'denied';
  update: (data: SetStateAction<Workspace>) => void;
  add_task: (task_name: string, task_date?: string) => void;
  toggle_task: (task_id: string) => void;
  edit_task: (task_id: string, task_name: string, task_date?: string) => void;
  remove_task: (task_id: string) => void;
  add_plans: (plans: Array<Omit<DailyPlan, 'plan_id' | 'plan_date' | 'completed'>>, plan_date?: string) => void;
  toggle_plan: (plan_id: string) => void;
  remove_plan: (plan_id: string) => void;
  toggle_theme: () => void;
  reset: () => void;
};

const WorkspaceContext = createContext<ContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Workspace>(default_workspace);
  const [ready, setReady] = useState(false);
  const [notification_state, setNotificationState] = useState<'loading' | 'ready' | 'denied'>('loading');

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(storage_key)
      .then((saved) => {
        if (active && saved) {
          try {
            setData(normalize_workspace(JSON.parse(saved)));
          } catch {
            setData(default_workspace);
          }
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    void AsyncStorage.setItem(storage_key, JSON.stringify(data)).catch(() => undefined);
  }, [data, ready]);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    setNotificationState('loading');
    void sync_plan_notifications(data.plans).then((result: NotificationSyncResult) => {
      if (active) setNotificationState(result.enabled ? 'ready' : 'denied');
    });
    return () => {
      active = false;
    };
  }, [data.plans, ready]);

  const value = useMemo<ContextValue>(() => ({
    data,
    ready,
    notification_state,
    colors: data.theme === 'dark' ? dark_colors : light_colors,
    update: setData,
    add_task: (task_name, task_date = local_date_key()) => {
      const normalized_name = task_name.trim();
      if (!normalized_name) return;
      setData((current) => ({
        ...current,
        tasks: current.tasks.some((task) => task.task_date === task_date && task.task_name.trim().toLocaleLowerCase() === normalized_name.toLocaleLowerCase())
          ? current.tasks
          : [...current.tasks, { task_id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, task_name: normalized_name, completed: false, task_date }],
      }));
    },
    toggle_task: (task_id) => setData((current) => ({
      ...current,
      tasks: current.tasks.map((task) => task.task_id === task_id ? { ...task, completed: !task.completed } : task),
    })),
    edit_task: (task_id, task_name, task_date = local_date_key()) => {
      const normalized_name = task_name.trim();
      if (!normalized_name) return;
      setData((current) => ({
        ...current,
        tasks: current.tasks.map((task) => task.task_id === task_id ? { ...task, task_name: normalized_name, task_date } : task),
      }));
    },
    remove_task: (task_id) => setData((current) => ({ ...current, tasks: current.tasks.filter((task) => task.task_id !== task_id) })),
    add_plans: (items, plan_date = local_date_key()) => {
      setData((current) => {
        const next = [...current.plans];
        for (const item of items) {
          const duplicate = next.some((plan) => plan_identity(plan, plan.plan_date) === plan_identity({ ...item }, plan_date));
          if (!duplicate) {
            next.push({ ...item, plan_id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, plan_date, completed: false });
          }
        }
        return { ...current, plans: next };
      });
    },
    toggle_plan: (plan_id) => setData((current) => ({ ...current, plans: current.plans.map((plan) => plan.plan_id === plan_id ? { ...plan, completed: !plan.completed } : plan) })),
    remove_plan: (plan_id) => setData((current) => ({ ...current, plans: current.plans.filter((plan) => plan.plan_id !== plan_id) })),
    toggle_theme: () => setData((current) => ({
      ...current,
      theme: current.theme === 'light' ? 'dark' : 'light',
    })),
    reset: () => setData(default_workspace),
  }), [data, notification_state, ready]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): ContextValue {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return value;
}
