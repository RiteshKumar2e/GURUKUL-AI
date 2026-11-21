import type { AnswerOrigin, Question, RecommendationKind } from '@prisma/client';
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
  }) {
    const { studentId, question } = params;
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
    });
    const prev = await learningRepository.progressFor(studentId, question.topicId);
    const next = nextProgress(prev ?? EMPTY, isCorrect, question.difficulty);
    const progress = await learningRepository.upsertProgress(studentId, question.topicId, { ...next, lastActivityAt: new Date() });
    return { isCorrect, progress };
  },

  async markLessonComplete(studentId: string, topicId: string, at = new Date()) {
    const prev = await learningRepository.progressFor(studentId, topicId);
    return learningRepository.upsertProgress(studentId, topicId, {
      ...(prev ? {} : EMPTY),
      lessonCompletedAt: prev?.lessonCompletedAt ?? at,
      lastActivityAt: at,
    });
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
    const recentCorrect = await learningRepository.recentCorrectQuestionIds(studentId, topicId, new Date(Date.now() - 6 * 3600_000));

    const atLevel = (await curriculumRepository.questionsForTopic(topicId, difficulty)).filter((q) => !recentCorrect.has(q.id));
    let pool = atLevel;
    if (pool.length === 0) pool = (await curriculumRepository.questionsForTopic(topicId)).filter((q) => !recentCorrect.has(q.id));
    const exhausted = pool.length === 0;
    if (exhausted) pool = await curriculumRepository.questionsForTopic(topicId);
    if (pool.length === 0) return null;

    const question = pool[Math.floor(Math.random() * pool.length)];
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
