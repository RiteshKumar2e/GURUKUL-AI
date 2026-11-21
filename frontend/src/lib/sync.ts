import { api, tokenStore } from '@/services/api';
import { offlineDb } from './offlineDb';

type Listener = (state: { pending: number; syncing: boolean; lastResult?: { applied: number; rejected: number } }) => void;
const listeners = new Set<Listener>();
let syncing = false;
let lastResult: { applied: number; rejected: number } | undefined;

async function emit() {
  const pending = (await offlineDb.queue()).length;
  listeners.forEach((l) => l({ pending, syncing, lastResult }));
}

export const syncManager = {
  subscribe(fn: Listener) {
    listeners.add(fn);
    void emit();
    return () => listeners.delete(fn);
  },

  async queueAnswer(questionId: string, answer: string, timeTakenSec?: number) {
    await offlineDb.enqueue({ kind: 'answer', payload: { questionId, answer, timeTakenSec } });
    await this.requestBackgroundSync();
    await emit();
  },

  async queueLessonComplete(topicSlug: string) {
    await offlineDb.enqueue({ kind: 'lesson-complete', payload: { topicSlug } });
    await this.requestBackgroundSync();
    await emit();
  },

  /** Uses the Background Sync API where available (Chrome/Android); otherwise we flush on "online". */
  async requestBackgroundSync() {
    try {
      // getRegistration() resolves to undefined when no worker exists; `.ready` would wait forever
      const reg = await navigator.serviceWorker?.getRegistration();
      const sync = (reg as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } })?.sync;
      await sync?.register('gurukul-sync');
    } catch {
      /* not supported: the online listener covers it */
    }
  },

  async flush(): Promise<{ applied: number; rejected: number } | null> {
    if (syncing || !navigator.onLine || !tokenStore.get()) return null;
    const records = await offlineDb.queue();
    if (records.length === 0) return null;
    syncing = true;
    await emit();
    try {
      let applied = 0;
      let rejected = 0;
      for (let i = 0; i < records.length; i += 100) {
        const batch = records.slice(i, i + 100);
        const res = await api<{ results: Array<{ clientId: string; status: string }>; applied: number; rejected: number }>('/sync', {
          body: { records: batch.map(({ clientId, kind, createdAt, payload }) => ({ clientId, kind, createdAt, payload })) },
        });
        // Applied, duplicate and rejected records are all settled; only network failures stay queued.
        await offlineDb.removeFromQueue(res.results.map((r) => r.clientId));
        applied += res.applied;
        rejected += res.rejected;
      }
      lastResult = { applied, rejected };
      return lastResult;
    } catch {
      await offlineDb.bumpAttempts(records.map((r) => r.clientId));
      return null;
    } finally {
      syncing = false;
      await emit();
    }
  },

  init() {
    window.addEventListener('online', () => void this.flush());
    navigator.serviceWorker?.addEventListener('message', (e) => {
      if (e.data?.type === 'SYNC_NOW') void this.flush();
    });
  },
};
