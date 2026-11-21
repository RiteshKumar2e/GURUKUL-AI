/**
 * Builds a throwaway libSQL database for the test run: a temp file is recreated, migrated with
 * the real migration files and seeded with curriculum content (no demo accounts).
 * Tests therefore never touch the development or production database.
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

/** Same path as vitest.config.mts: a temp file outside the project, deleted after the run. */
export const TEST_DB_FILE = path.join(os.tmpdir(), 'gurukul-ai-test.db');
export const TEST_DB = 'file:' + TEST_DB_FILE.replace(/\\/g, '/');
const files = () => ['', '-journal', '-wal', '-shm'].map((s) => TEST_DB_FILE + s);

export default function setup() {
  const root = path.resolve(__dirname, '..');
  for (const f of files()) fs.rmSync(f, { force: true });
  const env = { ...process.env, NODE_ENV: 'test', TURSO_DATABASE_URL: TEST_DB, TURSO_AUTH_TOKEN: '' };
  const tsx = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  execFileSync(process.execPath, [tsx, 'scripts/migrate.ts'], { cwd: root, env, stdio: 'inherit' });
  execFileSync(process.execPath, [tsx, 'scripts/seed.ts'], { cwd: root, env, stdio: 'inherit' });
  return () => {
    for (const f of files()) fs.rmSync(f, { force: true });
  };
}
