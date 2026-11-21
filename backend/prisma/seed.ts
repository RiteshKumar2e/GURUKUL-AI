/**
 * Seeds editable curriculum content from backend/content/class9-maths.json and
 * creates SYNTHETIC demo accounts. No real student data is used anywhere.
 *
 *   npm run db:seed
 */
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { PrismaClient, Prisma, QuestionType } from '@prisma/client';
import { nextProgress, type ProgressState } from '../src/services/adaptive-learning/adaptiveService';

const prisma = new PrismaClient();

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
      lesson: { estMinutes: number; blocks: unknown[] };
      questions: Array<{
        slug: string;
        type: QuestionType;
        difficulty: number;
        promptHi: string;
        promptEn: string;
        options?: unknown[];
        answer: string;
        hintHi: string;
        hintEn: string;
        explHi: string;
        explEn: string;
      }>;
    }>;
  }>;
}

async function seedContent() {
  const file = path.resolve(__dirname, '../content/class9-maths.json');
  const content = JSON.parse(fs.readFileSync(file, 'utf8')) as ContentFile;

  const subject = await prisma.subject.upsert({
    where: { slug: content.subject.slug },
    create: { ...content.subject, sourceNote: content.meta.curriculumVerification.note },
    update: { ...content.subject, sourceNote: content.meta.curriculumVerification.note },
  });

  let lessons = 0;
  let questions = 0;
  for (const ch of content.chapters) {
    const chapter = await prisma.chapter.upsert({
      where: { slug: ch.slug },
      create: { subjectId: subject.id, slug: ch.slug, number: ch.number, nameHi: ch.nameHi, nameEn: ch.nameEn, summaryHi: ch.summaryHi, summaryEn: ch.summaryEn, source: 'ORIGINAL_SAMPLE' },
      update: { number: ch.number, nameHi: ch.nameHi, nameEn: ch.nameEn, summaryHi: ch.summaryHi, summaryEn: ch.summaryEn },
    });

    const chapterQuestionIds: string[] = [];
    for (const [i, t] of ch.topics.entries()) {
      const topic = await prisma.topic.upsert({
        where: { slug: t.slug },
        create: { chapterId: chapter.id, slug: t.slug, order: i + 1, titleHi: t.titleHi, titleEn: t.titleEn, summaryHi: t.summaryHi, summaryEn: t.summaryEn },
        update: { chapterId: chapter.id, order: i + 1, titleHi: t.titleHi, titleEn: t.titleEn, summaryHi: t.summaryHi, summaryEn: t.summaryEn },
      });
      await prisma.lesson.upsert({
        where: { slug: `${t.slug}-lesson` },
        create: { topicId: topic.id, slug: `${t.slug}-lesson`, titleHi: t.titleHi, titleEn: t.titleEn, content: t.lesson.blocks as Prisma.InputJsonValue, estMinutes: t.lesson.estMinutes, source: 'ORIGINAL_SAMPLE' },
        update: { titleHi: t.titleHi, titleEn: t.titleEn, content: t.lesson.blocks as Prisma.InputJsonValue, estMinutes: t.lesson.estMinutes },
      });
      lessons++;
      for (const q of t.questions) {
        const data = {
          topicId: topic.id,
          type: q.type,
          difficulty: q.difficulty,
          promptHi: q.promptHi,
          promptEn: q.promptEn,
          options: q.options ? (q.options as Prisma.InputJsonValue) : Prisma.JsonNull,
          correctAnswer: q.answer,
          hintHi: q.hintHi,
          hintEn: q.hintEn,
          explanationHi: q.explHi,
          explanationEn: q.explEn,
          source: 'ORIGINAL_SAMPLE' as const,
        };
        const question = await prisma.question.upsert({ where: { slug: q.slug }, create: { slug: q.slug, ...data }, update: data });
        chapterQuestionIds.push(question.id);
        questions++;
      }
    }

    const assessment = await prisma.assessment.upsert({
      where: { slug: `${ch.slug}-quiz` },
      create: { chapterId: chapter.id, slug: `${ch.slug}-quiz`, titleHi: `${ch.nameHi} — अध्याय परीक्षा`, titleEn: `${ch.nameEn} — chapter quiz`, durationMinutes: 15 },
      update: { titleHi: `${ch.nameHi} — अध्याय परीक्षा`, titleEn: `${ch.nameEn} — chapter quiz` },
    });
    await prisma.assessmentQuestion.deleteMany({ where: { assessmentId: assessment.id } });
    await prisma.assessmentQuestion.createMany({ data: chapterQuestionIds.map((questionId, order) => ({ assessmentId: assessment.id, questionId, order })) });
  }
  console.log(`Content: ${content.chapters.length} chapters, ${lessons} lessons, ${questions} questions`);
}

/** Deterministic pseudo-random so the demo history is the same on every seed. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

async function seedDemoAccounts() {
  const passwordHash = await bcrypt.hash('Demo@1234', 12);

  // Remove old demo data so re-seeding stays clean
  await prisma.user.deleteMany({ where: { username: { in: ['demo.student', 'demo.parent', 'demo.teacher'] } } });

  const student = await prisma.user.create({
    data: {
      username: 'demo.student',
      passwordHash,
      role: 'STUDENT',
      displayName: 'रिया (डेमो)',
      preferredLanguage: 'HI',
      student: { create: { linkCode: 'DEMO26', district: 'Ranchi', onboardingDone: true, teachingLevel: 'STANDARD', dailyGoalMinutes: 20 } },
    },
    include: { student: true },
  });
  const parent = await prisma.user.create({
    data: { username: 'demo.parent', email: 'parent@example.com', passwordHash, role: 'PARENT', displayName: 'Demo Parent', preferredLanguage: 'HI', parent: { create: {} } },
    include: { parent: true },
  });
  const teacher = await prisma.user.create({
    data: { username: 'demo.teacher', email: 'teacher@example.com', passwordHash, role: 'TEACHER', displayName: 'Demo Teacher', preferredLanguage: 'EN', teacher: { create: { schoolName: 'Demo School (synthetic)' } } },
    include: { teacher: true },
  });
  const sid = student.student!.id;
  await prisma.studentParent.create({ data: { studentId: sid, parentId: parent.parent!.id } });
  await prisma.studentTeacher.create({ data: { studentId: sid, teacherId: teacher.teacher!.id } });

  // Synthetic learning history over the past 6 days: strong in chapter 1, weak in chapter 2
  const topics = await prisma.topic.findMany({ where: { chapter: { number: { in: [1, 2, 3] } } }, include: { questions: true, chapter: true }, orderBy: [{ chapter: { number: 'asc' } }, { order: 'asc' }] });
  const skill: Record<number, number> = { 1: 0.85, 2: 0.35, 3: 0.65 };
  const rand = rng(42);
  const now = Date.now();

  for (const [ti, topic] of topics.entries()) {
    const state: ProgressState = { attempts: 0, correct: 0, mastery: 0, currentDifficulty: 1, streak: 0 };
    let s = state;
    const lessonAt = new Date(now - (topics.length - ti) * 24 * 3600_000); // ends yesterday
    const session = await prisma.learningSession.create({ data: { studentId: sid, type: 'PRACTICE', topicId: topic.id, chapterId: topic.chapterId, startedAt: lessonAt, endedAt: new Date(lessonAt.getTime() + 15 * 60_000) } });
    const rounds = 4 + Math.floor(rand() * 3);
    for (let r = 0; r < rounds; r++) {
      const pool = topic.questions.filter((q) => q.difficulty === s.currentDifficulty);
      const q = pool[Math.floor(rand() * pool.length)] ?? topic.questions[0];
      const correct = rand() < skill[topic.chapter.number] - (q.difficulty - 1) * 0.1;
      const answeredAt = new Date(lessonAt.getTime() + (r + 1) * 2 * 60_000);
      await prisma.studentAnswer.create({
        data: { studentId: sid, questionId: q.id, sessionId: session.id, answer: correct ? q.correctAnswer : 'demo-wrong', isCorrect: correct, difficulty: q.difficulty, timeTakenSec: 40 + Math.floor(rand() * 80), answeredAt },
      });
      s = nextProgress(s, correct, q.difficulty);
    }
    await prisma.learningProgress.create({
      data: { studentId: sid, topicId: topic.id, ...s, lessonCompletedAt: topic.chapter.number !== 2 ? lessonAt : null, lastActivityAt: new Date(lessonAt.getTime() + rounds * 2 * 60_000) },
    });
  }
  console.log('Demo accounts (synthetic): demo.student / demo.parent / demo.teacher — password Demo@1234');
}

async function main() {
  await seedContent();
  if (process.env.SEED_DEMO !== 'false') await seedDemoAccounts();
  // Build initial recommendations for the demo student via the real service
  const { adaptiveService } = await import('../src/services/adaptive-learning/adaptiveService');
  const demo = await prisma.studentProfile.findFirst({ where: { user: { username: 'demo.student' } } });
  if (demo) await adaptiveService.recompute(demo.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
