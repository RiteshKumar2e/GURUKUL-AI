import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { curriculumRepository } from '../../repositories/curriculumRepository';
import { adaptiveService } from '../adaptive-learning/adaptiveService';

export type SyncInput =
  | { clientId: string; kind: 'answer'; createdAt: string; payload: { questionId: string; answer: string; timeTakenSec?: number } }
  | { clientId: string; kind: 'lesson-complete'; createdAt: string; payload: { topicSlug: string } };

/**
 * Applies records queued on the device while offline. Idempotent per (student, clientId).
 * Answers are re-graded on the server; the device's local grading is never trusted.
 */
export const syncService = {
  async apply(studentId: string, records: SyncInput[]) {
    const results: Array<{ clientId: string; status: 'APPLIED' | 'DUPLICATE' | 'REJECTED'; error?: string; isCorrect?: boolean }> = [];
    let changed = false;

    const sorted = [...records].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const rec of sorted) {
      const existing = await prisma.syncRecord.findUnique({ where: { studentId_clientId: { studentId, clientId: rec.clientId } } });
      if (existing) {
        results.push({ clientId: rec.clientId, status: 'DUPLICATE' });
        continue;
      }
      const createdAt = new Date(rec.createdAt);
      const when = Number.isNaN(createdAt.getTime()) || createdAt > new Date() ? new Date() : createdAt;
      let status: 'APPLIED' | 'REJECTED' = 'APPLIED';
      let error: string | undefined;
      let isCorrect: boolean | undefined;

      try {
        if (rec.kind === 'answer') {
          const q = await curriculumRepository.questionById(rec.payload.questionId);
          if (!q) throw new Error('Unknown question');
          const r = await adaptiveService.recordAnswer({ studentId, question: q, answer: rec.payload.answer, timeTakenSec: rec.payload.timeTakenSec, origin: 'OFFLINE_SYNC', answeredAt: when });
          isCorrect = r.isCorrect;
        } else if (rec.kind === 'lesson-complete') {
          const t = await curriculumRepository.topicBySlug(rec.payload.topicSlug);
          if (!t) throw new Error('Unknown topic');
          await adaptiveService.markLessonComplete(studentId, t.id, when);
        } else {
          throw new Error('Unknown record kind');
        }
        changed = true;
      } catch (e) {
        status = 'REJECTED';
        error = (e as Error).message;
      }

      await prisma.syncRecord.create({
        data: { studentId, clientId: rec.clientId, kind: rec.kind, payload: rec.payload as Prisma.InputJsonValue, status, error, clientCreatedAt: when },
      });
      results.push({ clientId: rec.clientId, status, error, isCorrect });
    }

    if (changed) await adaptiveService.recompute(studentId);
    return {
      results,
      applied: results.filter((r) => r.status === 'APPLIED').length,
      duplicates: results.filter((r) => r.status === 'DUPLICATE').length,
      rejected: results.filter((r) => r.status === 'REJECTED').length,
    };
  },
};
