import { and, eq } from 'drizzle-orm';
import { db, isTransient, withRetry } from '../../db/client';
import { syncRecords } from '../../db/schema';
import { curriculumRepository } from '../../repositories/curriculumRepository';
import { adaptiveService } from '../adaptive-learning/adaptiveService';

export type SyncInput =
  | { clientId: string; kind: 'answer'; createdAt: string; payload: { questionId: string; answer: string; timeTakenSec?: number } }
  | { clientId: string; kind: 'lesson-complete'; createdAt: string; payload: { topicSlug: string } };

type SyncResult = { clientId: string; status: 'APPLIED' | 'DUPLICATE' | 'REJECTED' | 'RETRY'; error?: string; isCorrect?: boolean };

/**
 * Applies records queued on the device while offline.
 *
 * Exactly-once per (student, clientId):
 *  1. "Claim" the record by inserting a PENDING sync row. The unique index on
 *     (student_id, client_id) makes a second, concurrent submission of the same record a no-op,
 *     so it is reported as DUPLICATE and never applied twice.
 *  2. Apply it (answers are re-graded on the server; the device's grading is never trusted).
 *  3. Mark the row APPLIED or REJECTED.
 * If step 2 fails because the database was briefly unreachable, the claim is released and the
 * record is returned as RETRY, so the device keeps it queued instead of losing it.
 */
export const syncService = {
  async apply(studentId: string, records: SyncInput[]) {
    const results: SyncResult[] = [];
    let changed = false;

    const sorted = [...records].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const rec of sorted) {
      const createdAt = new Date(rec.createdAt);
      const when = Number.isNaN(createdAt.getTime()) || createdAt > new Date() ? new Date() : createdAt;

      let claimed: { id: string } | undefined;
      try {
        // Safe to retry: the unique key makes the insert idempotent
        [claimed] = await withRetry(() =>
          db
            .insert(syncRecords)
            .values({ studentId, clientId: rec.clientId, kind: rec.kind, payload: rec.payload, status: 'PENDING', clientCreatedAt: when })
            .onConflictDoNothing({ target: [syncRecords.studentId, syncRecords.clientId] })
            .returning({ id: syncRecords.id }),
        );
      } catch (e) {
        results.push({ clientId: rec.clientId, status: 'RETRY', error: 'Database unavailable' });
        if (isTransient(e)) continue;
        throw e;
      }
      if (!claimed) {
        results.push({ clientId: rec.clientId, status: 'DUPLICATE' });
        continue;
      }

      try {
        // Look-ups happen before the transaction; the writes (answer, progress, APPLIED mark) are
        // one transaction, so a failure part-way can never leave an answer stored without its
        // record settled, which a retry would then store a second time.
        let isCorrect: boolean | undefined;
        const claimId = claimed.id;
        if (rec.kind === 'answer') {
          const q = await curriculumRepository.questionById(rec.payload.questionId);
          if (!q) throw new RejectError('Unknown question');
          const payload = rec.payload;
          await db.transaction(async (tx) => {
            const r = await adaptiveService.recordAnswer({ studentId, question: q, answer: payload.answer, timeTakenSec: payload.timeTakenSec, origin: 'OFFLINE_SYNC', answeredAt: when, ex: tx });
            isCorrect = r.isCorrect;
            await tx.update(syncRecords).set({ status: 'APPLIED', processedAt: new Date() }).where(eq(syncRecords.id, claimId));
          });
        } else if (rec.kind === 'lesson-complete') {
          const t = await curriculumRepository.topicBySlug(rec.payload.topicSlug);
          if (!t) throw new RejectError('Unknown topic');
          await db.transaction(async (tx) => {
            await adaptiveService.markLessonComplete(studentId, t.id, when, tx);
            await tx.update(syncRecords).set({ status: 'APPLIED', processedAt: new Date() }).where(eq(syncRecords.id, claimId));
          });
        } else {
          throw new RejectError('Unknown record kind');
        }
        changed = true;
        results.push({ clientId: rec.clientId, status: 'APPLIED', isCorrect });
      } catch (e) {
        if (!(e instanceof RejectError) && isTransient(e)) {
          // Release the claim so the device can send it again later
          await db
            .delete(syncRecords)
            .where(and(eq(syncRecords.id, claimed.id), eq(syncRecords.status, 'PENDING')))
            .catch(() => undefined);
          results.push({ clientId: rec.clientId, status: 'RETRY', error: 'Database unavailable' });
          continue;
        }
        const error = (e as Error).message.slice(0, 200);
        await db.update(syncRecords).set({ status: 'REJECTED', error, processedAt: new Date() }).where(eq(syncRecords.id, claimed.id));
        results.push({ clientId: rec.clientId, status: 'REJECTED', error });
      }
    }

    if (changed) await adaptiveService.recompute(studentId);
    return {
      results,
      applied: results.filter((r) => r.status === 'APPLIED').length,
      duplicates: results.filter((r) => r.status === 'DUPLICATE').length,
      rejected: results.filter((r) => r.status === 'REJECTED').length,
      retry: results.filter((r) => r.status === 'RETRY').length,
    };
  },
};

/** A record that can never succeed (bad reference or kind); it is settled as REJECTED. */
class RejectError extends Error {}
