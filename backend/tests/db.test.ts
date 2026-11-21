/**
 * Database layer tests (Drizzle + libSQL), run against the throwaway test database.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { and, count, eq } from 'drizzle-orm';
import { createApp } from '../src/app';
import { checkDatabase, db, isTransient, isUniqueViolation, withRetry } from '../src/db/client';
import {
  learningProgress,
  questions,
  refreshTokens,
  studentAnswers,
  studentParents,
  studentProfiles,
  syncRecords,
  topics,
  tutorConversations,
  tutorMessages,
  users,
} from '../src/db/schema';
import { userRepository } from '../src/repositories/userRepository';
import { learningRepository } from '../src/repositories/learningRepository';
import { tutorRepository } from '../src/repositories/tutorRepository';
import { syncService } from '../src/services/sync/syncService';
import { deleteUsersWithPrefix } from './helpers';

const app = createApp();
const prefix = `d${Date.now().toString(36)}`;

afterAll(async () => {
  await deleteUsersWithPrefix(prefix);
});

describe('connection and health', () => {
  it('reaches the database and sees migrated tables', async () => {
    const h = await checkDatabase();
    expect(h.ok).toBe(true);
    expect(h.migrated).toBe(true);
    expect(h.location).toBe('local-file');
  });

  it('exposes db status on /api/health without credentials', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.db).toBe('up');
    expect(res.body.database.driver).toBe('libsql');
    expect(JSON.stringify(res.body)).not.toMatch(/TURSO|authToken|libsql:\/\//i);
  });
});

describe('users: CRUD, constraints, relations', () => {
  let studentId = '';
  let userId = '';

  beforeAll(async () => {
    const u = await userRepository.create({ username: `${prefix}_crud`, passwordHash: 'x', role: 'STUDENT', displayName: 'CRUD', preferredLanguage: 'HI', linkCode: `C${Date.now().toString(36).slice(-5).toUpperCase()}` });
    userId = u.id;
    studentId = u.student!.id;
  });

  it('creates the user and its student profile together', async () => {
    const u = await userRepository.findPublicById(userId);
    expect(u?.username).toBe(`${prefix}_crud`);
    expect(u?.student?.classLevel).toBe(9);
    expect(u?.student?.board).toBe('JAC');
    expect(u?.parent).toBeNull();
    expect(typeof u?.createdAt.getTime()).toBe('number');
  });

  it('updates fields and keeps types (boolean, enum)', async () => {
    const updated = await userRepository.update(userId, { displayName: 'CRUD 2', preferredLanguage: 'EN' });
    expect(updated?.displayName).toBe('CRUD 2');
    expect(updated?.preferredLanguage).toBe('EN');
    await db.update(studentProfiles).set({ onboardingDone: true }).where(eq(studentProfiles.id, studentId));
    expect((await userRepository.findPublicById(userId))?.student?.onboardingDone).toBe(true);
  });

  it('enforces unique usernames', async () => {
    await expect(userRepository.create({ username: `${prefix}_crud`, passwordHash: 'x', role: 'PARENT', displayName: 'Dup', preferredLanguage: 'HI' })).rejects.toSatisfy((e: unknown) =>
      isUniqueViolation(e, 'users.username'),
    );
  });

  it('rolls back the whole registration if the profile insert fails', async () => {
    const before = (await db.select({ n: count() }).from(users))[0].n;
    const taken = (await db.query.studentProfiles.findFirst({ where: eq(studentProfiles.id, studentId) }))!.linkCode;
    await expect(userRepository.create({ username: `${prefix}_rollback`, passwordHash: 'x', role: 'STUDENT', displayName: 'R', preferredLanguage: 'HI', linkCode: taken })).rejects.toSatisfy((e: unknown) =>
      isUniqueViolation(e, 'link_code'),
    );
    expect((await db.select({ n: count() }).from(users))[0].n).toBe(before);
    expect(await userRepository.findByUsername(`${prefix}_rollback`)).toBeNull();
  });

  it('stores JSON columns and reads them back as objects', async () => {
    const q = await db.query.questions.findFirst({ where: eq(questions.type, 'MCQ') });
    expect(Array.isArray(q?.options)).toBe(true);
    expect(q?.options?.[0]).toHaveProperty('id');
    const lesson = await db.query.lessons.findFirst();
    expect(Array.isArray(lesson?.content)).toBe(true);
  });

  it('upserts progress on the (student, topic) unique key', async () => {
    const topic = (await db.query.topics.findFirst())!;
    await learningRepository.upsertProgress(studentId, topic.id, { attempts: 1, correct: 1, mastery: 0.3 });
    const second = await learningRepository.upsertProgress(studentId, topic.id, { attempts: 2, correct: 1, mastery: 0.25 });
    expect(second.attempts).toBe(2);
    const rows = await db.select().from(learningProgress).where(and(eq(learningProgress.studentId, studentId), eq(learningProgress.topicId, topic.id)));
    expect(rows).toHaveLength(1);
    expect(rows[0].mastery).toBeCloseTo(0.25);
  });

  it('loads nested relations (progress -> topic -> chapter)', async () => {
    const all = await learningRepository.allProgress(studentId);
    expect(all[0].topic.chapter.number).toBeGreaterThan(0);
  });

  it('deletes an account and every dependent row', async () => {
    const parent = await userRepository.create({ username: `${prefix}_par`, passwordHash: 'x', role: 'PARENT', displayName: 'P', preferredLanguage: 'HI' });
    await db.insert(studentParents).values({ studentId, parentId: parent.parent!.id });
    const q = (await db.query.questions.findFirst())!;
    await learningRepository.createAnswer({ studentId, questionId: q.id, answer: '1', isCorrect: false, difficulty: 1 });
    const conv = await tutorRepository.create(studentId, { title: 't', mode: 'TEXT' });
    await tutorRepository.addMessage({ conversationId: conv.id, role: 'USER', content: 'hi' });
    await userRepository.saveRefreshToken(userId, `${prefix}-hash`, new Date(Date.now() + 1000));

    await userRepository.delete(userId);

    expect(await userRepository.findById(userId)).toBeNull();
    expect(await db.select().from(studentProfiles).where(eq(studentProfiles.id, studentId))).toHaveLength(0);
    expect(await db.select().from(studentAnswers).where(eq(studentAnswers.studentId, studentId))).toHaveLength(0);
    expect(await db.select().from(learningProgress).where(eq(learningProgress.studentId, studentId))).toHaveLength(0);
    expect(await db.select().from(tutorConversations).where(eq(tutorConversations.studentId, studentId))).toHaveLength(0);
    expect(await db.select().from(tutorMessages).where(eq(tutorMessages.conversationId, conv.id))).toHaveLength(0);
    expect(await db.select().from(studentParents).where(eq(studentParents.studentId, studentId))).toHaveLength(0);
    expect(await db.select().from(refreshTokens).where(eq(refreshTokens.userId, userId))).toHaveLength(0);
    // the linked parent account itself is kept
    expect(await userRepository.findById(parent.id)).not.toBeNull();
    // curriculum is untouched
    expect((await db.select({ n: count() }).from(topics))[0].n).toBeGreaterThan(0);
  });
});

describe('offline sync', () => {
  let studentId = '';
  beforeAll(async () => {
    const u = await userRepository.create({ username: `${prefix}_sync`, passwordHash: 'x', role: 'STUDENT', displayName: 'S', preferredLanguage: 'HI', linkCode: `S${Date.now().toString(36).slice(-5).toUpperCase()}` });
    studentId = u.student!.id;
  });

  it('applies a record exactly once even when sent twice at the same time', async () => {
    const q = (await db.query.questions.findFirst({ where: eq(questions.type, 'NUMERIC') }))!;
    const rec = { clientId: `${prefix}-race-1`, kind: 'answer' as const, createdAt: new Date().toISOString(), payload: { questionId: q.id, answer: q.correctAnswer } };
    const [a, b] = await Promise.all([syncService.apply(studentId, [rec]), syncService.apply(studentId, [rec])]);
    expect(a.applied + b.applied).toBe(1);
    expect(a.duplicates + b.duplicates).toBe(1);
    const answers = await db.select().from(studentAnswers).where(eq(studentAnswers.studentId, studentId));
    expect(answers).toHaveLength(1);
    expect(answers[0].origin).toBe('OFFLINE_SYNC');
    expect(answers[0].isCorrect).toBe(true);
    const row = await db.query.syncRecords.findFirst({ where: and(eq(syncRecords.studentId, studentId), eq(syncRecords.clientId, rec.clientId)) });
    expect(row?.status).toBe('APPLIED');
  });

  it('rejects records that can never apply, and records why', async () => {
    const res = await syncService.apply(studentId, [{ clientId: `${prefix}-bad-1`, kind: 'answer', createdAt: new Date().toISOString(), payload: { questionId: 'missing', answer: '1' } }]);
    expect(res.rejected).toBe(1);
    expect(res.results[0].error).toBe('Unknown question');
  });

  it('never trusts a future client timestamp', async () => {
    const t = (await db.query.topics.findFirst())!;
    await syncService.apply(studentId, [{ clientId: `${prefix}-future`, kind: 'lesson-complete', createdAt: '2999-01-01T00:00:00Z', payload: { topicSlug: t.slug } }]);
    const p = await learningRepository.progressFor(studentId, t.id);
    expect(p!.lessonCompletedAt!.getTime()).toBeLessThanOrEqual(Date.now());
  });
});

describe('retry policy', () => {
  it('retries transient errors and then succeeds', async () => {
    let calls = 0;
    const v = await withRetry(async () => {
      calls++;
      if (calls < 3) throw Object.assign(new Error('fetch failed'), { cause: { code: 'ECONNRESET' } });
      return 'ok';
    }, 3, 1);
    expect(v).toBe('ok');
    expect(calls).toBe(3);
  });

  it('does not retry constraint errors', async () => {
    let calls = 0;
    await expect(
      withRetry(async () => {
        calls++;
        throw Object.assign(new Error('UNIQUE constraint failed: users.username'), { code: 'SQLITE_CONSTRAINT_UNIQUE' });
      }, 3, 1),
    ).rejects.toThrow();
    expect(calls).toBe(1);
    expect(isTransient(new Error('UNIQUE constraint failed'))).toBe(false);
  });
});
