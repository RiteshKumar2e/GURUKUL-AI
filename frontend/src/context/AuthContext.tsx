import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, refreshSessionDetailed, takeRefreshedUser, tokenStore } from '@/services/api';
import { offlineDb } from '@/lib/offlineDb';
import { syncManager } from '@/lib/sync';
import type { User } from '@/types/api';
import { useLang } from './LanguageContext';

type Status = 'loading' | 'authenticated' | 'offline' | 'anonymous';

interface AuthCtx {
  user: User | null;
  status: Status;
  /** true when we are showing a cached profile because the network is down */
  offlineSession: boolean;
  login: (username: string, password: string) => Promise<User>;
  register: (data: Record<string, unknown>) => Promise<User>;
  /**
   * Signs out and clears this student's data from the device. Unsynced offline work is sent first;
   * if some cannot be sent, the user is asked before it is discarded. Resolves false if they cancel.
   */
  logout: (opts?: { force?: boolean }) => Promise<boolean>;
  setUser: (u: User) => void;
  refreshUser: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);
const CACHED_USER = 'cachedUser';
// Non-sensitive hint so anonymous visitors do not trigger a refresh request on every page load
const SESSION_HINT = 'gk_has_session';
const hint = {
  get: () => {
    try {
      return localStorage.getItem(SESSION_HINT) === '1';
    } catch {
      return true;
    }
  },
  set: (on: boolean) => {
    try {
      if (on) localStorage.setItem(SESSION_HINT, '1');
      else localStorage.removeItem(SESSION_HINT);
    } catch {
      /* ignore */
    }
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const qc = useQueryClient();
  const { setLang, tx } = useLang();

  const setUser = useCallback(
    (u: User) => {
      setUserState(u);
      void offlineDb.setKv(CACHED_USER, u);
    },
    [],
  );

  const applySession = useCallback(
    (u: User, token: string, adoptLanguage = true) => {
      tokenStore.set(token);
      hint.set(true);
      syncManager.setOwner(u.id);
      setUser(u);
      setStatus('authenticated');
      if (adoptLanguage) setLang((cur) => (u.preferredLanguage === 'EN' ? 'en' : cur === 'hg' ? 'hg' : 'hi'));
      void syncManager.flush();
    },
    [setLang, setUser],
  );

  // Restore the session from the refresh cookie on load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!hint.get()) {
        setStatus('anonymous');
        return;
      }
      const result = await refreshSessionDetailed();
      if (cancelled) return;
      if (result === 'ok') {
        const u = takeRefreshedUser() as User;
        applySession(u, tokenStore.get()!, false);
        return;
      }
      if (result === 'offline') {
        const cached = await offlineDb.getKv<User>(CACHED_USER);
        if (cached) {
          syncManager.setOwner(cached.id);
          setUserState(cached);
          setStatus('offline');
          return;
        }
      }
      hint.set(false);
      setStatus('anonymous');
    })();
    return () => {
      cancelled = true;
    };
  }, [applySession]);

  // When connectivity returns during an offline session, try to restore the real session
  useEffect(() => {
    if (status !== 'offline') return;
    const onOnline = async () => {
      const r = await refreshSessionDetailed();
      if (r === 'ok') applySession(takeRefreshedUser() as User, tokenStore.get()!, false);
      else if (r === 'invalid') setStatus('anonymous');
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [status, applySession]);

  useEffect(() => {
    tokenStore.onExpired(() => {
      setUserState(null);
      setStatus('anonymous');
    });
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      const res = await api<{ user: User; accessToken: string }>('/auth/login', { body: { username, password } });
      applySession(res.user, res.accessToken);
      return res.user;
    },
    [applySession],
  );

  const register = useCallback(
    async (data: Record<string, unknown>) => {
      const res = await api<{ user: User; accessToken: string }>('/auth/register', { body: data });
      applySession(res.user, res.accessToken);
      return res.user;
    },
    [applySession],
  );

  const logout = useCallback(async (opts?: { force?: boolean }) => {
    if (navigator.onLine) await syncManager.flush().catch(() => null);
    if (!opts?.force) {
      const left = await syncManager.pendingCount();
      if (
        left > 0 &&
        !window.confirm(
          tx(
            `${left} ऑफ़लाइन उत्तर अभी सर्वर पर नहीं पहुँचे हैं। लॉग आउट करने पर वे इस फ़ोन से मिट जाएँगे। फिर भी लॉग आउट करें?`,
            `${left} offline answer(s) have not reached the server yet. Logging out will remove them from this phone. Log out anyway?`,
          ),
        )
      ) {
        return false;
      }
    }
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      /* still clear locally */
    }
    tokenStore.set(null);
    hint.set(false);
    await offlineDb.clearPersonal(user?.id ?? null);
    syncManager.setOwner(null);
    qc.clear();
    setUserState(null);
    setStatus('anonymous');
    return true;
  }, [qc, tx, user]);

  const refreshUser = useCallback(async () => {
    const res = await api<{ user: User }>('/users/me');
    setUser(res.user);
  }, [setUser]);

  const value = useMemo(
    () => ({ user, status, offlineSession: status === 'offline', login, register, logout, setUser, refreshUser }),
    [user, status, login, register, logout, setUser, refreshUser],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export function homePathFor(user: User | null) {
  if (!user) return '/login';
  if (user.role === 'PARENT' || user.role === 'TEACHER') return '/guardian';
  if (user.student && !user.student.onboardingDone) return '/onboarding';
  return '/app';
}
