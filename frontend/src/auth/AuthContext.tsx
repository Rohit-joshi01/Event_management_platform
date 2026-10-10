import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Role, User } from '@/lib/types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (body: Parameters<typeof api.auth.register>[0]) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (u: User) => void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  const refresh = useCallback(async () => {
    try {
      const s = await api.auth.session();
      setUser(s.authenticated ? s.user : null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      const s = await api.auth.login(email, password);
      qc.clear();
      setUser(s.user);
      return s.user!;
    },
    [qc],
  );

  const register = useCallback(
    async (body: Parameters<typeof api.auth.register>[0]) => {
      const s = await api.auth.register(body);
      qc.clear();
      setUser(s.user);
      return s.user!;
    },
    [qc],
  );

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      qc.clear();
      setUser(null);
    }
  }, [qc]);

  const value = useMemo(() => ({ user, loading, login, register, logout, refresh, setUser }), [user, loading, login, register, logout, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export function homeFor(role: Role) {
  return role === 'ADMIN' ? '/admin' : role === 'ORGANIZER' ? '/organizer' : '/account';
}
