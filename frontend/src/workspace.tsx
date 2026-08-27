import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import workspace from "./mocks/workspace.json";

export type WorkspaceTask = { task_id: string; task_name: string; completed: boolean };
export type Workspace = {
  project_name: string;
  project_description: string;
  tasks: WorkspaceTask[];
  theme: "light" | "dark";
};

const storage_key = "lifeagent_workspace";
const default_workspace: Workspace = { ...workspace, theme: "light" };

function loadWorkspace(): Workspace {
  try {
    const saved = localStorage.getItem(storage_key);
    return saved ? { ...default_workspace, ...JSON.parse(saved) } : default_workspace;
  } catch {
    return default_workspace;
  }
}

type WorkspaceContextValue = {
  data: Workspace;
  updateWorkspace: (next: Workspace) => void;
  toggleTheme: () => void;
  resetWorkspace: () => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Workspace>(loadWorkspace);

  useEffect(() => {
    localStorage.setItem(storage_key, JSON.stringify(data));
    document.documentElement.dataset.theme = data.theme;
  }, [data]);

  const value = useMemo(() => ({
    data,
    updateWorkspace: setData,
    toggleTheme: () => setData((current) => ({ ...current, theme: current.theme === "light" ? "dark" : "light" })),
    resetWorkspace: () => setData(default_workspace),
  }), [data]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return context;
}
