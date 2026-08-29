import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

const auth_storage_key = 'lifeagent_auth_v1';
const demo_user_id = 10001;

type StoredAuth = { user_id: number; display_name: string };

type AuthContextValue = {
  ready: boolean;
  authenticated: boolean;
  user_id: number;
  display_name: string;
  login: (display_name: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function normalize_auth(value: unknown): StoredAuth | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<StoredAuth>;
  if (typeof candidate.display_name !== 'string' || candidate.display_name.trim().length < 2) return null;
  return { user_id: demo_user_id, display_name: candidate.display_name.trim().slice(0, 24) };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(auth_storage_key)
      .then((value) => {
        if (!active || !value) return;
        try {
          setAuth(normalize_auth(JSON.parse(value)));
        } catch {
          setAuth(null);
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

  const value = useMemo<AuthContextValue>(() => ({
    ready,
    authenticated: auth !== null,
    user_id: auth?.user_id ?? demo_user_id,
    display_name: auth?.display_name ?? '',
    login: async (display_name, password) => {
      const name = display_name.trim();
      if (name.length < 2) return '用户名至少需要 2 个字符。';
      if (password.length < 4) return '密码至少需要 4 个字符。';
      const next = { user_id: demo_user_id, display_name: name.slice(0, 24) };
      setAuth(next);
      try {
        // The demo keeps only the session name locally; the password is never persisted.
        await AsyncStorage.setItem(auth_storage_key, JSON.stringify(next));
      } catch {
        return '本地登录状态保存失败，请重试。';
      }
      return null;
    },
    logout: async () => {
      setAuth(null);
      try {
        await AsyncStorage.removeItem(auth_storage_key);
      } catch {
        // A cleared in-memory session still protects the current screen.
      }
    },
  }), [auth, ready]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
