import { env } from './config/env';
import { closeDatabase, initDatabase } from './db/client';
import { createApp } from './app';
import { aiStatus } from './services/ai';

const app = createApp();

void initDatabase();

const server = app.listen(env.PORT, () => {
  const ai = aiStatus();
  console.log(`GURUKUL AI API listening on http://localhost:${env.PORT}/api`);
  console.log(`AI: ${ai.mode === 'live' ? `${ai.provider} (${ai.model})` : 'DEMO MODE — set AI_API_KEY to enable the AI tutor'}`);
});

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    closeDatabase();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
