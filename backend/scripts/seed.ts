/**
 * Seeds curriculum data:
 *  - backend/content/curriculum-catalog.json: subjects, official NCERT books and (where read from
 *    the book) chapter titles for Classes 1-12, for each available board, session 2026-27;
 *  - backend/content/class9-maths.json: the original Class 9 maths lessons and questions
 *    (JAC, session 2025-26).
 *
 *   npm run db:seed
 *
 * Run `npm run db:migrate` first (it creates the boards, sessions and classes).
 * Safe to re-run: everything is upserted by slug. It creates no user accounts and never touches
 * users' data.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { and, eq, sql } from 'drizzle-orm';
import { db, closeDatabase, checkDatabase } from '../src/db/client';
import {
  academicSessions,
  assessmentQuestions,
  assessments,
  boards,
  chapters,
  lessons,
  questions,
  subjects,
  topics,
  type LessonBlock,
  type QuestionOption,
  type QuestionType,
} from '../src/db/schema';

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

const excluded = (cols: string[]) => Object.fromEntries(cols.map((c) => [c, sql.raw(`excluded."${c.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase())}"`)]));

async function seedContent() {
  const file = path.resolve(__dirname, '../content/class9-maths.json');
  const content = JSON.parse(fs.readFileSync(file, 'utf8')) as ContentFile;
  const sourceNote = content.meta.curriculumVerification.note;

  // Earlier NCERT book (12 chapters), so it belongs to session 2025-26; JAC was the original target
  const legacy = {
    ...content.subject,
    sourceNote,
    boardId: 'board_jac',
    sessionId: 'session_2025_26',
    subjectKey: 'mathematics',
    verification: 'PARTIAL' as const,
    sourceUrl: 'http://jcert.jharkhand.gov.in/public/assets/Guideline/20220808163146_62f0ed1aa7bbf.pdf',
    chapterCount: content.chapters.length,
  };
  const [subject] = await db.insert(subjects).values(legacy).onConflictDoUpdate({ target: subjects.slug, set: legacy }).returning();

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

interface Catalog {
  meta: { session: string; sources: Record<string, string> };
  classes: Record<
    string,
    Array<{
      key: string;
      nameEn: string;
      nameHi: string;
      order: number;
      books: Array<{ title: string; code: string; medium: string; chapters: number }>;
      chapters: Array<{ number: number; titleEn: string }> | null;
      chapterSource?: string[];
    }>
  >;
}

/**
 * One catalogue file per academic session: the current list (curriculum-catalog.json) and earlier
 * sessions taken from archived copies of the same official NCERT page.
 */
const CATALOG_FILES = ['curriculum-catalog.json', 'curriculum-catalog-2025-26.json', 'curriculum-catalog-2024-25.json'];

async function seedCatalogs() {
  for (const file of CATALOG_FILES) await seedCatalog(file);
}

/** Subjects (and maths chapter titles) for Classes 1-12 from the official NCERT textbook list. */
async function seedCatalog(file: string) {
  const catalog = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../content', file), 'utf8')) as Catalog;
  const session = await db.query.academicSessions.findFirst({ where: eq(academicSessions.code, catalog.meta.session) });
  if (!session) throw new Error(`Session ${catalog.meta.session} is missing. Run \`npm run db:migrate\` first.`);
  const available = (await db.select().from(boards)).filter((b) => b.status !== 'NOT_AVAILABLE');

  let subjectCount = 0;
  let chapterCount = 0;
  for (const board of available) {
    for (const [cls, all] of Object.entries(catalog.classes)) {
      let list = all;
      const classLevel = Number(cls);
      // A subject that already exists for this board, session and class under another slug (the
      // Class 9 maths sample lessons, JAC 2025-26) keeps its row; it only gets the official book list.
      const existing = await db.query.subjects.findMany({
        where: and(eq(subjects.boardId, board.id), eq(subjects.sessionId, session.id), eq(subjects.classLevel, classLevel)),
        columns: { id: true, slug: true, subjectKey: true },
      });
      const prefix = `${board.code.toLowerCase()}-${session.code}-c${classLevel}-`;
      const taken = new Map(existing.filter((e) => !e.slug.startsWith(prefix) && e.subjectKey).map((e) => [e.subjectKey!, e.id]));
      for (const sub of list.filter((x) => taken.has(x.key))) {
        await db.update(subjects).set({ books: sub.books }).where(eq(subjects.id, taken.get(sub.key)!));
      }
      list = list.filter((x) => !taken.has(x.key));
      const rows = list.map((sub) => ({
        slug: `${board.code.toLowerCase()}-${session.code}-c${classLevel}-${sub.key}`,
        nameHi: sub.nameHi,
        nameEn: sub.nameEn,
        classLevel,
        board: board.code,
        boardId: board.id,
        sessionId: session.id,
        subjectKey: sub.key,
        // Subjects come from NCERT's official list; how far that matches the board is the board's status
        verification: board.status,
        sourceUrl: 'https://ncert.nic.in/textbook.php',
        sourceNote: catalog.meta.sources.subjectsAndBooks,
        books: sub.books,
        chapterCount: sub.chapters?.length ?? sub.books.find((b) => b.medium === 'EN')?.chapters ?? sub.books[0]?.chapters ?? null,
        order: sub.order,
      }));
      if (!rows.length) continue;
      const saved = await db
        .insert(subjects)
        .values(rows)
        .onConflictDoUpdate({
          target: subjects.slug,
          set: excluded(['nameHi', 'nameEn', 'classLevel', 'board', 'boardId', 'sessionId', 'subjectKey', 'verification', 'sourceUrl', 'sourceNote', 'books', 'chapterCount', 'order']),
        })
        .returning({ id: subjects.id, slug: subjects.slug });
      subjectCount += saved.length;
      const idBySlug = new Map(saved.map((r) => [r.slug, r.id]));

      for (const sub of list) {
        if (!sub.chapters?.length) continue;
        const subjectSlug = `${board.code.toLowerCase()}-${session.code}-c${classLevel}-${sub.key}`;
        const chapterRows = sub.chapters.map((c) => ({
          subjectId: idBySlug.get(subjectSlug)!,
          slug: `${subjectSlug}-ch${c.number}`,
          number: c.number,
          // Official English title from the NCERT book; no Hindi title was read, so it is not invented
          nameEn: c.titleEn,
          nameHi: c.titleEn,
          summaryHi: '',
          summaryEn: '',
          source: 'VERIFIED_PUBLIC' as const,
        }));
        await db
          .insert(chapters)
          .values(chapterRows)
          .onConflictDoUpdate({ target: chapters.slug, set: excluded(['number', 'nameEn', 'nameHi', 'source']) });
        chapterCount += chapterRows.length;
      }
    }
  }
  console.log(`Catalog: ${subjectCount} subjects and ${chapterCount} chapter titles for ${available.map((b) => b.code).join(', ')} (${session.code})`);
}

async function main() {
  const health = await checkDatabase();
  if (!health.ok) throw new Error(`Database not reachable (${health.location}): ${health.error}`);
  if (!health.migrated) throw new Error('Tables are missing. Run `npm run db:migrate` first.');
  // Sample lessons first, so the catalogue sees the existing Class 9 maths subject and does not duplicate it
  await seedContent();
  await seedCatalogs();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => closeDatabase());
