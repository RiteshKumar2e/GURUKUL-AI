import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

// Used only by `npm run db:generate` (creates SQL migration files from src/db/schema.ts).
// Applying migrations is done by scripts/migrate.ts, which never drops or resets anything.
export default defineConfig({
  dialect: 'turso',
  schema: './src/db/schema.ts',
  out: './drizzle',
  casing: 'snake_case',
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL ?? '',
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  },
  strict: true,
  verbose: true,
});
