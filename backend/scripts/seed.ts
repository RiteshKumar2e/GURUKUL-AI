/**
 * Seeds editable curriculum content from backend/content/class9-maths.json.
 *
 *   npm run db:seed
 *
 * Safe to re-run: content is upserted by slug. It creates no user accounts and never touches
 * users' data.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { eq, sql } from 'drizzle-orm';
import { db, closeDatabase, checkDatabase } from '../src/db/client';
import {
  assessmentQuestions,
  assessments,
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

async function main() {
  const health = await checkDatabase();
  if (!health.ok) throw new Error(`Database not reachable (${health.location}): ${health.error}`);
  if (!health.migrated) throw new Error('Tables are missing. Run `npm run db:migrate` first.');
  await seedContent();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => closeDatabase());
