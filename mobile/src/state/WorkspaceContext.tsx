import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, SetStateAction, useContext, useEffect, useMemo, useState } from 'react';
import workspace from '../mocks/workspace.json';
import { sync_plan_notifications, type NotificationSyncResult } from '../services/notificationService';
import { plan_identity } from '../domain/planning';
import { dark_colors, light_colors, ThemeColors } from '../theme';
import { local_date_key, parse_clock_minutes } from '../utils/date';

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

export type PlanDraft = Omit<DailyPlan, 'plan_id' | 'plan_date' | 'completed'>;

const legacy_storage_key = 'lifeagent_workspace';
const metadata_storage_key = 'lifeagent_workspace_metadata_v2';
const tasks_storage_key = 'lifeagent_workspace_tasks_v2';
const plans_storage_key = 'lifeagent_workspace_plans_v2';
const storage_version_key = 'lifeagent_workspace_storage_version';
const storage_version = '2';
const today_key = local_date_key();

const default_tasks: WorkspaceTask[] = (workspace.tasks as Array<{ task_id: string; task_name: string; completed: boolean }>).map((task) => ({
  task_id: task.task_id,
  task_name: task.task_name.trim(),
  completed: task.completed === true,
  task_date: today_key,
}));

const default_plans: DailyPlan[] = [
  { plan_id: 'plan_demo_001', plan_date: today_key, task_name: '完成 10 道 C++ 题目', start_time: '09:00', duration_minutes: 60, difficulty: 0.7, completed: true },
  { plan_id: 'plan_demo_002', plan_date: today_key, task_name: '背 50 个英语单词', start_time: '14:00', duration_minutes: 30, difficulty: 0.5, completed: false },
  { plan_id: 'plan_demo_003', plan_date: today_key, task_name: '去操场跑步', start_time: '18:30', duration_minutes: 45, difficulty: 0.4, completed: false },
];

export const default_workspace: Workspace = {
  project_name: workspace.project_name,
  project_description: workspace.project_description,
  tasks: default_tasks,
  plans: default_plans,
  theme: 'light',
};

function valid_date(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalize_task(value: unknown): WorkspaceTask | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<WorkspaceTask>;
  const task_name = typeof candidate.task_name === 'string' ? candidate.task_name.trim() : '';
  if (typeof candidate.task_id !== 'string' || !task_name) return null;
  return {
    task_id: candidate.task_id,
    task_name,
    completed: candidate.completed === true,
    task_date: valid_date(candidate.task_date) ? candidate.task_date : today_key,
  };
}

export function normalize_plan_draft(value: unknown): PlanDraft | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<PlanDraft>;
  const task_name = typeof candidate.task_name === 'string' ? candidate.task_name.trim() : '';
  const start_time = typeof candidate.start_time === 'string' ? candidate.start_time.trim() : '';
  const duration_minutes = typeof candidate.duration_minutes === 'number'
    ? Math.trunc(candidate.duration_minutes)
    : Number(candidate.duration_minutes);
  const difficulty = typeof candidate.difficulty === 'number' ? candidate.difficulty : Number(candidate.difficulty);
  if (!task_name || parse_clock_minutes(start_time) === null || !Number.isFinite(duration_minutes) || duration_minutes < 1 || duration_minutes > 1440) return null;
  return {
    task_name,
    start_time,
    duration_minutes,
    difficulty: Number.isFinite(difficulty) ? Math.max(0, Math.min(1, difficulty)) : 0.5,
  };
}

function normalize_plan(value: unknown): DailyPlan | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<DailyPlan>;
  if (typeof candidate.plan_id !== 'string' || !valid_date(candidate.plan_date)) return null;
  const draft = normalize_plan_draft(candidate);
  if (!draft) return null;
  return {
    ...draft,
    plan_id: candidate.plan_id,
    plan_date: candidate.plan_date,
    completed: candidate.completed === true,
  };
}

function normalize_task_list(value: unknown, fallback: WorkspaceTask[]): WorkspaceTask[] {
  return Array.isArray(value)
    ? value.map(normalize_task).filter((task): task is WorkspaceTask => task !== null)
    : fallback.map((task) => ({ ...task }));
}

function normalize_plan_list(value: unknown, fallback: DailyPlan[]): DailyPlan[] {
  return Array.isArray(value)
    ? value.map(normalize_plan).filter((plan): plan is DailyPlan => plan !== null)
    : fallback.map((plan) => ({ ...plan }));
}

function normalize_workspace(value: unknown): Workspace {
  if (!value || typeof value !== 'object') return clone_default_workspace();
  const candidate = value as Partial<Workspace> & { items?: unknown[] };
  const combined_items = Array.isArray(candidate.items) ? candidate.items : [];
  const legacy_tasks = Array.isArray(candidate.tasks)
    ? candidate.tasks
    : combined_items.filter((item) => !(item && typeof item === 'object' && 'start_time' in item));
  const legacy_plans = Array.isArray(candidate.plans)
    ? candidate.plans
    : combined_items.filter((item) => item && typeof item === 'object' && 'start_time' in item);
  return {
    project_name: typeof candidate.project_name === 'string' ? candidate.project_name : default_workspace.project_name,
    project_description: typeof candidate.project_description === 'string' ? candidate.project_description : default_workspace.project_description,
    tasks: normalize_task_list(legacy_tasks, default_tasks),
    plans: normalize_plan_list(legacy_plans, default_plans),
    theme: candidate.theme === 'dark' ? 'dark' : 'light',
  };
}

function clone_default_workspace(): Workspace {
  return {
    project_name: default_workspace.project_name,
    project_description: default_workspace.project_description,
    tasks: default_workspace.tasks.map((task) => ({ ...task })),
    plans: default_workspace.plans.map((plan) => ({ ...plan })),
    theme: default_workspace.theme,
  };
}

function parse_json(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

async function load_workspace_from_storage(): Promise<Workspace> {
  try {
    const entries = await AsyncStorage.multiGet([
      metadata_storage_key,
      tasks_storage_key,
      plans_storage_key,
      legacy_storage_key,
      storage_version_key,
    ]);
    const values = Object.fromEntries(entries);
    const legacy = normalize_workspace(parse_json(values[legacy_storage_key]));
    const metadata = parse_json(values[metadata_storage_key]);
    const metadata_record = metadata && typeof metadata === 'object' ? metadata as Partial<Workspace> : {};
    const metadata_name = typeof metadata_record.project_name === 'string' ? metadata_record.project_name : legacy.project_name;
    const metadata_description = typeof metadata_record.project_description === 'string' ? metadata_record.project_description : legacy.project_description;
    const migrated = {
      project_name: metadata_name,
      project_description: metadata_description,
      theme: metadata_record.theme === 'dark' ? 'dark' : legacy.theme,
      tasks: normalize_task_list(parse_json(values[tasks_storage_key]), values[tasks_storage_key] !== null ? [] : legacy.tasks),
      plans: normalize_plan_list(parse_json(values[plans_storage_key]), values[plans_storage_key] !== null ? [] : legacy.plans),
    } satisfies Workspace;

    if (values[storage_version_key] !== storage_version || !values[tasks_storage_key] || !values[plans_storage_key] || !values[metadata_storage_key]) {
      await AsyncStorage.multiSet([
        [metadata_storage_key, JSON.stringify({ project_name: migrated.project_name, project_description: migrated.project_description, theme: migrated.theme })],
        [tasks_storage_key, JSON.stringify(migrated.tasks)],
        [plans_storage_key, JSON.stringify(migrated.plans)],
        [storage_version_key, storage_version],
      ]);
    }
    return migrated;
  } catch {
    return clone_default_workspace();
  }
}

type ContextValue = {
  data: Workspace;
  colors: ThemeColors;
  ready: boolean;
  notification_state: 'loading' | 'ready' | 'denied';
  update: (data: SetStateAction<Workspace>) => void;
  add_task: (task_name: string, task_date?: string) => boolean;
  toggle_task: (task_id: string) => void;
  edit_task: (task_id: string, task_name: string, task_date?: string) => boolean;
  remove_task: (task_id: string) => void;
  add_plan: (plan: PlanDraft, plan_date?: string) => boolean;
  add_plans: (plans: PlanDraft[], plan_date?: string) => void;
  edit_plan: (plan_id: string, plan: PlanDraft, plan_date?: string) => boolean;
  toggle_plan: (plan_id: string) => void;
  remove_plan: (plan_id: string) => void;
  toggle_theme: () => void;
  reset: () => void;
};

const WorkspaceContext = createContext<ContextValue | null>(null);

function make_id(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Workspace>(clone_default_workspace);
  const [ready, setReady] = useState(false);
  const [notification_state, setNotificationState] = useState<'loading' | 'ready' | 'denied'>('loading');

  useEffect(() => {
    let active = true;
    void load_workspace_from_storage().then((loaded) => {
      if (active) setData(loaded);
    }).finally(() => {
      if (active) setReady(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    void AsyncStorage.multiSet([
      [metadata_storage_key, JSON.stringify({ project_name: data.project_name, project_description: data.project_description, theme: data.theme })],
      [tasks_storage_key, JSON.stringify(data.tasks)],
      [plans_storage_key, JSON.stringify(data.plans)],
      [storage_version_key, storage_version],
    ]).catch(() => undefined);
  }, [data, ready]);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    setNotificationState('loading');
    void sync_plan_notifications(data.plans).then((result: NotificationSyncResult) => {
      if (active) setNotificationState(result.enabled ? 'ready' : 'denied');
    });
    return () => { active = false; };
  }, [data.plans, ready]);

  const value = useMemo<ContextValue>(() => ({
    data,
    ready,
    notification_state,
    colors: data.theme === 'dark' ? dark_colors : light_colors,
    update: (next) => setData((current) => normalize_workspace(typeof next === 'function' ? next(current) : next)),
    add_task: (task_name, task_date = local_date_key()) => {
      const normalized_name = task_name.trim();
      if (!normalized_name || !valid_date(task_date)) return false;
      const duplicate = data.tasks.some((task) => task.task_date === task_date && task.task_name.toLocaleLowerCase() === normalized_name.toLocaleLowerCase());
      if (duplicate) return false;
      setData((current) => {
        if (current.tasks.some((task) => task.task_date === task_date && task.task_name.toLocaleLowerCase() === normalized_name.toLocaleLowerCase())) return current;
        return { ...current, tasks: [...current.tasks, { task_id: make_id('task'), task_name: normalized_name, completed: false, task_date }] };
      });
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
      setData((current) => {
        if (current.plans.some((plan) => plan_identity(plan, plan.plan_date) === plan_identity(normalized, plan_date))) return current;
        return { ...current, plans: [...current.plans, { ...normalized, plan_id: make_id('plan'), plan_date, completed: false }] };
      });
      return true;
    },
    add_plans: (items, plan_date = local_date_key()) => {
      if (!valid_date(plan_date)) return;
      setData((current) => {
        const next = [...current.plans];
        for (const item of items) {
          const normalized = normalize_plan_draft(item);
          if (!normalized || next.some((plan) => plan_identity(plan, plan.plan_date) === plan_identity(normalized, plan_date))) continue;
          next.push({ ...normalized, plan_id: make_id('plan'), plan_date, completed: false });
        }
        return { ...current, plans: next };
      });
    },
    edit_plan: (plan_id, item, plan_date = local_date_key()) => {
      const normalized = normalize_plan_draft(item);
      if (!normalized || !valid_date(plan_date)) return false;
      const plan = data.plans.find((item) => item.plan_id === plan_id);
      if (!plan || data.plans.some((item) => item.plan_id !== plan_id && plan_identity(item, item.plan_date) === plan_identity(normalized, plan_date))) return false;
      setData((current) => ({ ...current, plans: current.plans.map((item) => item.plan_id === plan_id ? { ...normalized, plan_id, plan_date, completed: item.completed } : item) }));
      return true;
    },
    toggle_plan: (plan_id) => setData((current) => ({ ...current, plans: current.plans.map((plan) => plan.plan_id === plan_id ? { ...plan, completed: !plan.completed } : plan) })),
    remove_plan: (plan_id) => setData((current) => ({ ...current, plans: current.plans.filter((plan) => plan.plan_id !== plan_id) })),
    toggle_theme: () => setData((current) => ({ ...current, theme: current.theme === 'light' ? 'dark' : 'light' })),
    reset: () => setData(clone_default_workspace()),
  }), [data, notification_state, ready]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): ContextValue {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return value;
}
