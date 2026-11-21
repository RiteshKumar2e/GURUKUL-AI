import type { Question } from '../db/schema';
import { curriculumRepository } from '../repositories/curriculumRepository';
import { learningRepository } from '../repositories/learningRepository';
import { adaptiveService } from './adaptive-learning/adaptiveService';
import { badRequest, forbidden, notFound } from '../utils/errors';
import { contentMeta } from '../utils/contentMeta';

type Option = { id: string; hi: string; en: string };

/** What the student should see as the correct answer (MCQ: option text). */
export function displayAnswer(q: Pick<Question, 'type' | 'correctAnswer' | 'options'>) {
  if (q.type === 'MCQ') {
    const opt = (q.options as Option[] | null)?.find((o) => o.id === q.correctAnswer);
    return { hi: opt?.hi ?? q.correctAnswer, en: opt?.en ?? q.correctAnswer };
  }
  return { hi: q.correctAnswer, en: q.correctAnswer };
}

function feedback(q: Question, isCorrect: boolean) {
  return {
    isCorrect,
    correctAnswer: q.correctAnswer,
    correctAnswerDisplay: displayAnswer(q),
    explanationHi: q.explanationHi,
    explanationEn: q.explanationEn,
  };
}

/* ---------------------------------- curriculum ---------------------------------- */

export const curriculumService = {
  async overview(studentId?: string) {
    const [subjects, progress] = await Promise.all([
      curriculumRepository.subjects(),
      studentId ? learningRepository.allProgress(studentId) : Promise.resolve([]),
    ]);
    const chapters = await curriculumRepository.chapters();
    const progressByTopic = new Map(progress.map((p) => [p.topicId, p]));
    return {
      subjects: subjects.map((s) => ({ id: s.id, slug: s.slug, nameHi: s.nameHi, nameEn: s.nameEn, classLevel: s.classLevel, board: s.board })),
      chapters: chapters.map((c) => {
        const tp = c.topics.map((t) => progressByTopic.get(t.id));
        const started = tp.filter(Boolean);
        return {
          id: c.id,
          slug: c.slug,
          number: c.number,
          nameHi: c.nameHi,
          nameEn: c.nameEn,
          summaryHi: c.summaryHi,
          summaryEn: c.summaryEn,
          source: c.source,
          topicCount: c.topics.length,
          questionCount: c.topics.reduce((n, t) => n + t._count.questions, 0),
          hasAssessment: c.assessments.length > 0,
          assessmentSlug: c.assessments[0]?.slug ?? null,
          mastery: c.topics.length ? tp.reduce((n, p) => n + (p?.mastery ?? 0), 0) / c.topics.length : 0,
          topicsStarted: started.length,
          lessonsCompleted: tp.filter((p) => p?.lessonCompletedAt).length,
        };
      }),
      meta: contentMeta(),
    };
  },

  async chapter(slug: string, studentId?: string) {
    const chapter = await curriculumRepository.chapterBySlug(slug);
    if (!chapter) throw notFound('Chapter not found.');
    const progress = studentId ? await learningRepository.allProgress(studentId) : [];
    const byTopic = new Map(progress.map((p) => [p.topicId, p]));
    return {
      id: chapter.id,
      slug: chapter.slug,
      number: chapter.number,
      nameHi: chapter.nameHi,
      nameEn: chapter.nameEn,
      summaryHi: chapter.summaryHi,
      summaryEn: chapter.summaryEn,
      source: chapter.source,
      subject: { slug: chapter.subject.slug, nameHi: chapter.subject.nameHi, nameEn: chapter.subject.nameEn },
      assessment: chapter.assessments[0]
        ? { slug: chapter.assessments[0].slug, titleHi: chapter.assessments[0].titleHi, titleEn: chapter.assessments[0].titleEn, durationMinutes: chapter.assessments[0].durationMinutes, questionCount: chapter.assessments[0]._count.questions }
        : null,
      topics: chapter.topics.map((t) => {
        const p = byTopic.get(t.id);
        return {
          id: t.id,
          slug: t.slug,
          order: t.order,
          titleHi: t.titleHi,
          titleEn: t.titleEn,
          summaryHi: t.summaryHi,
          summaryEn: t.summaryEn,
          estMinutes: t.lessons[0]?.estMinutes ?? null,
          questionCount: t._count.questions,
          progress: p ? { mastery: p.mastery, attempts: p.attempts, correct: p.correct, lessonCompleted: !!p.lessonCompletedAt, level: p.currentDifficulty } : null,
        };
      }),
    };
  },

  async topic(slug: string, studentId?: string) {
    const topic = await curriculumRepository.topicBySlug(slug);
    if (!topic) throw notFound('Topic not found.');
    const [siblings, progress] = await Promise.all([
      curriculumRepository.siblingsOf(topic.chapterId),
      studentId ? learningRepository.progressFor(studentId, topic.id) : Promise.resolve(null),
    ]);
    const idx = siblings.findIndex((s) => s.slug === slug);
    const lesson = topic.lessons[0] ?? null;
    return {
      id: topic.id,
      slug: topic.slug,
      titleHi: topic.titleHi,
      titleEn: topic.titleEn,
      summaryHi: topic.summaryHi,
      summaryEn: topic.summaryEn,
      chapter: topic.chapter,
      questionCount: topic._count.questions,
      lesson: lesson && { id: lesson.id, titleHi: lesson.titleHi, titleEn: lesson.titleEn, content: lesson.content, estMinutes: lesson.estMinutes, source: lesson.source, version: lesson.version, updatedAt: lesson.updatedAt },
      previous: idx > 0 ? siblings[idx - 1] : null,
      next: idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null,
      progress: progress && { mastery: progress.mastery, attempts: progress.attempts, correct: progress.correct, lessonCompleted: !!progress.lessonCompletedAt, level: progress.currentDifficulty },
    };
  },

  async completeLesson(studentId: string, slug: string) {
    const topic = await curriculumRepository.topicBySlug(slug);
    if (!topic) throw notFound('Topic not found.');
    await learningRepository.createSession({ studentId, type: 'LESSON', topicId: topic.id, chapterId: topic.chapter.id }).then((s) => learningRepository.endSession(s.id));
    const progress = await adaptiveService.markLessonComplete(studentId, topic.id);
    await adaptiveService.recompute(studentId);
    return { lessonCompleted: true, progress };
  },

  async offlinePack(slug: string) {
    const chapter = await curriculumRepository.chapterOfflinePack(slug);
    if (!chapter) throw notFound('Chapter not found.');
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      chapter: { slug: chapter.slug, number: chapter.number, nameHi: chapter.nameHi, nameEn: chapter.nameEn, summaryHi: chapter.summaryHi, summaryEn: chapter.summaryEn },
      topics: chapter.topics.map((t) => ({
        slug: t.slug,
        titleHi: t.titleHi,
        titleEn: t.titleEn,
        summaryHi: t.summaryHi,
        summaryEn: t.summaryEn,
        lesson: t.lessons[0] ? { titleHi: t.lessons[0].titleHi, titleEn: t.lessons[0].titleEn, content: t.lessons[0].content, estMinutes: t.lessons[0].estMinutes } : null,
        questions: t.questions.map((q) => ({
          id: q.id,
          slug: q.slug,
          type: q.type,
          difficulty: q.difficulty,
          promptHi: q.promptHi,
          promptEn: q.promptEn,
          options: q.options,
          hintHi: q.hintHi,
          hintEn: q.hintEn,
          correctAnswer: q.correctAnswer,
          correctAnswerDisplay: displayAnswer(q),
          explanationHi: q.explanationHi,
          explanationEn: q.explanationEn,
        })),
      })),
    };
  },
};

/* ----------------------------------- practice ----------------------------------- */

export const practiceService = {
  async next(studentId: string, topicSlug?: string) {
    const result = await adaptiveService.nextQuestion(studentId, topicSlug);
    if (!result) throw notFound('No practice questions are available for this topic yet.');
    return result;
  },

  async answer(studentId: string, input: { questionId: string; answer: string; timeTakenSec?: number; sessionId?: string }) {
    const question = await curriculumRepository.questionById(input.questionId);
    if (!question) throw notFound('Question not found.');
    if (input.sessionId) {
      const s = await learningRepository.findSession(input.sessionId);
      if (!s || s.studentId !== studentId) throw forbidden();
    }
    const { isCorrect, progress } = await adaptiveService.recordAnswer({ studentId, question, answer: input.answer, timeTakenSec: input.timeTakenSec, sessionId: input.sessionId });
    await adaptiveService.recompute(studentId);
    return {
      ...feedback(question, isCorrect),
      progress: { mastery: progress.mastery, attempts: progress.attempts, correct: progress.correct, level: progress.currentDifficulty },
      topic: question.topic,
    };
  },

  startSession: async (studentId: string, topicSlug?: string) => {
    const topic = topicSlug ? await curriculumRepository.topicBySlug(topicSlug) : null;
    return learningRepository.createSession({ studentId, type: 'PRACTICE', topicId: topic?.id, chapterId: topic?.chapter.id });
  },

  async endSession(studentId: string, sessionId: string) {
    const s = await learningRepository.findSession(sessionId);
    if (!s || s.studentId !== studentId) throw notFound('Session not found.');
    return learningRepository.endSession(sessionId);
  },
};

/* ---------------------------------- assessments --------------------------------- */

export const assessmentService = {
  async list() {
    const rows = await curriculumRepository.assessments();
    return rows.map((a) => ({ slug: a.slug, titleHi: a.titleHi, titleEn: a.titleEn, durationMinutes: a.durationMinutes, questionCount: a._count.questions, chapter: a.chapter }));
  },

  async get(slug: string) {
    const a = await curriculumRepository.assessmentBySlug(slug);
    if (!a) throw notFound('Quiz not found.');
    return {
      slug: a.slug,
      titleHi: a.titleHi,
      titleEn: a.titleEn,
      durationMinutes: a.durationMinutes,
      chapter: a.chapter,
      questions: a.questions.map((q) => ({ ...q.question, hintHi: undefined, hintEn: undefined })), // no hints in a quiz
    };
  },

  async start(studentId: string, slug: string) {
    const a = await curriculumRepository.assessmentBySlug(slug);
    if (!a) throw notFound('Quiz not found.');
    const session = await learningRepository.createSession({ studentId, type: 'QUIZ', assessmentId: a.id, chapterId: a.chapter.id });
    return { sessionId: session.id, startedAt: session.startedAt, durationMinutes: a.durationMinutes };
  },

  async submit(studentId: string, sessionId: string, answers: Array<{ questionId: string; answer: string }>) {
    const session = await learningRepository.findSession(sessionId);
    if (!session || session.studentId !== studentId || session.type !== 'QUIZ' || !session.assessmentId) throw notFound('Quiz session not found.');
    if (session.endedAt) throw badRequest('This quiz has already been submitted.');
    const assessment = await curriculumRepository.assessmentById(session.assessmentId);
    if (!assessment) throw notFound('Quiz not found.');
    const allowed = new Set(assessment.questions.map((q) => q.questionId));
    const questions = await curriculumRepository.questionsByIds(assessment.questions.map((q) => q.questionId));
    const given = new Map(answers.filter((a) => allowed.has(a.questionId)).map((a) => [a.questionId, a.answer]));

    const results = [];
    let score = 0;
    for (const aq of assessment.questions) {
      const q = questions.find((x) => x.id === aq.questionId)!;
      const answer = given.get(q.id) ?? '';
      let isCorrect = false;
      if (answer) {
        const r = await adaptiveService.recordAnswer({ studentId, question: q, answer, sessionId });
        isCorrect = r.isCorrect;
      }
      if (isCorrect) score++;
      results.push({ questionId: q.id, promptHi: q.promptHi, promptEn: q.promptEn, answer, skipped: !answer, ...feedback(q, isCorrect) });
    }
    await learningRepository.endSession(sessionId, score, assessment.questions.length);
    await adaptiveService.recompute(studentId);
    return { score, total: assessment.questions.length, results };
  },
};
