import { prisma } from '../config/prisma';

const questionPublic = {
  id: true,
  slug: true,
  type: true,
  difficulty: true,
  promptHi: true,
  promptEn: true,
  options: true,
  hintHi: true,
  hintEn: true,
  topicId: true,
} as const;

export const curriculumRepository = {
  subjects: () =>
    prisma.subject.findMany({
      include: { chapters: { orderBy: { number: 'asc' }, include: { _count: { select: { topics: true } } } } },
    }),

  chapters: () =>
    prisma.chapter.findMany({
      orderBy: { number: 'asc' },
      include: {
        topics: { orderBy: { order: 'asc' }, select: { id: true, slug: true, titleHi: true, titleEn: true, _count: { select: { questions: true } } } },
        assessments: { select: { slug: true } },
      },
    }),

  chapterBySlug: (slug: string) =>
    prisma.chapter.findUnique({
      where: { slug },
      include: {
        subject: true,
        topics: {
          orderBy: { order: 'asc' },
          include: { lessons: { where: { isPublished: true }, select: { id: true, estMinutes: true } }, _count: { select: { questions: true } } },
        },
        assessments: { include: { _count: { select: { questions: true } } } },
      },
    }),

  topicBySlug: (slug: string) =>
    prisma.topic.findUnique({
      where: { slug },
      include: {
        chapter: { select: { id: true, slug: true, number: true, nameHi: true, nameEn: true } },
        lessons: { where: { isPublished: true }, orderBy: { version: 'desc' } },
        _count: { select: { questions: true } },
      },
    }),

  topicById: (id: string) => prisma.topic.findUnique({ where: { id }, include: { lessons: { where: { isPublished: true } }, chapter: true } }),

  siblingsOf: (chapterId: string) =>
    prisma.topic.findMany({ where: { chapterId }, orderBy: { order: 'asc' }, select: { slug: true, titleHi: true, titleEn: true, order: true } }),

  questionsForTopic: (topicId: string, difficulty?: number) =>
    prisma.question.findMany({ where: { topicId, ...(difficulty ? { difficulty } : {}) }, select: questionPublic }),

  questionById: (id: string) => prisma.question.findUnique({ where: { id }, include: { topic: { select: { id: true, slug: true, titleHi: true, titleEn: true, chapterId: true } } } }),
  questionsByIds: (ids: string[]) => prisma.question.findMany({ where: { id: { in: ids } } }),

  /** Full content for offline packs (includes answers so practice can be graded offline). */
  chapterOfflinePack: (slug: string) =>
    prisma.chapter.findUnique({
      where: { slug },
      include: {
        topics: {
          orderBy: { order: 'asc' },
          include: { lessons: { where: { isPublished: true } }, questions: true },
        },
      },
    }),

  assessments: () =>
    prisma.assessment.findMany({
      orderBy: { chapter: { number: 'asc' } },
      include: { chapter: { select: { slug: true, number: true, nameHi: true, nameEn: true } }, _count: { select: { questions: true } } },
    }),

  assessmentBySlug: (slug: string) =>
    prisma.assessment.findUnique({
      where: { slug },
      include: {
        chapter: { select: { id: true, slug: true, number: true, nameHi: true, nameEn: true } },
        questions: { orderBy: { order: 'asc' }, include: { question: { select: questionPublic } } },
      },
    }),

  assessmentById: (id: string) =>
    prisma.assessment.findUnique({ where: { id }, include: { questions: { orderBy: { order: 'asc' } } } }),

  allTopics: () => prisma.topic.findMany({ include: { chapter: { select: { number: true, slug: true, nameHi: true, nameEn: true } } }, orderBy: [{ chapter: { number: 'asc' } }, { order: 'asc' }] }),
};
