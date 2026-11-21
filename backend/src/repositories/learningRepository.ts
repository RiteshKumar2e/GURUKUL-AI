import type { AnswerOrigin, Prisma, RecommendationKind, SessionType } from '@prisma/client';
import { prisma } from '../config/prisma';

export const learningRepository = {
  progressFor: (studentId: string, topicId: string) =>
    prisma.learningProgress.findUnique({ where: { studentId_topicId: { studentId, topicId } } }),

  upsertProgress: (studentId: string, topicId: string, data: Omit<Prisma.LearningProgressUncheckedCreateInput, 'studentId' | 'topicId'>) =>
    prisma.learningProgress.upsert({
      where: { studentId_topicId: { studentId, topicId } },
      create: { studentId, topicId, ...data },
      update: data,
    }),

  allProgress: (studentId: string) =>
    prisma.learningProgress.findMany({
      where: { studentId },
      include: { topic: { select: { id: true, slug: true, titleHi: true, titleEn: true, chapter: { select: { slug: true, number: true, nameHi: true, nameEn: true } } } } },
    }),

  createAnswer: (data: {
    studentId: string;
    questionId: string;
    sessionId?: string | null;
    answer: string;
    isCorrect: boolean;
    difficulty: number;
    timeTakenSec?: number | null;
    origin?: AnswerOrigin;
    answeredAt?: Date;
  }) => prisma.studentAnswer.create({ data }),

  recentAnswers: (studentId: string, take = 20) =>
    prisma.studentAnswer.findMany({
      where: { studentId },
      orderBy: { answeredAt: 'desc' },
      take,
      include: { question: { select: { slug: true, promptHi: true, promptEn: true, topic: { select: { slug: true, titleHi: true, titleEn: true } } } } },
    }),

  recentCorrectQuestionIds: async (studentId: string, topicId: string, since: Date) => {
    const rows = await prisma.studentAnswer.findMany({
      where: { studentId, isCorrect: true, answeredAt: { gte: since }, question: { topicId } },
      select: { questionId: true },
    });
    return new Set(rows.map((r) => r.questionId));
  },

  answersSince: (studentId: string, since: Date) =>
    prisma.studentAnswer.findMany({ where: { studentId, answeredAt: { gte: since } }, select: { answeredAt: true, isCorrect: true } }),

  countAnswers: (studentId: string) =>
    prisma.studentAnswer.groupBy({ by: ['isCorrect'], where: { studentId }, _count: { _all: true } }),

  createSession: (data: { studentId: string; type: SessionType; chapterId?: string; topicId?: string; assessmentId?: string }) =>
    prisma.learningSession.create({ data }),
  findSession: (id: string) => prisma.learningSession.findUnique({ where: { id } }),
  endSession: (id: string, score?: number, total?: number) =>
    prisma.learningSession.update({ where: { id }, data: { endedAt: new Date(), score, total } }),

  recentSessions: (studentId: string, take = 15) =>
    prisma.learningSession.findMany({
      where: { studentId },
      orderBy: { startedAt: 'desc' },
      take,
      include: {
        topic: { select: { slug: true, titleHi: true, titleEn: true } },
        chapter: { select: { slug: true, nameHi: true, nameEn: true } },
        assessment: { select: { slug: true, titleHi: true, titleEn: true } },
      },
    }),

  activeRecommendations: (studentId: string) =>
    prisma.adaptiveRecommendation.findMany({
      where: { studentId, status: 'ACTIVE' },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      include: { topic: { select: { slug: true, titleHi: true, titleEn: true, chapter: { select: { slug: true, number: true, nameHi: true, nameEn: true } } } } },
    }),

  replaceRecommendations: (studentId: string, recs: Array<{ topicId: string; kind: RecommendationKind; reasonHi: string; reasonEn: string; priority: number }>) =>
    prisma.$transaction([
      prisma.adaptiveRecommendation.updateMany({ where: { studentId, status: 'ACTIVE' }, data: { status: 'DONE' } }),
      prisma.adaptiveRecommendation.createMany({ data: recs.map((r) => ({ ...r, studentId })) }),
    ]),

  dismissRecommendation: (studentId: string, id: string) =>
    prisma.adaptiveRecommendation.updateMany({ where: { id, studentId }, data: { status: 'DISMISSED' } }),
};
