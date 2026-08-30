import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

const auth_storage_key = "lifeagent_web_auth_v1";
const demo_user_id = 10001;

type StoredAuth = { user_id: number; display_name: string };
type AuthContextValue = {
  ready: boolean;
  authenticated: boolean;
  user_id: number;
  display_name: string;
  login: (display_name: string, password: string) => Promise<string | null>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function normalize_auth(value: unknown): StoredAuth | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<StoredAuth>;
  const display_name = typeof candidate.display_name === "string" ? candidate.display_name.trim() : "";
  return display_name.length >= 2 ? { user_id: demo_user_id, display_name: display_name.slice(0, 24) } : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(auth_storage_key);
      if (saved) setAuth(normalize_auth(JSON.parse(saved)));
    } catch {
      setAuth(null);
    } finally {
      setReady(true);
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    ready,
    authenticated: auth !== null,
    user_id: auth?.user_id ?? demo_user_id,
    display_name: auth?.display_name ?? "",
    login: async (display_name, password) => {
      const normalized_name = display_name.trim();
      if (normalized_name.length < 2) return "用户名至少需要 2 个字符。";
      if (password.length < 4) return "密码至少需要 4 个字符。";
      const next = { user_id: demo_user_id, display_name: normalized_name.slice(0, 24) };
      setAuth(next);
      try {
        localStorage.setItem(auth_storage_key, JSON.stringify(next));
      } catch {
        return "登录状态保存失败，请重试。";
      }
      return null;
    },
    logout: () => {
      setAuth(null);
      try { localStorage.removeItem(auth_storage_key); } catch { /* best effort */ }
    },
  }), [auth, ready]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
