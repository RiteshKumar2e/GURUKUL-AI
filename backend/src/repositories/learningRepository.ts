import { and, count, desc, eq, gte } from 'drizzle-orm';
import { db } from '../db/client';
import {
  adaptiveRecommendations,
  learningProgress,
  learningSessions,
  questions,
  studentAnswers,
  type AnswerOrigin,
  type RecommendationKind,
  type SessionType,
} from '../db/schema';

type ProgressFields = Partial<Omit<typeof learningProgress.$inferInsert, 'id' | 'studentId' | 'topicId'>>;

const recTopic = { columns: { slug: true, titleHi: true, titleEn: true }, with: { chapter: { columns: { slug: true, number: true, nameHi: true, nameEn: true } } } } as const;

export const learningRepository = {
  progressFor: async (studentId: string, topicId: string) =>
    (await db.query.learningProgress.findFirst({ where: and(eq(learningProgress.studentId, studentId), eq(learningProgress.topicId, topicId)) })) ?? null,

  /** Atomic insert-or-update on the (student, topic) unique index. */
  upsertProgress: async (studentId: string, topicId: string, data: ProgressFields) =>
    (
      await db
        .insert(learningProgress)
        .values({ studentId, topicId, ...data })
        .onConflictDoUpdate({ target: [learningProgress.studentId, learningProgress.topicId], set: data })
        .returning()
    )[0],

  allProgress: (studentId: string) =>
    db.query.learningProgress.findMany({
      where: eq(learningProgress.studentId, studentId),
      with: { topic: { columns: { id: true, slug: true, titleHi: true, titleEn: true }, with: { chapter: { columns: { slug: true, number: true, nameHi: true, nameEn: true } } } } },
    }),

  createAnswer: async (data: {
    studentId: string;
    questionId: string;
    sessionId?: string | null;
    answer: string;
    isCorrect: boolean;
    difficulty: number;
    timeTakenSec?: number | null;
    origin?: AnswerOrigin;
    answeredAt?: Date;
  }) => (await db.insert(studentAnswers).values(data).returning())[0],

  recentAnswers: (studentId: string, take = 20) =>
    db.query.studentAnswers.findMany({
      where: eq(studentAnswers.studentId, studentId),
      orderBy: (a, { desc }) => [desc(a.answeredAt)],
      limit: take,
      with: { question: { columns: { slug: true, promptHi: true, promptEn: true }, with: { topic: { columns: { slug: true, titleHi: true, titleEn: true } } } } },
    }),

  recentCorrectQuestionIds: async (studentId: string, topicId: string, since: Date) => {
    const rows = await db
      .select({ questionId: studentAnswers.questionId })
      .from(studentAnswers)
      .innerJoin(questions, eq(questions.id, studentAnswers.questionId))
      .where(and(eq(studentAnswers.studentId, studentId), eq(studentAnswers.isCorrect, true), gte(studentAnswers.answeredAt, since), eq(questions.topicId, topicId)));
    return new Set(rows.map((r) => r.questionId));
  },

  answersSince: (studentId: string, since: Date) =>
    db
      .select({ answeredAt: studentAnswers.answeredAt, isCorrect: studentAnswers.isCorrect })
      .from(studentAnswers)
      .where(and(eq(studentAnswers.studentId, studentId), gte(studentAnswers.answeredAt, since))),

  /** Same shape as Prisma's groupBy: [{ isCorrect, _count: { _all } }]. */
  countAnswers: async (studentId: string) => {
    const rows = await db
      .select({ isCorrect: studentAnswers.isCorrect, n: count() })
      .from(studentAnswers)
      .where(eq(studentAnswers.studentId, studentId))
      .groupBy(studentAnswers.isCorrect);
    return rows.map((r) => ({ isCorrect: r.isCorrect, _count: { _all: r.n } }));
  },

  createSession: async (data: { studentId: string; type: SessionType; chapterId?: string; topicId?: string; assessmentId?: string; startedAt?: Date; endedAt?: Date }) =>
    (await db.insert(learningSessions).values(data).returning())[0],
  findSession: async (id: string) => (await db.query.learningSessions.findFirst({ where: eq(learningSessions.id, id) })) ?? null,
  endSession: async (id: string, score?: number, total?: number) =>
    (await db.update(learningSessions).set({ endedAt: new Date(), score, total }).where(eq(learningSessions.id, id)).returning())[0],

  recentSessions: (studentId: string, take = 15) =>
    db.query.learningSessions.findMany({
      where: eq(learningSessions.studentId, studentId),
      orderBy: (s, { desc }) => [desc(s.startedAt)],
      limit: take,
      with: {
        topic: { columns: { slug: true, titleHi: true, titleEn: true } },
        chapter: { columns: { slug: true, nameHi: true, nameEn: true } },
        assessment: { columns: { slug: true, titleHi: true, titleEn: true } },
      },
    }),

  activeRecommendations: (studentId: string) =>
    db.query.adaptiveRecommendations.findMany({
      where: and(eq(adaptiveRecommendations.studentId, studentId), eq(adaptiveRecommendations.status, 'ACTIVE')),
      orderBy: [desc(adaptiveRecommendations.priority), desc(adaptiveRecommendations.createdAt)],
      with: { topic: recTopic },
    }),

  /** Retires the current active set and writes the new one in a single transaction. */
  replaceRecommendations: (studentId: string, recs: Array<{ topicId: string; kind: RecommendationKind; reasonHi: string; reasonEn: string; priority: number }>) =>
    db.transaction(async (tx) => {
      await tx
        .update(adaptiveRecommendations)
        .set({ status: 'DONE' })
        .where(and(eq(adaptiveRecommendations.studentId, studentId), eq(adaptiveRecommendations.status, 'ACTIVE')));
      if (recs.length) await tx.insert(adaptiveRecommendations).values(recs.map((r) => ({ ...r, studentId })));
    }),

  dismissRecommendation: (studentId: string, id: string) =>
    db
      .update(adaptiveRecommendations)
      .set({ status: 'DISMISSED' })
      .where(and(eq(adaptiveRecommendations.id, id), eq(adaptiveRecommendations.studentId, studentId))),
};
