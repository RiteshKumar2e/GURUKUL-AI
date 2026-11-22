import { localiseError } from '@/lib/errorText';
/** The API runs on Render only; there is no local backend. */
const RENDER_API = 'https://gurukul-ai-o0nq.onrender.com/api';
const configured = (import.meta.env.VITE_API_URL as string | undefined)?.trim().replace(/\/$/, '');
// A leftover localhost API URL would point at a backend that no longer exists
const CONFIGURED = configured && !/\/\/(localhost|127\.0\.0\.1)[:/]/.test(configured) ? configured : RENDER_API;

/**
 * The browser calls the API through the page's own /api path wherever a proxy exists:
 *  - localhost (npm run dev / preview): Vite forwards /api to Render (vite.config.ts);
 *  - the production site: Vercel forwards /api to Render (vercel.json).
 * Same-site calls keep the login cookie first-party, so browsers that block third-party cookies
 * (Safari, Brave, Chrome incognito) still keep students signed in after a reload.
 * Anywhere else (e.g. Vercel preview URLs) the Render API is called directly.
 */
function apiBase(): string {
  if (typeof window === 'undefined') return CONFIGURED;
  const { origin, hostname } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return `${origin}/api`;
  try {
    const site = (import.meta.env.VITE_SITE_URL as string | undefined)?.trim();
    if (site && new URL(site).origin === origin) return `${origin}/api`;
  } catch {
    /* malformed VITE_SITE_URL: call the API directly */
  }
  return CONFIGURED;
}

const BASE = apiBase();

export class ApiError extends Error {
  /** The server's original (English) message, for code that inspects it */
  public readonly raw: string;
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Array<{ field: string; message: string }>,
  ) {
    // Shown to students: in Hindi when the interface is in Hindi
    super(localiseError(message, status));
    this.raw = message;
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

/** Form endpoints whose expected mistakes come back as 200 + error (see backend errorHandler). */
const SOFT_ERROR_PATHS = /^\/auth\/(login|register)$/;

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

/** Seconds until the access token expires (from its `exp` claim), or null when unknown. */
function secondsLeft(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp - Date.now() / 1000 : null;
  } catch {
    return null;
  }
}

/**
 * The access token lasts 15 minutes. Renew it shortly before it runs out instead of letting a
 * request fail with 401 first (which the browser logs as an error even though it is handled).
 */
async function ensureFreshToken() {
  if (!accessToken) return;
  const left = secondsLeft(accessToken);
  if (left !== null && left < 30) await refreshSession();
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
  if (retry) await ensureFreshToken();
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
  if (opts.retry !== false && !path.startsWith('/auth/')) await ensureFreshToken();
  const url = new URL(`${BASE}${path}`);
  Object.entries(opts.query ?? {}).forEach(([k, v]) => v !== undefined && url.searchParams.set(k, v));
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  // Wrong password or a taken username is shown in the form; ask the server to answer such
  // mistakes with 200 so the browser does not also log a red network error in the console
  if (SOFT_ERROR_PATHS.test(path)) headers['X-Soft-Errors'] = '1';

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
  const e = (data as { error?: { code?: string; message?: string; details?: unknown; status?: number } } | null)?.error;
  // A "soft" error arrives as 200 with the real status inside; treat it exactly like that status
  const status = !res.ok ? res.status : typeof e?.status === 'number' ? e.status : 0;
  if (status) {
    throw new ApiError(status, e?.code ?? 'ERROR', e?.message ?? 'Something went wrong.', Array.isArray(e?.details) ? (e!.details as ApiError['details']) : undefined);
  }
  return data as T;
}
