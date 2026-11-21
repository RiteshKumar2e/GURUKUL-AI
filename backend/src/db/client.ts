/**
 * Central database connection (Turso / libSQL via Drizzle ORM).
 *
 * Credentials come only from backend environment variables (TURSO_DATABASE_URL, TURSO_AUTH_TOKEN)
 * and are never sent to the browser or written to logs.
 */
import fs from 'fs';
import path from 'path';
import { drizzle } from 'drizzle-orm/libsql';
import { sql } from 'drizzle-orm';
import { env } from '../config/env';
import * as schema from './schema';

function ensureLocalDir(url: string) {
  if (!url.startsWith('file:')) return;
  const file = url.slice('file:'.length);
  if (!file || file === ':memory:') return;
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
}

ensureLocalDir(env.TURSO_DATABASE_URL);

// drizzle creates the @libsql/client instance itself (the package's type entry is ESM-only,
// which a CommonJS project cannot import directly; at runtime its CJS build is used).
export const db = drizzle({
  connection: { url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN.trim() || undefined },
  schema,
  casing: 'snake_case',
});
export const libsql = db.$client;
export type DB = typeof db;
/** Either the root db or a transaction handle; repositories accept both. */
export type Executor = Pick<DB, 'select' | 'insert' | 'update' | 'delete' | 'query' | 'run' | 'all' | 'get'>;

/* ----------------------------------------------------------------- errors */

interface DbErrorInfo {
  code?: string;
  message: string;
}

/** Drizzle wraps driver errors; walk the cause chain to the libSQL/SQLite error. */
export function dbErrorInfo(err: unknown): DbErrorInfo | null {
  let cur: unknown = err;
  for (let i = 0; i < 5 && cur; i++) {
    const e = cur as { code?: unknown; message?: unknown; cause?: unknown };
    const code = typeof e.code === 'string' ? e.code : undefined;
    const message = typeof e.message === 'string' ? e.message : '';
    if ((code && code.startsWith('SQLITE')) || /SQLITE_|constraint failed/i.test(message)) return { code, message };
    cur = e.cause;
  }
  return null;
}

/** True when a UNIQUE constraint failed; optionally only for a given "table.column". */
export function isUniqueViolation(err: unknown, column?: string): boolean {
  const info = dbErrorInfo(err);
  if (!info) return false;
  const unique = info.code === 'SQLITE_CONSTRAINT_UNIQUE' || info.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' || /UNIQUE constraint failed/i.test(info.message);
  return unique && (!column || info.message.includes(column));
}

export function isForeignKeyViolation(err: unknown): boolean {
  const info = dbErrorInfo(err);
  return !!info && (info.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || /FOREIGN KEY constraint failed/i.test(info.message));
}

/** Network blips and lock contention are safe to retry for idempotent work. */
export function isTransient(err: unknown): boolean {
  const all: string[] = [];
  let cur: unknown = err;
  for (let i = 0; i < 5 && cur; i++) {
    const e = cur as { code?: unknown; message?: unknown; cause?: unknown };
    all.push(String(e.code ?? ''), String(e.message ?? ''));
    cur = e.cause;
  }
  const text = all.join(' ');
  return /SQLITE_BUSY|database is locked|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|fetch failed|socket hang up|network|502|503|504/i.test(text);
}

/**
 * Retries only transient failures, with short exponential backoff.
 * Use it only for work that is safe to repeat (reads, or writes guarded by a unique key).
 */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 150): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (!isTransient(err) || i === attempts - 1) break;
      await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** i));
    }
  }
  throw last;
}

/* ----------------------------------------------------------------- health */

export interface DbHealth {
  ok: boolean;
  driver: 'libsql';
  location: 'remote' | 'local-file';
  latencyMs?: number;
  migrated?: boolean;
  foreignKeys?: boolean;
  error?: string;
}

/** Cheap connectivity check used by /api/health and at startup. Never includes credentials. */
export async function checkDatabase(): Promise<DbHealth> {
  const base = { driver: 'libsql' as const, location: env.dbIsLocalFile ? ('local-file' as const) : ('remote' as const) };
  const started = Date.now();
  try {
    await withRetry(() => db.run(sql`select 1`), 2);
    const latencyMs = Date.now() - started;
    const migratedRow = await db.get<{ n: number }>(sql`select count(*) as n from sqlite_master where type = 'table' and name = 'users'`);
    const fk = await db.get<{ foreign_keys: number }>(sql`pragma foreign_keys`);
    return { ...base, ok: true, latencyMs, migrated: Number(migratedRow?.n ?? 0) > 0, foreignKeys: Number(fk?.foreign_keys ?? 0) === 1 };
  } catch (err) {
    const info = dbErrorInfo(err);
    // Message only: driver errors can echo the URL, but never the auth token
    return { ...base, ok: false, error: (info?.message || (err as Error).message || 'unreachable').replace(env.TURSO_AUTH_TOKEN || '\u0000', '***').slice(0, 200) };
  }
}

/**
 * Called once at startup. Turns on foreign-key enforcement for this connection (SQLite has it
 * off by default) and verifies the database is reachable and migrated. Does not throw: the API
 * still starts and /api/health reports the problem.
 */
export async function initDatabase(): Promise<DbHealth> {
  try {
    await db.run(sql`pragma foreign_keys = ON`);
  } catch {
    /* reported by checkDatabase below */
  }
  const health = await checkDatabase();
  if (!health.ok) console.error(`[db] cannot reach the database (${health.location}): ${health.error}`);
  else if (!health.migrated) console.error('[db] connected, but tables are missing. Run `npm run db:migrate`.');
  else console.log(`[db] connected (${health.location}, ${health.latencyMs} ms, foreign keys ${health.foreignKeys ? 'on' : 'OFF'})`);
  return health;
}

export function closeDatabase() {
  libsql.close();
}
