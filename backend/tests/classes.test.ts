/**
 * Classes 1-12: catalogue, onboarding, subject rules, class-aware tutoring, history, consent and
 * guardian views. Synthetic accounts only; the AI runs in demo mode (no external calls).
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { eq, sql } from 'drizzle-orm';
import { createApp } from '../src/app';
import { db } from '../src/db/client';
import { learningProgress, studentCurricula, studentProfiles } from '../src/db/schema';
import { userRepository } from '../src/repositories/userRepository';
import { systemPrompt } from '../src/services/tutor/prompts';
import { studentCurriculumService } from '../src/services/curriculum/studentCurriculum';
import { deleteUsersWithPrefix } from './helpers';

const app = createApp();
const prefix = `k${Date.now().toString(36)}`;
const pw = 'Test@12345';
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

afterAll(async () => {
  await deleteUsersWithPrefix(prefix);
});

async function register(role: 'STUDENT' | 'PARENT' | 'TEACHER', name: string, extra: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ role, username: `${prefix}_${name}`, displayName: `T ${name}`, password: pw, email: role === 'STUDENT' ? undefined : `${prefix}_${name}@example.com`, preferredLanguage: 'HI', acceptTerms: true, guardianConsent: true, ...extra });
  expect(res.status).toBe(201);
  return { token: res.body.accessToken as string, user: res.body.user };
}

async function subjectsOf(board: string, session: string, cls: number) {
  const res = await request(app).get(`/api/catalog/subjects?board=${board}&session=${session}&class=${cls}`);
  expect(res.status).toBe(200);
  return res.body.subjects as Array<{ slug: string; subjectKey: string; nameEn: string; chapterCount: number | null; chaptersListed: number; hasLessons: boolean; verification: string }>;
}

const slugsFor = async (board: string, cls: number, keys: string[]) => {
  const list = await subjectsOf(board, '2026-27', cls);
  return keys.map((k) => {
    const s = list.find((x) => x.subjectKey === k);
    if (!s) throw new Error(`no ${k} in class ${cls}`);
    return s.slug;
  });
};

describe('catalogue', () => {
  it('lists Classes 1-12 by stage, the boards with honest status, and sessions', async () => {
    const res = await request(app).get('/api/catalog');
    expect(res.status).toBe(200);
    expect(res.body.classes.map((c: { level: number }) => c.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(res.body.classes.find((c: { level: number }) => c.level === 3).stage).toBe('PRIMARY');
    expect(res.body.classes.find((c: { level: number }) => c.level === 7).stage).toBe('MIDDLE');
    expect(res.body.classes.find((c: { level: number }) => c.level === 10).stage).toBe('SECONDARY');
    expect(res.body.classes.find((c: { level: number }) => c.level === 12).stage).toBe('SENIOR_SECONDARY');
    const icse = res.body.boards.find((b: { code: string }) => b.code === 'ICSE');
    expect(icse.available).toBe(false);
    expect(res.body.boards.find((b: { code: string }) => b.code === 'JAC').status).toBe('UNVERIFIED');
    expect(res.body.sessions.find((s: { code: string }) => s.code === '2026-27').isCurrent).toBe(true);
  });

  it('shows only the subjects that belong to a class', async () => {
    const c1 = (await subjectsOf('CBSE', '2026-27', 1)).map((s) => s.subjectKey).sort();
    expect(c1).toEqual(['english', 'hindi', 'mathematics', 'urdu']);
    const c1keys = new Set(c1);
    expect(c1keys.has('physics')).toBe(false);
    const c11 = (await subjectsOf('CBSE', '2026-27', 11)).map((s) => s.subjectKey);
    expect(c11).toEqual(expect.arrayContaining(['physics', 'chemistry', 'accountancy', 'history']));
    expect(c11).not.toContain('the-world-around-us');
  });

  it('lists official maths chapter titles where they were read from the book, and counts otherwise', async () => {
    const c10 = (await subjectsOf('CBSE', '2026-27', 10)).find((s) => s.subjectKey === 'mathematics')!;
    expect(c10.chaptersListed).toBe(14);
    const chapters = await request(app).get('/api/curriculum?board=CBSE&session=2026-27&class=10');
    expect(chapters.body.chapters.map((c: { nameEn: string }) => c.nameEn)).toContain('Real Numbers');
    const c4 = (await subjectsOf('CBSE', '2026-27', 4)).find((s) => s.subjectKey === 'mathematics')!;
    expect(c4.chaptersListed).toBe(0); // contents page was an image: no titles invented
    expect(c4.chapterCount).toBeGreaterThan(0);
  });

  it('refuses a board whose curriculum is not available', async () => {
    const s = await register('STUDENT', 'icse');
    const res = await request(app).put('/api/students/me/curriculum').set(auth(s.token)).send({ board: 'ICSE', session: '2026-27', classLevel: 6, medium: 'EN', subjects: ['x'] });
    expect(res.status).toBe(400);
  });
});

describe('onboarding across classes', () => {
  it('Class 1: picks subjects and sees only Class 1 learning', async () => {
    const s = await register('STUDENT', 'c1');
    const subjects = await slugsFor('JAC', 1, ['mathematics', 'hindi']);
    const res = await request(app).put('/api/students/me/curriculum').set(auth(s.token)).send({ board: 'JAC', session: '2026-27', classLevel: 1, medium: 'HI', subjects });
    expect(res.status).toBe(200);
    expect(res.body.curriculum.stage).toBe('PRIMARY');
    const overview = await request(app).get('/api/curriculum').set(auth(s.token));
    expect(overview.body.subjects.map((x: { slug: string }) => x.slug).sort()).toEqual([...subjects].sort());
    // No Class 9 chapters leak in
    expect(overview.body.chapters.every((c: { subjectSlug: string }) => subjects.includes(c.subjectSlug))).toBe(true);
  });

  it('Class 5: subject selection, and quizzes never show another class', async () => {
    const s = await register('STUDENT', 'c5');
    const subjects = await slugsFor('CBSE', 5, ['mathematics', 'the-world-around-us', 'english']);
    expect((await request(app).put('/api/students/me/curriculum').set(auth(s.token)).send({ board: 'CBSE', session: '2026-27', classLevel: 5, medium: 'EN', subjects })).status).toBe(200);
    const quizzes = await request(app).get('/api/assessments').set(auth(s.token));
    expect(quizzes.status).toBe(200);
    expect(quizzes.body).toEqual([]); // no Class 5 quizzes exist yet; Class 9 quizzes are not shown instead
  });

  it('rejects subjects from another class, and a stream below Class 11', async () => {
    const s = await register('STUDENT', 'bad');
    const physics11 = await slugsFor('CBSE', 11, ['physics']);
    expect((await request(app).put('/api/students/me/curriculum').set(auth(s.token)).send({ board: 'CBSE', session: '2026-27', classLevel: 9, medium: 'HI', subjects: physics11 })).status).toBe(400);
    const maths9 = await slugsFor('CBSE', 9, ['mathematics']);
    expect((await request(app).put('/api/students/me/curriculum').set(auth(s.token)).send({ board: 'CBSE', session: '2026-27', classLevel: 9, medium: 'HI', stream: 'SCIENCE', subjects: maths9 })).status).toBe(400);
    expect((await request(app).put('/api/students/me/curriculum').set(auth(s.token)).send({ board: 'CBSE', session: '2026-27', classLevel: 13, medium: 'HI', subjects: maths9 })).status).toBe(400);
  });

  it('Class 11: Science, Commerce and Humanities combinations', async () => {
    const combos: Array<[string, string[]]> = [
      ['SCIENCE', ['physics', 'chemistry', 'mathematics', 'biology', 'english']],
      ['COMMERCE', ['accountancy', 'business-studies', 'economics', 'english']],
      ['HUMANITIES', ['history', 'political-science', 'geography', 'hindi']],
    ];
    for (const [stream, keys] of combos) {
      const s = await register('STUDENT', `c11${stream.toLowerCase()}`);
      const subjects = await slugsFor('CBSE', 11, keys);
      const res = await request(app).put('/api/students/me/curriculum').set(auth(s.token)).send({ board: 'CBSE', session: '2026-27', classLevel: 11, medium: 'EN', stream, subjects });
      expect(res.status).toBe(200);
      expect(res.body.curriculum.stream).toBe(stream);
      expect(res.body.curriculum.subjects).toHaveLength(keys.length);
    }
  });
});

describe('class-aware tutor', () => {
  it('teaches differently by stage and names the class', () => {
    const base = { language: 'HI' as const, level: 'STANDARD' as const };
    const p2 = systemPrompt({ ...base, learner: { classLevel: 2, stage: 'PRIMARY' } });
    const p8 = systemPrompt({ ...base, learner: { classLevel: 8, stage: 'MIDDLE', subject: 'Science' } });
    const p10 = systemPrompt({ ...base, learner: { classLevel: 10, stage: 'SECONDARY', board: 'CBSE' } });
    const p12 = systemPrompt({ ...base, learner: { classLevel: 12, stage: 'SENIOR_SECONDARY', subject: 'Physics' } });
    expect(p2).toMatch(/Class 2 student/);
    expect(p2).toMatch(/Primary stage/);
    expect(p8).toMatch(/guided practice/i);
    expect(p8).toMatch(/about Science/);
    expect(p10).toMatch(/board exams/i);
    expect(p12).toMatch(/deeper conceptual/i);
    expect(p12).toMatch(/beyond Class 12/);
    for (const p of [p2, p8, p10, p12]) expect(p).not.toMatch(/Class 9/);
  });

  it('Class 12: a conversation can only use the student\'s own subject', async () => {
    const s = await register('STUDENT', 'c12');
    const [physics, maths] = await slugsFor('CBSE', 12, ['physics', 'mathematics']);
    await request(app).put('/api/students/me/curriculum').set(auth(s.token)).send({ board: 'CBSE', session: '2026-27', classLevel: 12, medium: 'EN', stream: 'SCIENCE', subjects: [physics, maths] });
    const ok = await request(app).post('/api/tutor/conversations').set(auth(s.token)).send({ subjectSlug: physics });
    expect(ok.status).toBe(201);
    const [history] = await slugsFor('CBSE', 12, ['history']);
    expect((await request(app).post('/api/tutor/conversations').set(auth(s.token)).send({ subjectSlug: history })).status).toBe(400);
    // English medium: the (demo) reply comes back in English
    const ask = await request(app).post(`/api/tutor/conversations/${ok.body.id}/messages`).set(auth(s.token)).send({ content: 'What is 12 * 3?', intent: 'solution' });
    if (ask.body.assistantMessage?.provider === 'demo') expect(ask.body.assistantMessage.structured.language).toBe('EN');
  });

  it('Class 8 (Hindi medium): the tutor answers in Hindi', async () => {
    const s = await register('STUDENT', 'c8');
    const subjects = await slugsFor('JAC', 8, ['mathematics', 'science']);
    await request(app).put('/api/students/me/curriculum').set(auth(s.token)).send({ board: 'JAC', session: '2026-27', classLevel: 8, medium: 'HI', subjects });
    const conv = await request(app).post('/api/tutor/conversations').set(auth(s.token)).send({ subjectSlug: subjects[0] });
    const ask = await request(app).post(`/api/tutor/conversations/${conv.body.id}/messages`).set(auth(s.token)).send({ content: '15 + 27 कितना है?', intent: 'hint' });
    expect([200, 503]).toContain(ask.status);
    if (ask.body.assistantMessage?.provider === 'demo') expect(ask.body.assistantMessage.structured.language).toBe('HI');
  });
});

describe('changing class keeps history', () => {
  it('moves from Class 9 to Class 10 without losing Class 9 progress', async () => {
    const s = await register('STUDENT', 'move');
    await request(app).put('/api/students/me/curriculum').set(auth(s.token)).send({ board: 'JAC', session: '2025-26', classLevel: 9, medium: 'HI', subjects: ['class-9-maths'] });
    const next = await request(app).get('/api/practice/next?topic=rational-and-irrational').set(auth(s.token));
    await request(app).post('/api/practice/answer').set(auth(s.token)).send({ questionId: next.body.question.id, answer: '1' });
    const sid = s.user.student.id as string;
    const before = await db.select().from(learningProgress).where(eq(learningProgress.studentId, sid));
    expect(before.length).toBeGreaterThan(0);

    const subjects = await slugsFor('JAC', 10, ['mathematics', 'science']);
    const res = await request(app).put('/api/students/me/curriculum').set(auth(s.token)).send({ board: 'JAC', session: '2026-27', classLevel: 10, medium: 'HI', subjects });
    expect(res.body.curriculum.classLevel).toBe(10);
    const history = await request(app).get('/api/students/me/curriculum/history').set(auth(s.token));
    expect(history.body).toHaveLength(2);
    expect(history.body.filter((h: { isActive: boolean }) => h.isActive)).toHaveLength(1);
    expect(await db.select().from(learningProgress).where(eq(learningProgress.studentId, sid))).toHaveLength(before.length);
    const profile = await db.query.studentProfiles.findFirst({ where: eq(studentProfiles.id, sid) });
    expect(profile?.classLevel).toBe(10);
  });
});

describe('existing Class 9 students (migration backfill)', () => {
  it('gives a student with no selection the JAC Class 9 maths selection they had before', async () => {
    const u = await userRepository.create({ username: `${prefix}_legacy`, passwordHash: 'x', role: 'STUDENT', displayName: 'Old', preferredLanguage: 'HI', linkCode: `L${Date.now().toString(36).slice(-5).toUpperCase()}` });
    const sid = u.student!.id;
    expect(await studentCurriculumService.active(sid)).toBeNull();
    // Run the two backfill statements exactly as written in the migration
    const file = fs.readdirSync(path.resolve(__dirname, '../drizzle')).find((f) => f.startsWith('0001_'))!;
    const parts = fs.readFileSync(path.resolve(__dirname, '../drizzle', file), 'utf8').split('--> statement-breakpoint').map((p) => p.trim());
    for (const stmt of parts.filter((p) => /INSERT INTO `student_curricula`|INSERT OR IGNORE INTO `student_subjects`/.test(p))) {
      await db.run(sql.raw(stmt.replace(/^--.*$/gm, '')));
    }
    const active = await studentCurriculumService.active(sid);
    expect(active?.classLevel).toBe(9);
    expect(active?.board.code).toBe('JAC');
    expect(active?.session.code).toBe('2025-26');
    expect(active?.subjects.map((s) => s.slug)).toEqual(['class-9-maths']);
    expect(await db.select().from(studentCurricula).where(eq(studentCurricula.studentId, sid))).toHaveLength(1);
  });
});

describe('guardian consent and views', () => {
  let student: Awaited<ReturnType<typeof register>>;
  beforeAll(async () => {
    student = await register('STUDENT', 'cons');
    const subjects = await slugsFor('JAC', 6, ['mathematics']);
    await request(app).put('/api/students/me/curriculum').set(auth(student.token)).send({ board: 'JAC', session: '2026-27', classLevel: 6, medium: 'HI', subjects });
  });

  it('a student cannot register without saying a guardian agreed', async () => {
    const res = await request(app).post('/api/auth/register').send({ role: 'STUDENT', username: `${prefix}_noconsent`, displayName: 'N', password: pw, acceptTerms: true });
    expect(res.status).toBe(400);
  });

  it('records the declaration, and only a parent link confirms consent', async () => {
    const sid = student.user.student.id as string;
    let p = await db.query.studentProfiles.findFirst({ where: eq(studentProfiles.id, sid) });
    expect(p?.guardianConsentDeclaredAt).toBeTruthy();
    expect(p?.guardianConsentConfirmedAt).toBeNull();

    const teacher = await register('TEACHER', 'ctea');
    await request(app).post('/api/parents/link').set(auth(teacher.token)).send({ code: student.user.student.linkCode, guardianConsent: true });
    p = await db.query.studentProfiles.findFirst({ where: eq(studentProfiles.id, sid) });
    expect(p?.guardianConsentConfirmedAt).toBeNull();

    const parent = await register('PARENT', 'cpar');
    await request(app).post('/api/parents/link').set(auth(parent.token)).send({ code: student.user.student.linkCode, guardianConsent: true });
    p = await db.query.studentProfiles.findFirst({ where: eq(studentProfiles.id, sid) });
    expect(p?.guardianConsentConfirmedAt).toBeTruthy();

    // The parent sees the student's current class and board
    const list = await request(app).get('/api/parents/students').set(auth(parent.token));
    const me = list.body.find((s: { id: string }) => s.id === sid);
    expect(me.classLevel).toBe(6);
    expect(me.board).toBe('JAC');
  });

  it("a student's curriculum is private to them", async () => {
    const other = await register('STUDENT', 'other');
    const mine = await request(app).get('/api/students/me/curriculum').set(auth(other.token));
    expect(mine.body.curriculum).toBeNull();
    const parentTry = await request(app).get('/api/students/me/curriculum').set(auth((await register('PARENT', 'pp')).token));
    expect(parentTry.status).toBe(403);
  });
});
