import { api, tokenStore } from '@/services/api';
import { offlineDb } from './offlineDb';

export interface SyncState {
  pending: number;
  syncing: boolean;
  /** Result of the last finished sync that sent something */
  lastResult?: { applied: number; rejected: number; at: number };
  /** True when the last attempt could not reach the server; records stay queued */
  failed: boolean;
}

type Listener = (state: SyncState) => void;
const listeners = new Set<Listener>();
let syncing = false;
let failed = false;
let lastResult: SyncState['lastResult'];
/** User id of the signed-in student. Records are queued under it and only it can sync them. */
let owner: string | null = null;

async function pendingCount() {
  return (await offlineDb.queue(owner)).length;
}

async function emit() {
  const pending = await pendingCount();
  listeners.forEach((l) => l({ pending, syncing, lastResult, failed }));
}

export const syncManager = {
  subscribe(fn: Listener) {
    listeners.add(fn);
    void emit();
    return () => listeners.delete(fn);
  },

  /** Called by the auth layer whenever the signed-in user changes (null on logout). */
  setOwner(userId: string | null) {
    if (owner === userId) return;
    owner = userId;
    failed = false;
    lastResult = undefined;
    void emit();
  },

  pendingCount,

  async queueAnswer(questionId: string, answer: string, timeTakenSec?: number) {
    if (!owner) throw new Error('No signed-in student');
    await offlineDb.enqueue({ kind: 'answer', payload: { questionId, answer, timeTakenSec }, ownerId: owner });
    await this.requestBackgroundSync();
    await emit();
  },

  async queueLessonComplete(topicSlug: string) {
    if (!owner) throw new Error('No signed-in student');
    await offlineDb.enqueue({ kind: 'lesson-complete', payload: { topicSlug }, ownerId: owner });
    await this.requestBackgroundSync();
    await emit();
  },

  async queueDoubt(doubt: { content: string; intent: 'hint' | 'solution' | 'explain' | 'check'; language?: 'HI' | 'EN' | 'TE'; conversationId?: string; subjectSlug?: string; topicSlug?: string }) {
    if (!owner) throw new Error('No signed-in student');
    await offlineDb.enqueue({ kind: 'doubt', payload: { ...doubt }, ownerId: owner });
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

  /**
   * Sends the signed-in student's queued records. Only records owned by that student are sent,
   * so on a shared phone one student's offline answers are never credited to another.
   */
  async flush(): Promise<{ applied: number; rejected: number } | null> {
    if (syncing || !navigator.onLine || !tokenStore.get() || !owner) return null;
    const sendingFor = owner;
    const records = await offlineDb.queue(sendingFor);
    if (records.length === 0) return null;
    syncing = true;
    await emit();
    try {
      let applied = 0;
      let rejected = 0;
      let retry = 0;
      for (let i = 0; i < records.length; i += 100) {
        const batch = records.slice(i, i + 100);
        const res = await api<{ results: Array<{ clientId: string; status: string }>; applied: number; rejected: number }>('/sync', {
          body: { records: batch.map(({ clientId, kind, createdAt, payload }) => ({ clientId, kind, createdAt, payload })) },
        });
        // Applied, duplicate and rejected records are settled. RETRY (server database briefly
        // unavailable) and network failures stay queued for the next attempt.
        await offlineDb.removeFromQueue(res.results.filter((r) => r.status !== 'RETRY').map((r) => r.clientId));
        applied += res.applied;
        rejected += res.rejected;
        retry += res.results.filter((r) => r.status === 'RETRY').length;
      }
      failed = retry > 0;
      lastResult = { applied, rejected, at: Date.now() };
      return lastResult;
    } catch {
      failed = true;
      await offlineDb.bumpAttempts(records.map((r) => r.clientId));
      return null;
    } finally {
      syncing = false;
      await emit();
    }
  },

  init() {
    window.addEventListener('online', () => void this.flush());
    window.addEventListener('offline', () => void emit());
    navigator.serviceWorker?.addEventListener('message', (e) => {
      if (e.data?.type === 'SYNC_NOW') void this.flush();
    });
  },
};
