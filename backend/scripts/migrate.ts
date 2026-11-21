/**
 * Applies pending SQL migrations from ./drizzle to the database in TURSO_DATABASE_URL.
 *
 *   npm run db:migrate
 *
 * Safety:
 *  - Only migrations not yet recorded in __drizzle_migrations are applied, in order.
 *  - Before applying, every pending file is scanned; if it contains DROP TABLE, DROP COLUMN,
 *    DELETE FROM or a table rebuild, the script stops unless ALLOW_DESTRUCTIVE_MIGRATION=true.
 *    (Nothing here ever resets the database.)
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { sql } from 'drizzle-orm';
import { db, closeDatabase, checkDatabase } from '../src/db/client';

const folder = path.resolve(__dirname, '../drizzle');
const DESTRUCTIVE = /\b(DROP\s+TABLE|DROP\s+COLUMN|DELETE\s+FROM|ALTER\s+TABLE\s+\S+\s+RENAME\s+TO|__new_)/i;

async function main() {
  const health = await checkDatabase();
  if (!health.ok) throw new Error(`Database not reachable (${health.location}): ${health.error}`);

  const journal = JSON.parse(fs.readFileSync(path.join(folder, 'meta/_journal.json'), 'utf8')) as { entries: Array<{ tag: string; when: number }> };
  let applied = new Set<number>();
  try {
    const rows = await db.all<{ created_at: number }>(sql`select created_at from __drizzle_migrations`);
    applied = new Set(rows.map((r) => Number(r.created_at)));
  } catch {
    /* first run: table does not exist yet */
  }
  const pending = journal.entries.filter((e) => !applied.has(e.when));
  console.log(`[migrate] ${health.location} database, ${journal.entries.length} migration(s) known, ${pending.length} pending`);
  if (!pending.length) return;

  for (const e of pending) {
    const body = fs.readFileSync(path.join(folder, `${e.tag}.sql`), 'utf8');
    if (DESTRUCTIVE.test(body) && process.env.ALLOW_DESTRUCTIVE_MIGRATION !== 'true') {
      throw new Error(
        `Migration ${e.tag} contains a destructive statement. Back up the database first (turso db shell <db> .dump > backup.sql), review the SQL, then re-run with ALLOW_DESTRUCTIVE_MIGRATION=true.`,
      );
    }
    console.log(`[migrate] will apply ${e.tag}`);
  }

  await migrate(db, { migrationsFolder: folder });
  console.log('[migrate] done');
}

main()
  .catch((e) => {
    console.error('[migrate] failed:', (e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => closeDatabase());
