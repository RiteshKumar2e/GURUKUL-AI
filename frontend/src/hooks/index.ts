import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { api } from '@/services/api';
import { syncManager } from '@/lib/sync';
import type { Health } from '@/types/api';

const APP = (import.meta.env.VITE_APP_NAME as string) || 'GURUKUL AI';

export function useDocumentTitle(title: string, description?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP}` : APP;
    if (description) document.querySelector('meta[name="description"]')?.setAttribute('content', description);
  }, [title, description]);
}

export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function useSyncState() {
  const [state, setState] = useState<{ pending: number; syncing: boolean; lastResult?: { applied: number; rejected: number } }>({ pending: 0, syncing: false });
  useEffect(() => {
    const unsub = syncManager.subscribe(setState);
    return () => {
      unsub();
    };
  }, []);
  return state;
}

/** Whether the server has a live AI provider or is in demo mode. */
export function useHealth() {
  return useQuery({ queryKey: ['health'], queryFn: () => api<Health>('/health'), staleTime: 5 * 60_000, retry: 1 });
}

const CONSENT_KEY = 'gk_consent';
export type Consent = 'essential' | 'analytics' | null;

export function readConsent(): Consent {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === 'essential' || v === 'analytics' ? v : null;
  } catch {
    return 'essential';
  }
}

export function writeConsent(v: Exclude<Consent, null>) {
  try {
    localStorage.setItem(CONSENT_KEY, v);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event('gk-consent'));
}

/** Anonymous page-view counting, only after the visitor opts in. No IDs, no third parties. */
export function usePageAnalytics(lang: string) {
  const { pathname } = useLocation();
  useEffect(() => {
    if (readConsent() !== 'analytics' || !navigator.onLine) return;
    // Strip ids from paths: /app/tutor/abc123 -> /app/tutor/:id
    const path = pathname.replace(/\/c[a-z0-9]{20,}/g, '/:id').slice(0, 120) || '/';
    void api('/analytics/pageview', { body: { path, lang } }).catch(() => undefined);
  }, [pathname, lang]);
}
