const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:5000/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Array<{ field: string; message: string }>,
  ) {
    super(message);
  }
  get isNetwork() {
    return this.status === 0;
  }
}

let accessToken: string | null = null;
let onSessionExpired: (() => void) | null = null;

export const tokenStore = {
  get: () => accessToken,
  set: (t: string | null) => {
    accessToken = t;
  },
  onExpired: (fn: () => void) => {
    onSessionExpired = fn;
  },
};

async function parse(res: Response) {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { error: { message: text } };
  }
}

export type RefreshResult = 'ok' | 'invalid' | 'offline';
let refreshingResult: Promise<RefreshResult> | null = null;

/** Single-flight refresh: concurrent 401s wait for one refresh call. */
export function refreshSessionDetailed(): Promise<RefreshResult> {
  if (!refreshingResult) {
    refreshingResult = fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then(async (res): Promise<RefreshResult> => {
        if (!res.ok) return 'invalid';
        const body = await res.json();
        accessToken = body.accessToken;
        lastRefreshUser = body.user;
        return 'ok';
      })
      .catch((): RefreshResult => 'offline')
      .finally(() => {
        refreshingResult = null;
      });
  }
  return refreshingResult;
}

let lastRefreshUser: unknown = null;
export const takeRefreshedUser = () => lastRefreshUser;

export async function refreshSession(): Promise<boolean> {
  return (await refreshSessionDetailed()) === 'ok';
}

interface Options {
  method?: string;
  body?: unknown;
  form?: FormData;
  query?: Record<string, string | undefined>;
  retry?: boolean;
  signal?: AbortSignal;
}

/** POST JSON and receive binary (e.g. audio). Same auth/refresh behaviour as api(). */
export async function apiBlob(path: string, body: unknown, retry = true): Promise<Blob> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
      credentials: 'include',
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', navigator.onLine ? 'Could not reach the server.' : 'You are offline.');
  }
  if (res.status === 401 && retry && (await refreshSession())) return apiBlob(path, body, false);
  if (!res.ok) {
    const data = (await parse(res)) as { error?: { code?: string; message?: string } } | null;
    throw new ApiError(res.status, data?.error?.code ?? 'ERROR', data?.error?.message ?? 'Something went wrong.');
  }
  return res.blob();
}

export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  Object.entries(opts.query ?? {}).forEach(([k, v]) => v !== undefined && url.searchParams.set(k, v));
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? (opts.body !== undefined || opts.form ? 'POST' : 'GET'),
      headers,
      credentials: 'include',
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
      signal: opts.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK', navigator.onLine ? 'Could not reach the server.' : 'You are offline.');
  }

  if (res.status === 401 && opts.retry !== false && !path.startsWith('/auth/')) {
    if (await refreshSession()) return api<T>(path, { ...opts, retry: false });
    accessToken = null;
    onSessionExpired?.();
  }

  const data = await parse(res);
  if (!res.ok) {
    const e = (data as { error?: { code?: string; message?: string; details?: unknown } })?.error;
    throw new ApiError(res.status, e?.code ?? 'ERROR', e?.message ?? 'Something went wrong.', Array.isArray(e?.details) ? (e!.details as ApiError['details']) : undefined);
  }
  return data as T;
}
