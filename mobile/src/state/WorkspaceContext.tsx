import * as FileSystem from 'expo-file-system';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { dark_colors, light_colors, ThemeColors } from '../theme';

export type WorkspaceTask = { task_id: string; task_name: string; completed: boolean };
export type Workspace = { project_name: string; project_description: string; tasks: WorkspaceTask[]; theme: 'light' | 'dark' };
const storage_key = 'lifeagent_workspace';
const default_workspace: Workspace = { project_name: '事件提醒', project_description: '创建仪表盘菜单，梳理用户流程', tasks: [
  { task_id: 'task_001', task_name: '完成10道 C++ 题目', completed: true },
  { task_id: 'task_002', task_name: '去操场跑步', completed: false },
  { task_id: 'task_003', task_name: '背50个英语单词', completed: false },
], theme: 'light' };
type ContextValue = { data: Workspace; colors: ThemeColors; ready: boolean; update: (data: Workspace) => void; toggle_theme: () => void; reset: () => void };
const WorkspaceContext = createContext<ContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Workspace>(default_workspace);
  const [ready, setReady] = useState(false);
  const storage_uri = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}${storage_key}.json` : null;
  useEffect(() => { if (!storage_uri) { setReady(true); return; } FileSystem.readAsStringAsync(storage_uri).then((value) => { if (value) { try { setData({ ...default_workspace, ...JSON.parse(value) }); } catch { /* Reset malformed local state. */ } } }).catch(() => undefined).finally(() => setReady(true)); }, [storage_uri]);
  useEffect(() => { if (ready && storage_uri) void FileSystem.writeAsStringAsync(storage_uri, JSON.stringify(data)); }, [data, ready, storage_uri]);
  const value = useMemo(() => ({ data, ready, colors: data.theme === 'dark' ? dark_colors : light_colors, update: setData, toggle_theme: () => setData((current) => ({ ...current, theme: current.theme === 'light' ? 'dark' : 'light' })), reset: () => setData(default_workspace) }), [data, ready]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
export function useWorkspace() { const value = useContext(WorkspaceContext); if (!value) throw new Error('useWorkspace must be used inside WorkspaceProvider'); return value; }
