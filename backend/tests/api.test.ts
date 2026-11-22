/**
 * Integration tests against a throwaway libSQL database (built by tests/globalSetup.ts).
 * Creates users with a unique prefix and deletes them afterwards.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client';
import { questions } from '../src/db/schema';
import { deleteUsersWithPrefix } from './helpers';

const app = createApp();
const prefix = `t${Date.now().toString(36)}`;
const pw = 'Test@12345';

async function register(role: 'STUDENT' | 'PARENT' | 'TEACHER', name: string) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ role, username: `${prefix}_${name}`, displayName: `Test ${name}`, password: pw, email: role === 'STUDENT' ? undefined : `${prefix}_${name}@example.com`, preferredLanguage: 'HI', acceptTerms: true, guardianConsent: true });
  expect(res.status).toBe(201);
  if (role === 'STUDENT') {
    // Class 9 compatibility: the original JAC Class 9 maths content (session 2025-26)
    const cur = await request(app).put('/api/students/me/curriculum').set('Authorization', `Bearer ${res.body.accessToken}`).send({ board: 'JAC', session: '2025-26', classLevel: 9, medium: 'HI', subjects: ['class-9-maths'] });
    expect(cur.status).toBe(200);
  }
  return { token: res.body.accessToken as string, user: res.body.user, cookie: res.headers['set-cookie'] as unknown as string[] };
}

let student: Awaited<ReturnType<typeof register>>;
let parent: Awaited<ReturnType<typeof register>>;
let stranger: Awaited<ReturnType<typeof register>>;

beforeAll(async () => {
  student = await register('STUDENT', 'stu');
  parent = await register('PARENT', 'par');
  stranger = await register('TEACHER', 'tea');
});

afterAll(async () => {
  await deleteUsersWithPrefix(prefix);
});

describe('health', () => {
  it('reports db and ai mode', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.db).toBe('up');
    expect(['live', 'demo']).toContain(res.body.ai.mode);
  });
});

describe('auth', () => {
  it('rejects duplicate usernames', async () => {
    const res = await request(app).post('/api/auth/register').send({ role: 'STUDENT', username: `${prefix}_stu`, displayName: 'Dup', password: pw, acceptTerms: true, guardianConsent: true });
    expect(res.status).toBe(409);
  });
  it('answers login and sign-up mistakes with 200 + error only when the app asks (X-Soft-Errors)', async () => {
    const wrong = { username: `${prefix}_stu`, password: 'definitely-wrong-1' };
    const plain = await request(app).post('/api/auth/login').send(wrong);
    expect(plain.status).toBe(401);
    const soft = await request(app).post('/api/auth/login').set('X-Soft-Errors', '1').send(wrong);
    expect(soft.status).toBe(200);
    expect(soft.body.error.status).toBe(401);
    expect(soft.body.accessToken).toBeUndefined();
    const taken = await request(app).post('/api/auth/register').set('X-Soft-Errors', '1').send({ role: 'STUDENT', username: `${prefix}_stu`, displayName: 'Dup', password: pw, acceptTerms: true, guardianConsent: true });
    expect(taken.status).toBe(200);
    expect(taken.body.error.status).toBe(409);
    // Other endpoints keep real status codes even with the header
    const other = await request(app).get('/api/progress/me').set('X-Soft-Errors', '1');
    expect(other.status).toBe(401);
  });
  it('rejects the honeypot field', async () => {
    const res = await request(app).post('/api/auth/register').send({ role: 'STUDENT', username: `${prefix}_bot`, displayName: 'Bot', password: pw, acceptTerms: true, guardianConsent: true, website: 'http://spam' });
    expect(res.status).toBe(400);
  });
  it('validates input', async () => {
    const res = await request(app).post('/api/auth/register').send({ role: 'STUDENT', username: 'a', password: '1' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });
  it('logs in with a generic error on failure', async () => {
    const bad = await request(app).post('/api/auth/login').send({ username: `${prefix}_stu`, password: 'wrong-password' });
    expect(bad.status).toBe(401);
    const ok = await request(app).post('/api/auth/login').send({ username: `${prefix}_stu`, password: pw });
    expect(ok.status).toBe(200);
    expect(ok.body.accessToken).toBeTruthy();
  });
  it('rotates refresh tokens and detects reuse', async () => {
    const first = await request(app).post('/api/auth/refresh').set('Cookie', student.cookie);
    expect(first.status).toBe(200);
    const reuse = await request(app).post('/api/auth/refresh').set('Cookie', student.cookie);
    expect(reuse.status).toBe(401);
  });
  it('requires a token for protected routes', async () => {
    expect((await request(app).get('/api/progress/me')).status).toBe(401);
  });
});

describe('learning flow', () => {
  it('lists the curriculum publicly', async () => {
    const res = await request(app).get('/api/curriculum?board=JAC&session=2025-26&class=9');
    expect(res.status).toBe(200);
    expect(res.body.chapters.length).toBe(12);
    // No class is assumed when none is asked for
    expect((await request(app).get('/api/curriculum')).body.chapters).toHaveLength(0);
    expect(res.body.meta.curriculumVerification.status).toBeTruthy();
  });

  it('serves a practice question without its answer, then grades it', async () => {
    const next = await request(app).get('/api/practice/next?topic=laws-of-exponents').set('Authorization', `Bearer ${student.token}`);
    expect(next.status).toBe(200);
    expect(next.body.question.correctAnswer).toBeUndefined();
    const q = await db.query.questions.findFirst({ where: eq(questions.id, next.body.question.id) });
    const ans = await request(app).post('/api/practice/answer').set('Authorization', `Bearer ${student.token}`).send({ questionId: q!.id, answer: q!.correctAnswer });
    expect(ans.status).toBe(200);
    expect(ans.body.isCorrect).toBe(true);
    expect(ans.body.progress.attempts).toBe(1);
  });

  it('runs a chapter quiz end to end', async () => {
    const start = await request(app).post('/api/assessments/polynomials-quiz/start').set('Authorization', `Bearer ${student.token}`);
    expect(start.status).toBe(201);
    const quiz = await request(app).get('/api/assessments/polynomials-quiz');
    const answers = quiz.body.questions.map((q: { id: string }) => ({ questionId: q.id, answer: '0' }));
    const submit = await request(app).post(`/api/assessments/sessions/${start.body.sessionId}/submit`).set('Authorization', `Bearer ${student.token}`).send({ answers });
    expect(submit.status).toBe(200);
    expect(submit.body.total).toBe(6);
    const again = await request(app).post(`/api/assessments/sessions/${start.body.sessionId}/submit`).set('Authorization', `Bearer ${student.token}`).send({ answers });
    expect(again.status).toBe(400);
  });

  it('applies offline sync records once', async () => {
    const q = await db.query.questions.findFirst({ where: eq(questions.slug, 'cg-cp-1') });
    const records = [
      { clientId: `${prefix}-rec-0001`, kind: 'answer', createdAt: new Date().toISOString(), payload: { questionId: q!.id, answer: 'b' } },
      { clientId: `${prefix}-rec-0002`, kind: 'lesson-complete', createdAt: new Date().toISOString(), payload: { topicSlug: 'cartesian-plane' } },
    ];
    const first = await request(app).post('/api/sync').set('Authorization', `Bearer ${student.token}`).send({ records });
    expect(first.body.applied).toBe(2);
    const second = await request(app).post('/api/sync').set('Authorization', `Bearer ${student.token}`).send({ records });
    expect(second.body.duplicates).toBe(2);
  });

  it('applies an offline doubt and stores the tutor reply', async () => {
    const content = '15 + 27 कितना है?';
    const records = [{ clientId: `${prefix}-doubt-0001`, kind: 'doubt', createdAt: new Date().toISOString(), payload: { content, intent: 'hint', language: 'HI' } }];
    const res = await request(app).post('/api/sync').set('Authorization', `Bearer ${student.token}`).send({ records });
    expect(res.status).toBe(200);
    expect(res.body.applied).toBe(1);
    const list = await request(app).get('/api/tutor/conversations').set('Authorization', `Bearer ${student.token}`);
    expect(list.status).toBe(200);
    const conversations: Array<{ id: string; messages?: Array<{ content: string }> }> = Array.isArray(list.body) ? list.body : (list.body.conversations ?? []);
    expect(conversations.length).toBeGreaterThan(0);
    // Check each conversation's messages; the list may omit them, so fetch the detail view when needed
    let found = false;
    for (const c of conversations) {
      const messages = c.messages ?? (await request(app).get(`/api/tutor/conversations/${c.id}`).set('Authorization', `Bearer ${student.token}`)).body.messages ?? [];
      if (messages.some((m: { content: string }) => m.content.includes(content))) found = true;
    }
    expect(found).toBe(true);
  });

  it('answers at most a few doubts per sync and defers the rest', async () => {
    const auth = { Authorization: `Bearer ${student.token}` };
    const records = Array.from({ length: 5 }, (_, i) => ({ clientId: `${prefix}-cap-${i}`, kind: 'doubt', createdAt: new Date(Date.now() - (5 - i) * 1000).toISOString(), payload: { content: `${i + 2} + ${i + 3} कितना है?`, intent: 'hint' } }));
    const first = await request(app).post('/api/sync').set(auth).send({ records });
    expect(first.status).toBe(200);
    expect(first.body.applied).toBe(3);
    const deferred = first.body.results.filter((r: { status: string; error?: string }) => r.status === 'RETRY' && r.error === 'DEFERRED');
    expect(deferred).toHaveLength(2);
    // The deferred ones are sent again (the device keeps them queued) and get answered
    const second = await request(app).post('/api/sync').set(auth).send({ records });
    expect(second.body.applied).toBe(2);
    expect(second.body.duplicates).toBe(3);
  });

  it('does not ask a doubt twice when the online request already got an answer', async () => {
    const auth = { Authorization: `Bearer ${student.token}` };
    const content = '9 × 8 कितना है?';
    const conv = await request(app).post('/api/tutor/conversations').set(auth).send({});
    const online = await request(app).post(`/api/tutor/conversations/${conv.body.id}/messages`).set(auth).send({ content, intent: 'hint' });
    expect(online.status).toBe(200);
    // The connection dropped after the server answered, so the phone queued the same question
    const res = await request(app)
      .post('/api/sync')
      .set(auth)
      .send({ records: [{ clientId: `${prefix}-dedupe-1`, kind: 'doubt', createdAt: new Date().toISOString(), payload: { content, intent: 'hint', conversationId: conv.body.id } }] });
    expect(res.body.applied).toBe(1);
    const detail = await request(app).get(`/api/tutor/conversations/${conv.body.id}`).set(auth);
    expect(detail.body.messages.filter((m: { content: string; role: string }) => m.role === 'USER' && m.content === content)).toHaveLength(1);
    expect(detail.body.messages).toHaveLength(2);
  });

  it('rejects a doubt for a conversation that is not the student’s', async () => {
    const res = await request(app)
      .post('/api/sync')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ records: [{ clientId: `${prefix}-badconv-1`, kind: 'doubt', createdAt: new Date().toISOString(), payload: { content: 'x', intent: 'hint', conversationId: 'not-a-real-conversation' } }] });
    expect(res.body.rejected).toBe(1);
  });


  it('accepts Hinglish as the tutor language', async () => {
    const auth = { Authorization: `Bearer ${student.token}` };
    const conv = await request(app).post('/api/tutor/conversations').set(auth).send({});
    const res = await request(app).post(`/api/tutor/conversations/${conv.body.id}/messages`).set(auth).send({ content: '12 + 30 kitna hai?', intent: 'hint', language: 'HG' });
    expect([200, 503]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.assistantMessage.structured.language).toBe('HG');
      expect(res.body.assistantMessage.content).not.toMatch(/[ऀ-ॿ]/);
    }
  });

  it('answers in demo mode honestly when no AI key is set', async () => {
    const conv = await request(app).post('/api/tutor/conversations').set('Authorization', `Bearer ${student.token}`).send({});
    expect(conv.status).toBe(201);
    const res = await request(app).post(`/api/tutor/conversations/${conv.body.id}/messages`).set('Authorization', `Bearer ${student.token}`).send({ content: '2x + 3 = 7 हल करो', intent: 'solution' });
    if (res.body.assistantMessage?.provider === 'demo') {
      expect(res.body.assistantMessage.structured.demo).toBe(true);
      expect(res.body.assistantMessage.structured.computed).toBe(2);
    } else {
      expect([200, 503]).toContain(res.status);
    }
  });
});

describe('guardian access control', () => {
  it('blocks students from the guardian API', async () => {
    expect((await request(app).get('/api/parents/students').set('Authorization', `Bearer ${student.token}`)).status).toBe(403);
  });
  it('blocks guardians from student-only APIs', async () => {
    expect((await request(app).get('/api/progress/me').set('Authorization', `Bearer ${parent.token}`)).status).toBe(403);
  });
  it('links with a code and only then exposes the report', async () => {
    const studentId = student.user.student.id;
    const before = await request(app).get(`/api/parents/students/${studentId}/report`).set('Authorization', `Bearer ${parent.token}`);
    expect(before.status).toBe(404);
    const link = await request(app).post('/api/parents/link').set('Authorization', `Bearer ${parent.token}`).send({ code: student.user.student.linkCode });
    expect(link.status).toBe(201);
    const after = await request(app).get(`/api/parents/students/${studentId}/report`).set('Authorization', `Bearer ${parent.token}`);
    expect(after.status).toBe(200);
    expect(after.body.totals.answered).toBeGreaterThan(0);
    expect(after.body).not.toHaveProperty('messages');
    const other = await request(app).get(`/api/parents/students/${studentId}/report`).set('Authorization', `Bearer ${stranger.token}`);
    expect(other.status).toBe(404);
  });
});
