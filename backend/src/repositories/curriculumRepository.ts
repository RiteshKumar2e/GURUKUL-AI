import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client';
import { assessments, chapters, lessons, questions, subjects, topics } from '../db/schema';
import { cachedContent } from '../utils/contentCache';

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

const published = { where: eq(lessons.isPublished, true) } as const;

/** Replaces a fetched child id list with a Prisma-style `_count`. */
function withCount<T extends { questions: unknown[] }>(row: T): Omit<T, 'questions'> & { _count: { questions: number } } {
  const { questions: q, ...rest } = row;
  return { ...rest, _count: { questions: q.length } };
}

const repository = {
  subjects: async () => {
    const rows = await db.query.subjects.findMany({
      with: { chapters: { orderBy: (c, { asc }) => [asc(c.number)], with: { topics: { columns: { id: true } } } } },
    });
    return rows.map((s) => ({ ...s, chapters: s.chapters.map(({ topics: t, ...c }) => ({ ...c, _count: { topics: t.length } })) }));
  },

  /** Chapters of the given subjects (all subjects when `subjectIds` is undefined). */
  chapters: async (subjectIds?: string[]) => {
    if (subjectIds && !subjectIds.length) return [];
    const rows = await db.query.chapters.findMany({
      where: subjectIds ? inArray(chapters.subjectId, subjectIds) : undefined,
      orderBy: (c, { asc }) => [asc(c.number)],
      with: {
        topics: { orderBy: (t, { asc }) => [asc(t.order)], columns: { id: true, slug: true, titleHi: true, titleEn: true }, with: { questions: { columns: { id: true } } } },
        assessments: { columns: { slug: true } },
        subject: { columns: { slug: true, nameHi: true, nameEn: true, order: true } },
      },
    });
    return rows.map((c) => ({ ...c, topics: c.topics.map(withCount) }));
  },

  chapterBySlug: async (slug: string) => {
    const c = await db.query.chapters.findFirst({
      where: eq(chapters.slug, slug),
      with: {
        subject: true,
        topics: {
          orderBy: (t, { asc }) => [asc(t.order)],
          with: { lessons: { ...published, columns: { id: true, estMinutes: true } }, questions: { columns: { id: true } } },
        },
        assessments: { with: { questions: { columns: { questionId: true } } } },
      },
    });
    if (!c) return null;
    return { ...c, topics: c.topics.map(withCount), assessments: c.assessments.map(withCount) };
  },

  topicBySlug: async (slug: string) => {
    const t = await db.query.topics.findFirst({
      where: eq(topics.slug, slug),
      with: {
        chapter: { columns: { id: true, slug: true, number: true, nameHi: true, nameEn: true } },
        lessons: { ...published, orderBy: (l, { desc }) => [desc(l.version)] },
        questions: { columns: { id: true } },
      },
    });
    return t ? withCount(t) : null;
  },

  topicById: async (id: string) => (await db.query.topics.findFirst({ where: eq(topics.id, id), with: { lessons: published, chapter: true } })) ?? null,

  siblingsOf: (chapterId: string) =>
    db.query.topics.findMany({ where: eq(topics.chapterId, chapterId), orderBy: (t, { asc }) => [asc(t.order)], columns: { slug: true, titleHi: true, titleEn: true, order: true } }),

  questionsForTopic: (topicId: string, difficulty?: number) =>
    db.query.questions.findMany({ where: difficulty ? and(eq(questions.topicId, topicId), eq(questions.difficulty, difficulty)) : eq(questions.topicId, topicId), columns: questionPublic }),

  questionById: async (id: string) =>
    (await db.query.questions.findFirst({ where: eq(questions.id, id), with: { topic: { columns: { id: true, slug: true, titleHi: true, titleEn: true, chapterId: true } } } })) ?? null,
  questionBySlug: async (slug: string) => (await db.query.questions.findFirst({ where: eq(questions.slug, slug) })) ?? null,
  questionsByIds: (ids: string[]) => (ids.length ? db.query.questions.findMany({ where: inArray(questions.id, ids) }) : Promise.resolve([])),

  /** Full content for offline packs (includes answers so practice can be graded offline). */
  chapterOfflinePack: async (slug: string) =>
    (await db.query.chapters.findFirst({
      where: eq(chapters.slug, slug),
      with: { topics: { orderBy: (t, { asc }) => [asc(t.order)], with: { lessons: published, questions: true } } },
    })) ?? null,

  assessments: async (subjectIds?: string[]) => {
    const rows = await db.query.assessments.findMany({
      with: { chapter: { columns: { slug: true, number: true, nameHi: true, nameEn: true, subjectId: true } }, questions: { columns: { questionId: true } } },
    });
    return rows
      .filter((a) => !subjectIds || subjectIds.includes(a.chapter.subjectId))
      .map(withCount)
      .sort((a, b) => a.chapter.number - b.chapter.number);
  },

  assessmentBySlug: async (slug: string) =>
    (await db.query.assessments.findFirst({
      where: eq(assessments.slug, slug),
      with: {
        chapter: { columns: { id: true, slug: true, number: true, nameHi: true, nameEn: true } },
        questions: { orderBy: (q, { asc }) => [asc(q.order)], with: { question: { columns: questionPublic } } },
      },
    })) ?? null,

  assessmentById: async (id: string) =>
    (await db.query.assessments.findFirst({ where: eq(assessments.id, id), with: { questions: { orderBy: (q, { asc }) => [asc(q.order)] } } })) ?? null,

  /** Every topic in course order (chapter number, then topic order). */
  /** Topics in curriculum order, limited to the given subjects when `subjectIds` is set. */
  allTopics: async (subjectIds?: string[]) => {
    const rows = await db.query.topics.findMany({ with: { chapter: { columns: { number: true, slug: true, nameHi: true, nameEn: true, subjectId: true } } } });
    return rows
      .filter((t) => !subjectIds || subjectIds.includes(t.chapter.subjectId))
      .sort((a, b) => a.chapter.number - b.chapter.number || a.order - b.order);
  },

  subjectBySlug: async (slug: string) => (await db.query.subjects.findFirst({ where: eq(subjects.slug, slug) })) ?? null,
};

/**
 * Curriculum content only changes when the seed runs on deploy, so every read is served from the
 * in-memory content cache (see utils/contentCache). Student data is never read through here.
 */
export const curriculumRepository = Object.fromEntries(
  Object.entries(repository).map(([name, fn]) => [name, cachedContent(`curriculum.${name}`, fn as (...a: unknown[]) => Promise<unknown>)]),
) as unknown as typeof repository;
