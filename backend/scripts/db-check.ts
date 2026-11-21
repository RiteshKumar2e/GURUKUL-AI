/**
 * Read-only connection check for the database in TURSO_DATABASE_URL.
 *   npm run db:check
 * Prints reachability, latency, whether tables exist and the applied migrations. Writes nothing.
 */
import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { checkDatabase, closeDatabase, db } from '../src/db/client';

async function main() {
  const h = await checkDatabase();
  console.log(`[db:check] ${h.location} database: ${h.ok ? 'reachable' : 'NOT reachable'}${h.latencyMs !== undefined ? ` (${h.latencyMs} ms)` : ''}`);
  if (!h.ok) {
    console.log(`[db:check] error: ${h.error}`);
    process.exitCode = 1;
    return;
  }
  const tables = await db.all<{ name: string }>(sql`select name from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name`);
  console.log(`[db:check] tables (${tables.length}): ${tables.map((t) => t.name).join(', ') || 'none'}`);
  try {
    const m = await db.all<{ hash: string; created_at: number }>(sql`select hash, created_at from __drizzle_migrations order by created_at`);
    console.log(`[db:check] applied migrations: ${m.length}`);
  } catch {
    console.log('[db:check] applied migrations: none (run npm run db:migrate)');
  }
  if (h.migrated) {
    const counts = await db.all<{ t: string; n: number }>(sql`
      select 'users' t, count(*) n from users union all
      select 'chapters', count(*) from chapters union all
      select 'questions', count(*) from questions`);
    console.log(`[db:check] rows: ${counts.map((c) => `${c.t}=${c.n}`).join(', ')}`);
  }
  console.log(`[db:check] foreign keys pragma on this connection: ${h.foreignKeys ? 'on' : 'off'}`);
}

main()
  .catch((e) => {
    console.error('[db:check] failed:', (e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => closeDatabase());
