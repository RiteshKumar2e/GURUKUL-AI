/**
 * Tests added during the hackathon audit: calculator edge cases, tutor reply rules, adaptive
 * question choice, atomic offline sync, and data isolation between accounts on the same API.
 * External AI services are never called; the test server runs in demo mode.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app';
import { db } from '../src/db/client';
import { questions, studentAnswers, syncRecords } from '../src/db/schema';
import { evaluate, parseNumericAnswer, solveLinear } from '../src/utils/math';
import { gradeAnswer } from '../src/utils/grading';
import { verifyCheck } from '../src/services/tutor/verifier';
import { buildStructured, renderPlain } from '../src/services/tutor/tutorService';
import { systemPrompt } from '../src/services/tutor/prompts';
import { nextProgress, pickQuestion, type Attempt } from '../src/services/adaptive-learning/adaptiveService';
import { learningRepository } from '../src/repositories/learningRepository';
import { userRepository } from '../src/repositories/userRepository';
import { syncService } from '../src/services/sync/syncService';
import { deleteUsersWithPrefix } from './helpers';

const app = createApp();
const prefix = `a${Date.now().toString(36)}`;
afterAll(async () => {
  await deleteUsersWithPrefix(prefix);
});

/* ------------------------------------------------------------ calculator */

describe('calculator: arithmetic the tutor and grader rely on', () => {
  it('follows order of operations and brackets', () => {
    expect(evaluate('2 + 3 × 4')).toBe(14);
    expect(evaluate('(2 + 3) × 4')).toBe(20);
    expect(evaluate('18 ÷ 3 × 2')).toBe(12);
    expect(evaluate('2^3^2')).toBe(512);
    expect(evaluate('-2^2')).toBe(-4); // the usual school convention: -(2²)
    expect(evaluate('(-2)^2')).toBe(4);
  });
  it('handles fractions, decimals and negatives', () => {
    expect(evaluate('3/4 + 1/4')).toBe(1);
    expect(evaluate('1/2 + 1/3')).toBeCloseTo(5 / 6, 12);
    expect(evaluate('0.1 + 0.2')).toBeCloseTo(0.3, 12);
    expect(evaluate('-5 - (-3)')).toBe(-2);
    expect(evaluate('½ + ¼')).toBe(0.75);
  });
  it('refuses to guess on invalid or ambiguous input', () => {
    expect(evaluate('10/0')).toBeNull();
    expect(evaluate('(2+3')).toBeNull();
    expect(evaluate('1.2.3')).toBeNull();
    expect(evaluate('2 3')).toBeNull();
    expect(evaluate('5%')).toBeNull();
  });
  it('solves one-variable linear equations and rejects non-linear ones', () => {
    expect(solveLinear('3(x - 2) = x + 4')).toBe(5);
    expect(solveLinear('x/2 = 5')).toBe(10);
    expect(solveLinear('0.5x + 1.5 = 4')).toBe(5);
    expect(solveLinear('-x = 4')).toBe(-4);
    expect(solveLinear('x^2 = 4')).toBeNull();
    expect(solveLinear('2x = 2x + 1')).toBeNull();
  });
});

describe('grading student answers', () => {
  it('reads mixed numbers as a whole plus a fraction', () => {
    expect(parseNumericAnswer('2 1/2')).toBe(2.5);
    expect(parseNumericAnswer('-2 1/2')).toBe(-2.5);
    expect(gradeAnswer('NUMERIC', '5/2', '2 1/2')).toBe(true);
  });
  it('accepts roots, units and Indian digit grouping', () => {
    expect(parseNumericAnswer('sqrt(2)')).toBeCloseTo(Math.SQRT2, 12);
    expect(gradeAnswer('NUMERIC', '√2', 'sqrt(2)')).toBe(true);
    expect(parseNumericAnswer('12 cm')).toBe(12);
    expect(parseNumericAnswer('5 sq units')).toBe(5);
    expect(parseNumericAnswer('20 वर्ग सेमी')).toBe(20);
    expect(parseNumericAnswer('9 cm²')).toBe(9);
    expect(parseNumericAnswer('₹1,00,000')).toBe(100000);
  });
  it('does not accept common mistakes', () => {
    expect(gradeAnswer('NUMERIC', '-3', '3')).toBe(false); // sign error
    expect(gradeAnswer('NUMERIC', '1/3', '0.3')).toBe(false); // rounding too early
    expect(gradeAnswer('NUMERIC', '14', '20')).toBe(false); // (2+3)×4 instead of 2+3×4
    expect(gradeAnswer('NUMERIC', '23', '2 3')).toBe(false); // ambiguous input is not guessed
  });
});

describe('AI answer verification', () => {
  it('verifies fractions, negatives and linear claims', () => {
    expect(verifyCheck({ kind: 'arithmetic', expression: '1/2 + 1/3', claimed: '5/6' }).status).toBe('verified');
    expect(verifyCheck({ kind: 'arithmetic', expression: '-7 + 3', claimed: '-4' }).status).toBe('verified');
    expect(verifyCheck({ kind: 'linear', equation: '3(x-2) = x + 4', variable: 'x', claimed: 'x = 5' }).status).toBe('verified');
  });
  it('flags a wrong sign and leaves unverifiable claims unchecked', () => {
    const wrong = verifyCheck({ kind: 'arithmetic', expression: '-7 + 3', claimed: '4' });
    expect(wrong.status).toBe('mismatch');
    expect(wrong.computed).toBe(-4);
    expect(verifyCheck({ kind: 'arithmetic', expression: 'angle ABC', claimed: '60' }).status).toBe('unchecked');
    expect(verifyCheck({ kind: 'linear', equation: 'x^2 = 9', variable: 'x', claimed: '3' }).status).toBe('unchecked');
  });
});

/* ----------------------------------------------------------------- tutor */

const modelJson = (o: Record<string, unknown>) => JSON.stringify(o);

describe('tutor reply structure', () => {
  const full = {
    reply: 'चलो साथ में हल करते हैं।',
    understanding: 'हमें x का मान निकालना है।',
    hint: 'पहले 3 को दोनों तरफ़ से घटाइए।',
    explanation: 'समीकरण तराज़ू की तरह है।',
    steps: [
      { title: '3 घटाएँ', detail: '2x = 4' },
      { title: '2 से भाग दें', detail: 'x = 2' },
    ],
    finalAnswer: 'x = 2',
    followUp: '3x + 1 = 10 हल कीजिए।',
    confidence: 'high',
    caveat: null,
    check: { kind: 'linear', equation: '2x+3=7', variable: 'x', claimed: '2' },
  };

  it('keeps every section and verifies the final number', () => {
    const s = buildStructured(modelJson(full), 'solution', 'HI');
    expect(s.understanding).toBe(full.understanding);
    expect(s.explanation).toBe(full.explanation);
    expect(s.verification).toBe('verified');
    expect(s.outOfSyllabus).toBe(false);
  });

  it('renders the Hindi headings in the teaching order', () => {
    const text = renderPlain(buildStructured(modelJson(full), 'solution', 'HI'));
    const order = ['प्रश्न की समझ', 'पहला संकेत', 'आसान व्याख्या', 'चरण-दर-चरण हल', 'अंतिम उत्तर', 'अब आप कोशिश करें'].map((h) => text.indexOf(h));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('never gives the answer away on a hint request, not even through the calculator', () => {
    const wrongClaim = { ...full, check: { kind: 'arithmetic', expression: '2+3', claimed: '6' } };
    const s = buildStructured(modelJson(wrongClaim), 'hint', 'HI');
    expect(s.finalAnswer).toBeNull();
    expect(s.check).toBeNull();
    expect(s.computed).toBeUndefined();
    expect(s.steps.length).toBeLessThanOrEqual(1);
  });

  it('marks a calculator mismatch as low confidence with a warning', () => {
    const s = buildStructured(modelJson({ ...full, check: { kind: 'arithmetic', expression: '2+3', claimed: '6' } }), 'solution', 'HI');
    expect(s.verification).toBe('mismatch');
    expect(s.confidence).toBe('low');
    expect(s.caveat).toContain('भरोसा न करें');
  });

  it('keeps unparseable output as plain text, flagged as low confidence', () => {
    const s = buildStructured('Sorry, here is some text without JSON', 'solution', 'HI');
    expect(s.reply).toContain('Sorry');
    expect(s.confidence).toBe('low');
    expect(s.caveat).toBeTruthy();
  });

  it('passes through the out-of-syllabus flag', () => {
    const s = buildStructured(modelJson({ reply: 'यह कक्षा 9 से आगे का है।', steps: [], outOfSyllabus: true, confidence: 'high' }), 'explain', 'HI');
    expect(s.outOfSyllabus).toBe(true);
  });

  it('system prompt protects its instructions and uses the student\'s weak topics', () => {
    const p = systemPrompt({ language: 'HI', level: 'BASIC', learner: { classLevel: 9, stage: 'SECONDARY', board: 'JAC' }, weakTopics: ['Polynomials (25% correct)'] });
    expect(p).toMatch(/never reveal/i);
    expect(p).toMatch(/outOfSyllabus/);
    expect(p).toContain('Polynomials (25% correct)');
    expect(p).toMatch(/hint/);
  });
});

/* -------------------------------------------------------------- adaptive */

describe('adaptive question choice', () => {
  const q = (id: string, difficulty: number) => ({ id, difficulty });
  const pool = [q('a1', 1), q('b2', 2), q('c3', 3)];
  const now = new Date('2026-11-21T10:00:00Z');
  const ago = (min: number) => new Date(now.getTime() - min * 60_000);

  it('starts at the current level', () => {
    expect(pickQuestion(pool, 1, new Map(), now)!.question.id).toBe('a1');
    expect(pickQuestion(pool, 2, new Map(), now)!.question.id).toBe('b2');
  });

  it('does not repeat the question just answered wrongly', () => {
    const attempts = new Map<string, Attempt>([['a1', { at: ago(1), correct: false }]]);
    const pick = pickQuestion(pool, 1, attempts, now)!;
    expect(pick.question.id).not.toBe('a1');
    expect(pick.question.id).toBe('b2'); // nearest level, easier before harder
  });

  it('comes back to a wrong question once something else was tried', () => {
    const attempts = new Map<string, Attempt>([
      ['a1', { at: ago(5), correct: false }],
      ['b2', { at: ago(1), correct: false }],
    ]);
    expect(pickQuestion(pool, 1, attempts, now)!.question.id).toBe('a1');
  });

  it('skips questions solved in the last 6 hours, and is deterministic', () => {
    const attempts = new Map<string, Attempt>([['a1', { at: ago(30), correct: true }]]);
    const first = pickQuestion(pool, 1, attempts, now)!.question.id;
    for (let i = 0; i < 5; i++) expect(pickQuestion(pool, 1, attempts, now)!.question.id).toBe(first);
    expect(first).not.toBe('a1');
  });

  it('reports when every question was solved recently', () => {
    const attempts = new Map<string, Attempt>([
      ['a1', { at: ago(30), correct: true }],
      ['b2', { at: ago(20), correct: true }],
      ['c3', { at: ago(10), correct: true }],
    ]);
    const pick = pickQuestion(pool, 2, attempts, now)!;
    expect(pick.allRecentlySolved).toBe(true);
    expect(pick.question.id).toBe('a1'); // least recently answered
  });

  it('moves difficulty only after two answers in a row, never randomly', () => {
    let s = { attempts: 0, correct: 0, mastery: 0, currentDifficulty: 2, streak: 0 };
    s = nextProgress(s, true, 2);
    expect(s.currentDifficulty).toBe(2);
    s = nextProgress(s, false, 2);
    expect(s.currentDifficulty).toBe(2); // a mixed pair changes nothing
    s = nextProgress(s, false, 2);
    expect(s.currentDifficulty).toBe(1); // two wrong in a row: easier
    s = nextProgress(nextProgress(s, true, 1), true, 1);
    expect(s.currentDifficulty).toBe(2); // two right in a row: harder
  });
});

/* ------------------------------------------------------------ sync + API */

describe('offline sync is atomic per record', () => {
  let studentId = '';
  beforeAll(async () => {
    const u = await userRepository.create({ username: `${prefix}_atom`, passwordHash: 'x', role: 'STUDENT', displayName: 'S', preferredLanguage: 'HI', linkCode: `A${Date.now().toString(36).slice(-5).toUpperCase()}` });
    studentId = u.student!.id;
  });

  it('a database blip mid-record stores nothing, and the retry stores the answer once', async () => {
    const q = (await db.query.questions.findFirst({ where: eq(questions.type, 'NUMERIC') }))!;
    const rec = { clientId: `${prefix}-atomic-1`, kind: 'answer' as const, createdAt: new Date().toISOString(), payload: { questionId: q.id, answer: q.correctAnswer } };
    const blip = Object.assign(new Error('fetch failed'), { cause: { code: 'ECONNRESET' } });
    const spy = vi.spyOn(learningRepository, 'upsertProgress').mockRejectedValueOnce(blip);

    const first = await syncService.apply(studentId, [rec]);
    expect(first.retry).toBe(1);
    expect(await db.select().from(studentAnswers).where(eq(studentAnswers.studentId, studentId))).toHaveLength(0);
    expect(await db.select().from(syncRecords).where(eq(syncRecords.studentId, studentId))).toHaveLength(0);

    spy.mockRestore();
    const second = await syncService.apply(studentId, [rec]);
    expect(second.applied).toBe(1);
    expect(await db.select().from(studentAnswers).where(eq(studentAnswers.studentId, studentId))).toHaveLength(1);
  });
});

describe('account isolation on a shared phone', () => {
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
    return { token: res.body.accessToken as string, user: res.body.user };
  }
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  let a: Awaited<ReturnType<typeof register>>;
  let b: Awaited<ReturnType<typeof register>>;
  let parent: Awaited<ReturnType<typeof register>>;
  let teacher: Awaited<ReturnType<typeof register>>;
  let convId = '';
  const secret = 'मेरा निजी सवाल 7x+2=16';

  beforeAll(async () => {
    a = await register('STUDENT', 'iso_a');
    b = await register('STUDENT', 'iso_b');
    parent = await register('PARENT', 'iso_p');
    teacher = await register('TEACHER', 'iso_t');
    const conv = await request(app).post('/api/tutor/conversations').set(auth(a.token)).send({});
    convId = conv.body.id;
    await request(app).post(`/api/tutor/conversations/${convId}/messages`).set(auth(a.token)).send({ content: secret, intent: 'hint' });
    const q = await db.query.questions.findFirst({ where: eq(questions.type, 'NUMERIC') });
    await request(app).post('/api/practice/answer').set(auth(a.token)).send({ questionId: q!.id, answer: '999999' });
  });

  it("a second student cannot open or delete the first student's tutor chat", async () => {
    expect((await request(app).get(`/api/tutor/conversations/${convId}`).set(auth(b.token))).status).toBe(404);
    expect((await request(app).delete(`/api/tutor/conversations/${convId}`).set(auth(b.token))).status).toBe(404);
    const list = await request(app).get('/api/tutor/conversations').set(auth(b.token));
    expect(JSON.stringify(list.body)).not.toContain(convId);
  });

  it("a second student's dashboard and progress never show the first student's data", async () => {
    const mine = await request(app).get('/api/progress/me').set(auth(b.token));
    expect(mine.status).toBe(200);
    expect(JSON.stringify(mine.body)).not.toContain('999999');
    const activity = await request(app).get('/api/progress/me/activity').set(auth(b.token));
    expect(JSON.stringify(activity.body)).not.toContain('999999');
  });

  it('a linked parent sees progress but never the tutor conversation', async () => {
    const link = await request(app).post('/api/parents/link').set(auth(parent.token)).send({ code: a.user.student.linkCode });
    expect(link.status).toBe(201);
    const report = await request(app).get(`/api/parents/students/${a.user.student.id}/report`).set(auth(parent.token));
    expect(report.status).toBe(200);
    expect(JSON.stringify(report.body)).not.toContain(secret);
    expect((await request(app).get('/api/tutor/conversations').set(auth(parent.token))).status).toBe(403);
    expect((await request(app).get(`/api/tutor/conversations/${convId}`).set(auth(parent.token))).status).toBe(403);
  });

  it('a teacher sees only students who shared a code, and loses access after unlinking', async () => {
    const sid = a.user.student.id;
    expect((await request(app).get(`/api/parents/students/${sid}/report`).set(auth(teacher.token))).status).toBe(404);
    expect((await request(app).post('/api/parents/link').set(auth(teacher.token)).send({ code: 'ZZZZZZ' })).status).toBeGreaterThanOrEqual(400);
    await request(app).post('/api/parents/link').set(auth(teacher.token)).send({ code: a.user.student.linkCode });
    expect((await request(app).get(`/api/parents/students/${sid}/report`).set(auth(teacher.token))).status).toBe(200);
    expect((await request(app).delete(`/api/parents/students/${sid}`).set(auth(teacher.token))).status).toBeLessThan(300);
    expect((await request(app).get(`/api/parents/students/${sid}/report`).set(auth(teacher.token))).status).toBe(404);
  });

  it('a wrong practice answer makes the next question a different one', async () => {
    const first = await request(app).get('/api/practice/next?topic=rational-and-irrational').set(auth(b.token));
    expect(first.status).toBe(200);
    const q1 = first.body.question.id;
    await request(app).post('/api/practice/answer').set(auth(b.token)).send({ questionId: q1, answer: '-123456' });
    const second = await request(app).get('/api/practice/next?topic=rational-and-irrational').set(auth(b.token));
    expect(second.body.question.id).not.toBe(q1);
  });
});
