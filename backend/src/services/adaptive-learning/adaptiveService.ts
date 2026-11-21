import type { AnswerOrigin, Question, RecommendationKind } from '../../db/schema';
import { db, type Executor } from '../../db/client';
import { learningRepository } from '../../repositories/learningRepository';
import { curriculumRepository } from '../../repositories/curriculumRepository';
import { gradeAnswer } from '../../utils/grading';

/** Weight of a correct answer by difficulty: harder questions move mastery further. */
const SCORE_BY_DIFFICULTY: Record<number, number> = { 1: 0.6, 2: 0.8, 3: 1 };
const LEARNING_RATE = 0.3;

export interface ProgressState {
  attempts: number;
  correct: number;
  mastery: number;
  currentDifficulty: number;
  streak: number;
}

/** Pure function: next progress state after one answer. Exported for tests. */
export function nextProgress(prev: ProgressState, isCorrect: boolean, difficulty: number): ProgressState {
  const score = isCorrect ? (SCORE_BY_DIFFICULTY[difficulty] ?? 0.6) : 0;
  const mastery = Math.min(1, Math.max(0, prev.mastery * (1 - LEARNING_RATE) + score * LEARNING_RATE));
  let streak = isCorrect ? (prev.streak > 0 ? prev.streak + 1 : 1) : prev.streak < 0 ? prev.streak - 1 : -1;
  let currentDifficulty = prev.currentDifficulty;
  if (streak >= 2 && currentDifficulty < 3) {
    currentDifficulty += 1;
    streak = 0;
  } else if (streak <= -2 && currentDifficulty > 1) {
    currentDifficulty -= 1;
    streak = 0;
  }
  return {
    attempts: prev.attempts + 1,
    correct: prev.correct + (isCorrect ? 1 : 0),
    mastery: Math.round(mastery * 1000) / 1000,
    currentDifficulty,
    streak,
  };
}

export interface Attempt {
  at: Date;
  correct: boolean;
}

/** A correct answer this recent keeps a question out of practice for a while. */
const SOLVED_COOLDOWN_MS = 6 * 3600_000;

/**
 * Pure, deterministic choice of the next practice question. Exported for tests.
 *  1. Skip questions answered correctly in the last 6 hours.
 *  2. Never repeat the question answered last (if any other question is available), so a student
 *     who got it wrong sees a different question first and comes back to it later.
 *  3. Prefer the student's current level, then the nearest level (easier before harder),
 *     then questions never tried, then the one tried longest ago, then by id for stability.
 * If every question was solved recently, the least recently answered one is offered again.
 */
export function pickQuestion<Q extends { id: string; difficulty: number }>(
  pool: Q[],
  level: number,
  attempts: Map<string, Attempt>,
  now = new Date(),
): { question: Q; allRecentlySolved: boolean } | null {
  if (pool.length === 0) return null;
  let lastId: string | undefined;
  let lastAt = -Infinity;
  for (const [id, a] of attempts) if (a.at.getTime() > lastAt) [lastId, lastAt] = [id, a.at.getTime()];

  const order = (a: Q, b: Q) => {
    const da = Math.abs(a.difficulty - level) * 2 + (a.difficulty > level ? 1 : 0);
    const db_ = Math.abs(b.difficulty - level) * 2 + (b.difficulty > level ? 1 : 0);
    if (da !== db_) return da - db_;
    const ta = attempts.get(a.id)?.at.getTime() ?? -Infinity;
    const tb = attempts.get(b.id)?.at.getTime() ?? -Infinity;
    if (ta !== tb) return ta - tb;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  };

  const notSolved = pool.filter((q) => {
    const a = attempts.get(q.id);
    return !(a?.correct && now.getTime() - a.at.getTime() < SOLVED_COOLDOWN_MS);
  });
  const fresh = notSolved.filter((q) => q.id !== lastId);
  const candidates = fresh.length ? fresh : notSolved;
  if (candidates.length) return { question: [...candidates].sort(order)[0], allRecentlySolved: false };

  const oldestFirst = [...pool].sort((a, b) => (attempts.get(a.id)?.at.getTime() ?? 0) - (attempts.get(b.id)?.at.getTime() ?? 0));
  const notLast = oldestFirst.filter((q) => q.id !== lastId);
  return { question: (notLast[0] ?? oldestFirst[0])!, allRecentlySolved: true };
}

const EMPTY: ProgressState = { attempts: 0, correct: 0, mastery: 0, currentDifficulty: 1, streak: 0 };

export const adaptiveService = {
  async recordAnswer(params: {
    studentId: string;
    question: Question;
    answer: string;
    sessionId?: string | null;
    timeTakenSec?: number | null;
    origin?: AnswerOrigin;
    answeredAt?: Date;
    /** Run inside a caller's transaction (offline sync applies each record atomically). */
    ex?: Executor;
  }) {
    const { studentId, question } = params;
    const ex = params.ex ?? db;
    const isCorrect = gradeAnswer(question.type, question.correctAnswer, params.answer);
    await learningRepository.createAnswer({
      studentId,
      questionId: question.id,
      sessionId: params.sessionId ?? null,
      answer: params.answer.slice(0, 200),
      isCorrect,
      difficulty: question.difficulty,
      timeTakenSec: params.timeTakenSec ?? null,
      origin: params.origin ?? 'ONLINE',
      answeredAt: params.answeredAt,
    }, ex);
    const prev = await learningRepository.progressFor(studentId, question.topicId, ex);
    const next = nextProgress(prev ?? EMPTY, isCorrect, question.difficulty);
    const progress = await learningRepository.upsertProgress(studentId, question.topicId, { ...next, lastActivityAt: new Date() }, ex);
    return { isCorrect, progress };
  },

  async markLessonComplete(studentId: string, topicId: string, at = new Date(), ex: Executor = db) {
    const prev = await learningRepository.progressFor(studentId, topicId, ex);
    return learningRepository.upsertProgress(
      studentId,
      topicId,
      {
        ...(prev ? {} : EMPTY),
        lessonCompletedAt: prev?.lessonCompletedAt ?? at,
        lastActivityAt: at,
      },
      ex,
    );
  },

  /** Topics the student is struggling with, weakest first. */
  async weakTopics(studentId: string) {
    const all = await learningRepository.allProgress(studentId);
    return all
      .filter((p) => p.attempts >= 2 && (p.mastery < 0.45 || p.correct / p.attempts < 0.5))
      .sort((a, b) => a.mastery - b.mastery)
      .map((p) => ({
        topic: p.topic,
        mastery: p.mastery,
        attempts: p.attempts,
        accuracy: p.attempts ? p.correct / p.attempts : 0,
      }));
  },

  /** Rebuilds the student's active recommendations from their current progress. */
  async recompute(studentId: string) {
    const [progress, topics] = await Promise.all([learningRepository.allProgress(studentId), curriculumRepository.allTopics()]);
    const byTopic = new Map(progress.map((p) => [p.topicId, p]));
    const recs: Array<{ topicId: string; kind: RecommendationKind; reasonHi: string; reasonEn: string; priority: number }> = [];

    for (const p of progress) {
      const accuracy = p.attempts ? p.correct / p.attempts : 0;
      const pct = Math.round(accuracy * 100);
      if (p.attempts >= 2 && (p.mastery < 0.45 || accuracy < 0.5)) {
        if (!p.lessonCompletedAt) {
          recs.push({
            topicId: p.topicId,
            kind: 'REVIEW_LESSON',
            reasonHi: `इस विषय में ${p.attempts} में से ${p.correct} उत्तर सही हैं। पहले पाठ दोबारा पढ़ें।`,
            reasonEn: `${p.correct} of ${p.attempts} answers correct here. Read the lesson again first.`,
            priority: Math.round((1 - p.mastery) * 100) + 10,
          });
        } else {
          recs.push({
            topicId: p.topicId,
            kind: 'PRACTICE',
            reasonHi: `सटीकता ${pct}% है। आसान प्रश्नों से दोबारा अभ्यास करें।`,
            reasonEn: `Accuracy is ${pct}%. Practise again starting with easier questions.`,
            priority: Math.round((1 - p.mastery) * 100),
          });
        }
      } else if (p.lessonCompletedAt && p.attempts === 0) {
        recs.push({
          topicId: p.topicId,
          kind: 'PRACTICE',
          reasonHi: 'आपने पाठ पढ़ लिया है। अब कुछ प्रश्न हल करके देखें।',
          reasonEn: 'You have read the lesson. Now try a few questions.',
          priority: 40,
        });
      }
    }

    // Suggest moving ahead after strong performance
    const strong = progress.filter((p) => p.mastery >= 0.75 && p.currentDifficulty === 3);
    for (const p of strong) {
      const idx = topics.findIndex((t) => t.id === p.topicId);
      const next = topics.slice(idx + 1).find((t) => !byTopic.has(t.id));
      if (next && !recs.some((r) => r.topicId === next.id)) {
        recs.push({
          topicId: next.id,
          kind: 'ADVANCE',
          reasonHi: 'पिछले विषय में आपकी पकड़ अच्छी है। अगला विषय शुरू करें।',
          reasonEn: 'You are doing well on the previous topic. Start the next one.',
          priority: 20,
        });
      }
    }

    if (progress.length === 0 && topics[0]) {
      recs.push({
        topicId: topics[0].id,
        kind: 'REVIEW_LESSON',
        reasonHi: 'यहीं से शुरुआत करें — अध्याय 1 का पहला पाठ।',
        reasonEn: 'Start here — the first lesson of Chapter 1.',
        priority: 5,
      });
    }

    const top = recs.sort((a, b) => b.priority - a.priority).slice(0, 5);
    await learningRepository.replaceRecommendations(studentId, top);
    return learningRepository.activeRecommendations(studentId);
  },

  /** Picks the next practice question at the student's current level for a topic. */
  async nextQuestion(studentId: string, topicSlug?: string) {
    let topicId: string | undefined;
    if (topicSlug) {
      const topic = await curriculumRepository.topicBySlug(topicSlug);
      if (!topic) return null;
      topicId = topic.id;
    } else {
      const weak = await this.weakTopics(studentId);
      if (weak[0]) topicId = weak[0].topic.id;
      else {
        const recs = await learningRepository.activeRecommendations(studentId);
        const rec = recs.find((r) => r.kind !== 'REVIEW_LESSON') ?? recs[0];
        topicId = rec?.topicId ?? (await curriculumRepository.allTopics())[0]?.id;
      }
    }
    if (!topicId) return null;

    const progress = await learningRepository.progressFor(studentId, topicId);
    const difficulty = progress?.currentDifficulty ?? 1;
    const [pool, attempts] = await Promise.all([curriculumRepository.questionsForTopic(topicId), learningRepository.lastAttemptsInTopic(studentId, topicId)]);
    const picked = pickQuestion(pool, difficulty, attempts);
    if (!picked) return null;
    const { question, allRecentlySolved: exhausted } = picked;
    const topic = await curriculumRepository.topicById(topicId);
    return {
      question,
      topic: topic && { id: topic.id, slug: topic.slug, titleHi: topic.titleHi, titleEn: topic.titleEn, chapterSlug: topic.chapter.slug },
      level: difficulty,
      mastery: progress?.mastery ?? 0,
      allRecentlySolved: exhausted,
    };
  },
};
