/**
 * Classes 1-12: the catalogue a student picks from, and the student's own selection
 * (board, academic session, class, medium, stream, subjects).
 *
 * A student has one active selection. Changing it closes the old one (kept as history) and opens
 * a new one, so progress from an earlier class is never lost: progress is stored per topic, and
 * topics belong to that class's subjects.
 */
import fs from 'fs';
import path from 'path';
import { cachedContent, forgetContent, STUDENT_TTL_MS } from '../../utils/contentCache';
import { and, asc, count, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  academicSessions,
  boards,
  chapters,
  classLevels,
  studentCurricula,
  studentProfiles,
  studentSubjects,
  subjects,
  topics,
  type Language,
  type SchoolStage,
  type Stream,
} from '../../db/schema';
import { badRequest, notFound } from '../../utils/errors';

let streamsCache: Record<Stream, string[]> | null = null;
/** Suggested subject keys per stream (from backend/content/curriculum-catalog.json). */
export function streamSuggestions(): Record<Stream, string[]> {
  if (!streamsCache) {
    const file = path.resolve(__dirname, '../../../content/curriculum-catalog.json');
    streamsCache = (JSON.parse(fs.readFileSync(file, 'utf8')) as { streams: Record<Stream, string[]> }).streams;
  }
  return streamsCache;
}

export function stageOf(classLevel: number): SchoolStage {
  if (classLevel <= 5) return 'PRIMARY';
  if (classLevel <= 8) return 'MIDDLE';
  if (classLevel <= 10) return 'SECONDARY';
  return 'SENIOR_SECONDARY';
}

const subjectColumns = {
  id: true,
  slug: true,
  nameHi: true,
  nameEn: true,
  classLevel: true,
  subjectKey: true,
  verification: true,
  sourceUrl: true,
  books: true,
  chapterCount: true,
  order: true,
} as const;

/** Subjects of one class, with how much learning material each has (chapters, topics). */
async function subjectsWithContent(where: ReturnType<typeof and>) {
  const rows = await db.query.subjects.findMany({ where, columns: subjectColumns, orderBy: [asc(subjects.order), asc(subjects.nameEn)] });
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const chapterCounts = await db
    .select({ subjectId: chapters.subjectId, n: count() })
    .from(chapters)
    .where(inArray(chapters.subjectId, ids))
    .groupBy(chapters.subjectId);
  const topicCounts = await db
    .select({ subjectId: chapters.subjectId, n: count() })
    .from(topics)
    .innerJoin(chapters, eq(chapters.id, topics.chapterId))
    .where(inArray(chapters.subjectId, ids))
    .groupBy(chapters.subjectId);
  const ch = new Map(chapterCounts.map((c) => [c.subjectId, c.n]));
  const tp = new Map(topicCounts.map((c) => [c.subjectId, c.n]));
  return rows.map((r) => ({ ...r, chaptersListed: ch.get(r.id) ?? 0, hasLessons: (tp.get(r.id) ?? 0) > 0 }));
}

export interface CurriculumInput {
  board: string;
  session: string;
  classLevel: number;
  medium: Language;
  stream?: Stream | null;
  subjects: string[];
}

export const catalogService = {
  /** Everything the onboarding form needs before a class is chosen. */
  options: cachedContent('catalog.options', async () => {
    const [b, s, c] = await Promise.all([
      db.select().from(boards).orderBy(asc(boards.order)),
      db.select().from(academicSessions).orderBy(asc(academicSessions.code)),
      db.select().from(classLevels).orderBy(asc(classLevels.level)),
    ]);
    return {
      boards: b.map((x) => ({ code: x.code, nameHi: x.nameHi, nameEn: x.nameEn, state: x.state, basis: x.basis, status: x.status, noteHi: x.noteHi, noteEn: x.noteEn, sourceUrl: x.sourceUrl, available: x.status !== 'NOT_AVAILABLE' })),
      sessions: s.map((x) => ({ code: x.code, isCurrent: x.isCurrent, noteHi: x.noteHi, noteEn: x.noteEn })).reverse(),
      classes: c.map((x) => ({ level: x.level, stage: x.stage, nameHi: x.nameHi, nameEn: x.nameEn })),
      streams: streamSuggestions(),
    };
  }),

  /** Subjects that exist for this board, session and class. Empty when none are listed. */
  subjects: cachedContent('catalog.subjects', async (boardCode: string, sessionCode: string, classLevel: number) => {
    const board = await db.query.boards.findFirst({ where: eq(boards.code, boardCode) });
    const session = await db.query.academicSessions.findFirst({ where: eq(academicSessions.code, sessionCode) });
    if (!board || !session) throw notFound('Board or session not found.');
    if (board.status === 'NOT_AVAILABLE') return { board: board.code, session: session.code, classLevel, available: false, subjects: [] };
    const list = await subjectsWithContent(and(eq(subjects.boardId, board.id), eq(subjects.sessionId, session.id), eq(subjects.classLevel, classLevel)));
    return { board: board.code, session: session.code, classLevel, stage: stageOf(classLevel), available: true, subjects: list };
  }),
};

export const studentCurriculumService = {
  /**
   * The active selection with its subjects, or null if the student has not chosen yet.
   * Read on almost every request, so it is cached for a minute and dropped when set() changes it.
   */
  active: cachedContent('student.active', async (studentId: string) => {
    const row = await db.query.studentCurricula.findFirst({
      where: and(eq(studentCurricula.studentId, studentId), eq(studentCurricula.isActive, true)),
      with: { board: true, session: true, subjects: { with: { subject: { columns: subjectColumns } } } },
    });
    if (!row) return null;
    return {
      id: row.id,
      board: { code: row.board.code, nameHi: row.board.nameHi, nameEn: row.board.nameEn, status: row.board.status },
      session: { code: row.session.code, isCurrent: row.session.isCurrent },
      classLevel: row.classLevel,
      stage: stageOf(row.classLevel),
      medium: row.medium,
      stream: row.stream,
      startedAt: row.startedAt,
      subjects: row.subjects.map((s) => s.subject).sort((a, b) => a.order - b.order),
    };
  }, STUDENT_TTL_MS),

  /** Subject ids the student is currently studying (empty if no selection). */
  subjectIds: cachedContent('student.subjectIds', async (studentId: string): Promise<string[]> => {
    const rows = await db
      .select({ id: studentSubjects.subjectId })
      .from(studentSubjects)
      .innerJoin(studentCurricula, eq(studentCurricula.id, studentSubjects.curriculumId))
      .where(and(eq(studentCurricula.studentId, studentId), eq(studentCurricula.isActive, true)));
    return rows.map((r) => r.id);
  }, STUDENT_TTL_MS),

  async history(studentId: string) {
    const rows = await db.query.studentCurricula.findMany({
      where: eq(studentCurricula.studentId, studentId),
      orderBy: (c, { desc }) => [desc(c.startedAt)],
      with: { board: { columns: { code: true } }, session: { columns: { code: true } }, subjects: { with: { subject: { columns: { nameHi: true, nameEn: true } } } } },
    });
    return rows.map((r) => ({
      classLevel: r.classLevel,
      board: r.board.code,
      session: r.session.code,
      medium: r.medium,
      stream: r.stream,
      isActive: r.isActive,
      startedAt: r.startedAt,
      endedAt: r.endedAt,
      subjects: r.subjects.map((s) => ({ nameHi: s.subject.nameHi, nameEn: s.subject.nameEn })),
    }));
  },

  /**
   * Sets (or changes) the student's class, board, session, medium, stream and subjects.
   * Validates that every subject belongs to that board, session and class.
   */
  async set(studentId: string, input: CurriculumInput) {
    const board = await db.query.boards.findFirst({ where: eq(boards.code, input.board) });
    if (!board) throw badRequest('Board not found.');
    if (board.status === 'NOT_AVAILABLE') throw badRequest("This board's curriculum is not available yet.");
    const session = await db.query.academicSessions.findFirst({ where: eq(academicSessions.code, input.session) });
    if (!session) throw badRequest('Academic session not found.');
    if (input.stream && input.classLevel < 11) throw badRequest('Streams apply to Classes 11 and 12 only.');

    const wanted = [...new Set(input.subjects)];
    const found = wanted.length
      ? await db.query.subjects.findMany({
          where: and(inArray(subjects.slug, wanted), eq(subjects.boardId, board.id), eq(subjects.sessionId, session.id), eq(subjects.classLevel, input.classLevel)),
          columns: { id: true, slug: true },
        })
      : [];
    if (!wanted.length || found.length !== wanted.length) throw badRequest('Choose subjects from your class, board and session.');

    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(studentCurricula)
        .set({ isActive: false, endedAt: now })
        .where(and(eq(studentCurricula.studentId, studentId), eq(studentCurricula.isActive, true)));
      const [row] = await tx
        .insert(studentCurricula)
        .values({ studentId, boardId: board.id, sessionId: session.id, classLevel: input.classLevel, medium: input.medium, stream: input.classLevel >= 11 ? input.stream ?? null : null, isActive: true, startedAt: now })
        .returning({ id: studentCurricula.id });
      await tx.insert(studentSubjects).values(found.map((s) => ({ curriculumId: row.id, subjectId: s.id })));
      // Keep the profile's summary fields in step (used by guardian views and older clients)
      await tx.update(studentProfiles).set({ classLevel: input.classLevel, board: board.code }).where(eq(studentProfiles.id, studentId));
    });
    forgetContent('student.active', studentId);
    forgetContent('student.subjectIds', studentId);
    return studentCurriculumService.active(studentId);
  },
};
