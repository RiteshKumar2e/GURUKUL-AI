/**
 * Seeds editable curriculum content from backend/content/class9-maths.json and creates
 * SYNTHETIC demo accounts. No real student data is used anywhere.
 *
 *   npm run db:seed            (SEED_DEMO=false skips the demo accounts)
 *
 * Safe to re-run: content is upserted by slug; only the three demo accounts are replaced.
 * It never touches other users' data.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { eq, inArray, sql } from 'drizzle-orm';
import { db, closeDatabase, checkDatabase } from '../src/db/client';
import {
  assessmentQuestions,
  assessments,
  chapters,
  learningProgress,
  learningSessions,
  lessons,
  questions,
  studentAnswers,
  studentParents,
  studentProfiles,
  studentTeachers,
  subjects,
  topics,
  users,
  type LessonBlock,
  type QuestionOption,
  type QuestionType,
} from '../src/db/schema';
import { userRepository } from '../src/repositories/userRepository';
import { adaptiveService, nextProgress, type ProgressState } from '../src/services/adaptive-learning/adaptiveService';

interface ContentFile {
  subject: { slug: string; nameHi: string; nameEn: string; classLevel: number; board: string };
  meta: { curriculumVerification: { note: string } };
  chapters: Array<{
    number: number;
    slug: string;
    nameHi: string;
    nameEn: string;
    summaryHi: string;
    summaryEn: string;
    topics: Array<{
      slug: string;
      titleHi: string;
      titleEn: string;
      summaryHi: string;
      summaryEn: string;
      lesson: { estMinutes: number; blocks: LessonBlock[] };
      questions: Array<{
        slug: string;
        type: QuestionType;
        difficulty: number;
        promptHi: string;
        promptEn: string;
        options?: QuestionOption[];
        answer: string;
        hintHi: string;
        hintEn: string;
        explHi: string;
        explEn: string;
      }>;
    }>;
  }>;
}

const excluded = (cols: string[]) => Object.fromEntries(cols.map((c) => [c, sql.raw(`excluded.${c.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase())}`)]));

async function seedContent() {
  const file = path.resolve(__dirname, '../content/class9-maths.json');
  const content = JSON.parse(fs.readFileSync(file, 'utf8')) as ContentFile;
  const sourceNote = content.meta.curriculumVerification.note;

  const [subject] = await db
    .insert(subjects)
    .values({ ...content.subject, sourceNote })
    .onConflictDoUpdate({ target: subjects.slug, set: { ...content.subject, sourceNote } })
    .returning();

  let lessonCount = 0;
  let questionCount = 0;
  for (const ch of content.chapters) {
    const chapterData = { number: ch.number, nameHi: ch.nameHi, nameEn: ch.nameEn, summaryHi: ch.summaryHi, summaryEn: ch.summaryEn };
    const [chapter] = await db
      .insert(chapters)
      .values({ subjectId: subject.id, slug: ch.slug, source: 'ORIGINAL_SAMPLE', ...chapterData })
      .onConflictDoUpdate({ target: chapters.slug, set: chapterData })
      .returning();

    const chapterQuestionIds: string[] = [];
    for (const [i, t] of ch.topics.entries()) {
      const topicData = { chapterId: chapter.id, order: i + 1, titleHi: t.titleHi, titleEn: t.titleEn, summaryHi: t.summaryHi, summaryEn: t.summaryEn };
      const [topic] = await db.insert(topics).values({ slug: t.slug, ...topicData }).onConflictDoUpdate({ target: topics.slug, set: topicData }).returning();

      const lessonData = { titleHi: t.titleHi, titleEn: t.titleEn, content: t.lesson.blocks, estMinutes: t.lesson.estMinutes };
      await db
        .insert(lessons)
        .values({ topicId: topic.id, slug: `${t.slug}-lesson`, source: 'ORIGINAL_SAMPLE', ...lessonData })
        .onConflictDoUpdate({ target: lessons.slug, set: { ...lessonData, updatedAt: new Date() } });
      lessonCount++;

      // One multi-row upsert per topic keeps round trips low on a remote database
      const rows = t.questions.map((q) => ({
        slug: q.slug,
        topicId: topic.id,
        type: q.type,
        difficulty: q.difficulty,
        promptHi: q.promptHi,
        promptEn: q.promptEn,
        options: q.options ?? null,
        correctAnswer: q.answer,
        hintHi: q.hintHi,
        hintEn: q.hintEn,
        explanationHi: q.explHi,
        explanationEn: q.explEn,
        source: 'ORIGINAL_SAMPLE' as const,
      }));
      if (rows.length) {
        const saved = await db
          .insert(questions)
          .values(rows)
          .onConflictDoUpdate({
            target: questions.slug,
            set: excluded(['topicId', 'type', 'difficulty', 'promptHi', 'promptEn', 'options', 'correctAnswer', 'hintHi', 'hintEn', 'explanationHi', 'explanationEn']),
          })
          .returning({ id: questions.id, slug: questions.slug });
        const bySlug = new Map(saved.map((r) => [r.slug, r.id]));
        t.questions.forEach((q) => chapterQuestionIds.push(bySlug.get(q.slug)!));
        questionCount += rows.length;
      }
    }

    const quizSlug = `${ch.slug}-quiz`;
    const titles = { titleHi: `${ch.nameHi} — अध्याय परीक्षा`, titleEn: `${ch.nameEn} — chapter quiz` };
    const [assessment] = await db
      .insert(assessments)
      .values({ chapterId: chapter.id, slug: quizSlug, durationMinutes: 15, ...titles })
      .onConflictDoUpdate({ target: assessments.slug, set: titles })
      .returning();
    await db.transaction(async (tx) => {
      await tx.delete(assessmentQuestions).where(eq(assessmentQuestions.assessmentId, assessment.id));
      if (chapterQuestionIds.length) await tx.insert(assessmentQuestions).values(chapterQuestionIds.map((questionId, order) => ({ assessmentId: assessment.id, questionId, order })));
    });
  }
  console.log(`Content: ${content.chapters.length} chapters, ${lessonCount} lessons, ${questionCount} questions`);
}

/** Deterministic pseudo-random so the demo history is the same on every seed. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const DEMO = ['demo.student', 'demo.parent', 'demo.teacher'];

async function seedDemoAccounts() {
  const passwordHash = await bcrypt.hash('Demo@1234', 12);

  // Replace only the three demo accounts (and their data) so re-seeding stays clean
  const old = await db.select({ id: users.id }).from(users).where(inArray(users.username, DEMO));
  for (const u of old) await userRepository.delete(u.id);

  const student = await userRepository.create({ username: 'demo.student', passwordHash, role: 'STUDENT', displayName: 'रिया (डेमो)', preferredLanguage: 'HI', linkCode: 'DEMO26' });
  const parent = await userRepository.create({ username: 'demo.parent', email: 'parent@example.com', passwordHash, role: 'PARENT', displayName: 'Demo Parent', preferredLanguage: 'HI' });
  const teacher = await userRepository.create({ username: 'demo.teacher', email: 'teacher@example.com', passwordHash, role: 'TEACHER', displayName: 'Demo Teacher', preferredLanguage: 'EN', schoolName: 'Demo School (synthetic)' });
  const sid = student.student!.id;
  await db.update(studentProfiles).set({ district: 'Ranchi', onboardingDone: true, teachingLevel: 'STANDARD', dailyGoalMinutes: 20 }).where(eq(studentProfiles.id, sid));
  await db.insert(studentParents).values({ studentId: sid, parentId: parent.parent!.id });
  await db.insert(studentTeachers).values({ studentId: sid, teacherId: teacher.teacher!.id });

  // Synthetic learning history over the past days: strong in chapter 1, weak in chapter 2
  const chapterRows = await db.select({ id: chapters.id, number: chapters.number }).from(chapters).where(inArray(chapters.number, [1, 2, 3]));
  const chapterNumber = new Map(chapterRows.map((c) => [c.id, c.number]));
  const topicRows = (
    await db.query.topics.findMany({
      where: inArray(
        topics.chapterId,
        chapterRows.map((c) => c.id),
      ),
      with: { questions: true },
    })
  ).sort((a, b) => chapterNumber.get(a.chapterId)! - chapterNumber.get(b.chapterId)! || a.order - b.order);
  const skill: Record<number, number> = { 1: 0.85, 2: 0.35, 3: 0.65 };
  const rand = rng(42);
  const now = Date.now();

  for (const [ti, topic] of topicRows.entries()) {
    const num = chapterNumber.get(topic.chapterId)!;
    let s: ProgressState = { attempts: 0, correct: 0, mastery: 0, currentDifficulty: 1, streak: 0 };
    const lessonAt = new Date(now - (topicRows.length - ti) * 24 * 3600_000); // ends yesterday
    const [session] = await db
      .insert(learningSessions)
      .values({ studentId: sid, type: 'PRACTICE', topicId: topic.id, chapterId: topic.chapterId, startedAt: lessonAt, endedAt: new Date(lessonAt.getTime() + 15 * 60_000) })
      .returning();
    const rounds = 4 + Math.floor(rand() * 3);
    const answerRows = [];
    for (let r = 0; r < rounds; r++) {
      const pool = topic.questions.filter((q) => q.difficulty === s.currentDifficulty);
      const q = pool[Math.floor(rand() * pool.length)] ?? topic.questions[0];
      const correct = rand() < skill[num] - (q.difficulty - 1) * 0.1;
      answerRows.push({
        studentId: sid,
        questionId: q.id,
        sessionId: session.id,
        answer: correct ? q.correctAnswer : 'demo-wrong',
        isCorrect: correct,
        difficulty: q.difficulty,
        timeTakenSec: 40 + Math.floor(rand() * 80),
        answeredAt: new Date(lessonAt.getTime() + (r + 1) * 2 * 60_000),
      });
      s = nextProgress(s, correct, q.difficulty);
    }
    await db.insert(studentAnswers).values(answerRows);
    await db
      .insert(learningProgress)
      .values({ studentId: sid, topicId: topic.id, ...s, lessonCompletedAt: num !== 2 ? lessonAt : null, lastActivityAt: new Date(lessonAt.getTime() + rounds * 2 * 60_000) });
  }
  console.log('Demo accounts (synthetic): demo.student / demo.parent / demo.teacher — password Demo@1234');
  return sid;
}

async function main() {
  const health = await checkDatabase();
  if (!health.ok) throw new Error(`Database not reachable (${health.location}): ${health.error}`);
  if (!health.migrated) throw new Error('Tables are missing. Run `npm run db:migrate` first.');
  await seedContent();
  if (process.env.SEED_DEMO !== 'false') {
    const sid = await seedDemoAccounts();
    // Build initial recommendations for the demo student via the real service
    await adaptiveService.recompute(sid);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => closeDatabase());
