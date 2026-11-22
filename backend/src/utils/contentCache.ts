import { env } from '../config/env';

/**
 * In-memory cache for curriculum content (boards, subjects, chapters, topics, lessons, questions).
 *
 * That content only changes when the seed runs during a deploy, which restarts the server, yet
 * every page reads it. The database is a network round trip away (about 200 ms from the API host),
 * so reading it from memory makes most pages several round trips faster.
 *
 * - Entries expire after CONTENT_CACHE_TTL_MS (10 minutes by default; 0 turns the cache off).
 * - Concurrent misses for the same key share one database query.
 * - Failed queries are not cached.
 * - Callers get a copy, so changing a returned object never changes the cache.
 * - Off in tests by default, because tests change content between cases.
 */
const ttlMs = env.CONTENT_CACHE_TTL_MS ?? (env.isTest ? 0 : 10 * 60_000);
const store = new Map<string, { at: number; value: Promise<unknown> }>();
const MAX_ENTRIES = 2000;

export function cachedContent<A extends unknown[], R>(name: string, load: (...args: A) => Promise<R>, ttl = ttlMs): (...args: A) => Promise<R> {
  return async (...args: A) => {
    if (ttl <= 0) return load(...args);
    const key = `${name}:${JSON.stringify(args)}`;
    const now = Date.now();
    const hit = store.get(key);
    if (hit && now - hit.at < ttl) return structuredClone(await (hit.value as Promise<R>));
    const value = load(...args);
    if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value as string);
    store.set(key, { at: now, value });
    try {
      return structuredClone(await value);
    } catch (e) {
      if (store.get(key)?.value === value) store.delete(key);
      throw e;
    }
  };
}

/** Drops one cached call, e.g. after a student changes their class. */
export function forgetContent(name: string, ...args: unknown[]) {
  store.delete(`${name}:${JSON.stringify(args)}`);
}

/** Short-lived cache for per-student reads that are invalidated on change (off in tests). */
export const STUDENT_TTL_MS = env.isTest ? 0 : 60_000;

/** Empties the cache (after the seed changes content in the same process, and in tests). */
export function clearContentCache() {
  store.clear();
}
