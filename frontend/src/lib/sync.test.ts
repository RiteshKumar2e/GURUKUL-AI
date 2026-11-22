import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QueueRecord } from './offlineDb';

// In-memory stand-ins for IndexedDB and the API, so the queue rules can be tested without a browser.
const store = new Map<string, QueueRecord>();
const apiMock = vi.fn();

vi.mock('./offlineDb', () => ({
  offlineDb: {
    queue: async (owner: string | null) => (owner ? [...store.values()].filter((r) => r.ownerId === owner) : []),
    enqueue: async (rec: Omit<QueueRecord, 'clientId' | 'createdAt' | 'attempts'>) => {
      const r = { ...rec, clientId: `c${store.size + 1}`, createdAt: new Date(Date.now() + store.size).toISOString(), attempts: 0 } as QueueRecord;
      store.set(r.clientId, r);
      return r;
    },
    removeFromQueue: async (ids: string[]) => ids.forEach((id) => store.delete(id)),
    bumpAttempts: async (ids: string[]) => ids.forEach((id) => store.has(id) && (store.get(id)!.attempts += 1)),
  },
}));
vi.mock('@/services/api', () => ({ api: (...a: unknown[]) => apiMock(...a), tokenStore: { get: () => 'token' } }));

const { syncManager } = await import('./sync');

function sentIds() {
  const body = apiMock.mock.calls.at(-1)?.[1]?.body as { records: Array<{ clientId: string }> };
  return body.records.map((r) => r.clientId);
}

describe('offline sync queue', () => {
  beforeEach(() => {
    store.clear();
    apiMock.mockReset();
    vi.stubGlobal('navigator', { onLine: true });
    syncManager.setOwner(null);
  });

  it('refuses to queue without a signed-in student', async () => {
    await expect(syncManager.queueAnswer('q1', '5')).rejects.toThrow();
  });

  it("sends only the signed-in student's records on a shared phone", async () => {
    syncManager.setOwner('student-a');
    await syncManager.queueAnswer('q1', '5');
    syncManager.setOwner('student-b');
    await syncManager.queueAnswer('q2', '7');

    apiMock.mockImplementation(async (_p: string, o: { body: { records: Array<{ clientId: string }> } }) => ({
      results: o.body.records.map((r) => ({ clientId: r.clientId, status: 'APPLIED' })),
      applied: o.body.records.length,
      rejected: 0,
    }));
    await syncManager.flush();
    expect(sentIds()).toEqual(['c2']);
    // Student A's answer is still on the phone, waiting for A to sign in
    expect([...store.keys()]).toEqual(['c1']);
    expect(await syncManager.pendingCount()).toBe(0);
  });

  it('sends deferred tutor doubts again in the same flush until all are answered', async () => {
    syncManager.setOwner('s');
    for (let i = 0; i < 5; i++) await syncManager.queueDoubt({ content: `q${i}`, intent: 'hint' });
    // Server answers two doubts per request and defers the rest
    apiMock.mockImplementation(async (_p: string, o: { body: { records: Array<{ clientId: string }> } }) => {
      const results = o.body.records.map((r, i) => (i < 2 ? { clientId: r.clientId, status: 'APPLIED' } : { clientId: r.clientId, status: 'RETRY', error: 'DEFERRED' }));
      return { results, applied: Math.min(2, o.body.records.length), rejected: 0 };
    });
    const res = await syncManager.flush();
    expect(apiMock).toHaveBeenCalledTimes(3);
    expect(res?.applied).toBe(5);
    expect(store.size).toBe(0);
  });

  it('stops when a round answers nothing and keeps the doubts queued', async () => {
    syncManager.setOwner('s');
    await syncManager.queueDoubt({ content: 'q', intent: 'hint' });
    apiMock.mockImplementation(async (_p: string, o: { body: { records: Array<{ clientId: string }> } }) => ({
      results: o.body.records.map((r) => ({ clientId: r.clientId, status: 'RETRY', error: 'DEFERRED' })),
      applied: 0,
      rejected: 0,
    }));
    await syncManager.flush();
    expect(apiMock).toHaveBeenCalledTimes(1);
    expect(store.size).toBe(1);
  });

  it('keeps RETRY records queued and settles the rest', async () => {
    syncManager.setOwner('s');
    await syncManager.queueAnswer('q1', '1');
    await syncManager.queueAnswer('q2', '2');
    await syncManager.queueAnswer('q3', '3');
    apiMock.mockResolvedValue({
      results: [
        { clientId: 'c1', status: 'APPLIED' },
        { clientId: 'c2', status: 'DUPLICATE' },
        { clientId: 'c3', status: 'RETRY' },
      ],
      applied: 1,
      rejected: 0,
    });
    const states: Array<{ failed: boolean; pending: number }> = [];
    const unsub = syncManager.subscribe((s) => states.push(s));
    await syncManager.flush();
    unsub();
    expect([...store.keys()]).toEqual(['c3']);
    expect(states.at(-1)).toMatchObject({ failed: true, pending: 1 });
  });

  it('keeps every record when the network fails mid-sync', async () => {
    syncManager.setOwner('s');
    await syncManager.queueAnswer('q1', '1');
    await syncManager.queueLessonComplete('topic-a');
    apiMock.mockRejectedValue(new Error('network'));
    expect(await syncManager.flush()).toBeNull();
    expect(store.size).toBe(2);
    expect([...store.values()].every((r) => r.attempts === 1)).toBe(true);
  });

  it('does nothing while offline', async () => {
    syncManager.setOwner('s');
    await syncManager.queueAnswer('q1', '1');
    vi.stubGlobal('navigator', { onLine: false });
    expect(await syncManager.flush()).toBeNull();
    expect(apiMock).not.toHaveBeenCalled();
    expect(store.size).toBe(1);
  });
});
