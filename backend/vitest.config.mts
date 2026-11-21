import os from 'os';
import path from 'path';
import { defineConfig } from 'vitest/config';

const TEST_DB = 'file:' + path.join(os.tmpdir(), 'gurukul-ai-test.db').replace(/\\/g, '/');

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/globalSetup.ts'],
    // Throwaway libSQL file in the OS temp folder; dotenv does not override these, so the Turso
    // database in .env is never touched by tests
    env: { NODE_ENV: 'test', TURSO_DATABASE_URL: TEST_DB, TURSO_AUTH_TOKEN: '' },
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
});
