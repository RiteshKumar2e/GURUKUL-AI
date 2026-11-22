import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { OfflinePack } from '@/types/api';

export interface QueueRecord {
  clientId: string;
  kind: 'answer' | 'lesson-complete' | 'doubt';
  createdAt: string;
  payload: Record<string, unknown>;
  attempts: number;
  /** User id of the student who created the record. Only that student's session may sync it. */
  ownerId?: string;
}

export interface TtsCacheEntry {
  key: string;
  blob: Blob;
  createdAt: number;
}

/** Most read-aloud clips kept on the device (about 50–150 KB each). */
const TTS_CACHE_LIMIT = 40;

interface GurukulDB extends DBSchema {
  packs: { key: string; value: OfflinePack & { savedAt: string } };
  tts: { key: string; value: TtsCacheEntry; indexes: { byCreated: number } };
  queue: { key: string; value: QueueRecord; indexes: { byCreated: string } };
  kv: { key: string; value: unknown };
}

let dbPromise: Promise<IDBPDatabase<GurukulDB>> | null = null;

function db() {
  if (!dbPromise) {
    dbPromise = openDB<GurukulDB>('gurukul-ai', 3, {
      upgrade(d, oldVersion, _newVersion, tx) {
        if (oldVersion < 1) {
          d.createObjectStore('packs');
          const q = d.createObjectStore('queue', { keyPath: 'clientId' });
          q.createIndex('byCreated', 'createdAt');
          d.createObjectStore('kv');
        }
        if (oldVersion < 2) {
          const t = d.createObjectStore('tts', { keyPath: 'key' });
          t.createIndex('byCreated', 'createdAt');
        }
        if (oldVersion >= 1 && oldVersion < 3) {
          // Records queued before v3 have no owner. They can only belong to the last signed-in
          // student (logout clears the queue), whose profile is still in kv.cachedUser.
          void (async () => {
            const cached = (await tx.objectStore('kv').get('cachedUser')) as { id?: string } | undefined;
            let cur = await tx.objectStore('queue').openCursor();
            while (cur) {
              if (!cur.value.ownerId) {
                if (cached?.id) await cur.update({ ...cur.value, ownerId: cached.id });
                else await cur.delete();
              }
              cur = await cur.continue();
            }
          })();
        }
      },
    });
  }
  return dbPromise;
}

export const offlineDb = {
  async savePack(pack: OfflinePack) {
    await (await db()).put('packs', { ...pack, savedAt: new Date().toISOString() }, pack.chapter.slug);
  },
  async getPack(slug: string) {
    return (await db()).get('packs', slug);
  },
  async listPacks() {
    return (await db()).getAll('packs');
  },
  async deletePack(slug: string) {
    await (await db()).delete('packs', slug);
  },

  async enqueue(rec: Omit<QueueRecord, 'clientId' | 'createdAt' | 'attempts' | 'ownerId'> & { ownerId: string }) {
    const clientId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    const record: QueueRecord = { ...rec, clientId, createdAt: new Date().toISOString(), attempts: 0 };
    await (await db()).put('queue', record);
    return record;
  },
  /** Queued records in creation order, only those owned by `ownerId`. */
  async queue(ownerId: string | null) {
    if (!ownerId) return [];
    return (await (await db()).getAllFromIndex('queue', 'byCreated')).filter((r) => r.ownerId === ownerId);
  },
  async removeFromQueue(ids: string[]) {
    const tx = (await db()).transaction('queue', 'readwrite');
    await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
  },
  async bumpAttempts(ids: string[]) {
    const d = await db();
    for (const id of ids) {
      const r = await d.get('queue', id);
      if (r) await d.put('queue', { ...r, attempts: r.attempts + 1 });
    }
  },

  /** Read-aloud audio cache: replaying a reply costs no data. */
  async getTts(key: string) {
    return (await db()).get('tts', key);
  },
  async putTts(key: string, blob: Blob) {
    const d = await db();
    await d.put('tts', { key, blob, createdAt: Date.now() });
    const keys = await d.getAllKeysFromIndex('tts', 'byCreated');
    if (keys.length > TTS_CACHE_LIMIT) {
      const tx = d.transaction('tts', 'readwrite');
      await Promise.all([...keys.slice(0, keys.length - TTS_CACHE_LIMIT).map((k) => tx.store.delete(k)), tx.done]);
    }
  },
  async clearTts() {
    await (await db()).clear('tts');
  },

  async getKv<T>(key: string): Promise<T | undefined> {
    return (await db()).get('kv', key) as Promise<T | undefined>;
  },
  async setKv(key: string, value: unknown) {
    await (await db()).put('kv', value, key);
  },
  /**
   * Called on sign-out so a shared phone does not keep the previous student's data: their queue,
   * cached profile and read-aloud audio. Other students' unsynced records stay, still scoped to them.
   */
  async clearPersonal(ownerId: string | null) {
    const d = await db();
    const mine = (await d.getAll('queue')).filter((r) => !r.ownerId || r.ownerId === ownerId).map((r) => r.clientId);
    const tx = d.transaction('queue', 'readwrite');
    await Promise.all([...mine.map((id) => tx.store.delete(id)), tx.done]);
    await d.clear('kv');
    await d.clear('tts');
  },
};
