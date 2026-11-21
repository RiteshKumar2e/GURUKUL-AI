import { curriculumRepository } from '../repositories/curriculumRepository';
import { learningRepository } from '../repositories/learningRepository';
import { adaptiveService } from './adaptive-learning/adaptiveService';

const DAY = 24 * 3600_000;

function dayKey(d: Date) {
  // Days are counted in India Standard Time (UTC+5:30), the product's target region
  return new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
}

/** Consecutive active days ending today or yesterday. */
export function streakDays(activeDays: Set<string>, now = new Date()): number {
  let streak = 0;
  let cursor = now;
  if (!activeDays.has(dayKey(cursor))) cursor = new Date(cursor.getTime() - DAY);
  while (activeDays.has(dayKey(cursor))) {
    streak++;
    cursor = new Date(cursor.getTime() - DAY);
  }
  return streak;
}

export const progressService = {
  async overview(studentId: string) {
    const [progress, topics, counts, recentAnswers] = await Promise.all([
      learningRepository.allProgress(studentId),
      curriculumRepository.allTopics(),
      learningRepository.countAnswers(studentId),
      learningRepository.answersSince(studentId, new Date(Date.now() - 60 * DAY)),
    ]);
    const correct = counts.find((c) => c.isCorrect)?._count._all ?? 0;
    const wrong = counts.find((c) => !c.isCorrect)?._count._all ?? 0;
    const answered = correct + wrong;
    const byTopic = new Map(progress.map((p) => [p.topicId, p]));

    const chapters = new Map<string, { slug: string; number: number; nameHi: string; nameEn: string; topics: unknown[]; masterySum: number; count: number }>();
    for (const t of topics) {
      const c = chapters.get(t.chapter.slug) ?? { ...t.chapter, topics: [], masterySum: 0, count: 0 };
      const p = byTopic.get(t.id);
      c.topics.push({
        slug: t.slug,
        titleHi: t.titleHi,
        titleEn: t.titleEn,
        mastery: p?.mastery ?? 0,
        attempts: p?.attempts ?? 0,
        correct: p?.correct ?? 0,
        level: p?.currentDifficulty ?? 1,
        lessonCompleted: !!p?.lessonCompletedAt,
        lastActivityAt: p?.lastActivityAt ?? null,
      });
      c.masterySum += p?.mastery ?? 0;
      c.count++;
      chapters.set(t.chapter.slug, c);
    }

    const activeDays = new Set(recentAnswers.map((a) => dayKey(a.answeredAt)));
    progress.forEach((p) => p.lessonCompletedAt && activeDays.add(dayKey(p.lessonCompletedAt)));

    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() - (6 - i) * DAY);
      const key = dayKey(d);
      const day = recentAnswers.filter((a) => dayKey(a.answeredAt) === key);
      return { date: key, answered: day.length, correct: day.filter((a) => a.isCorrect).length };
    });

    return {
      totals: {
        answered,
        correct,
        accuracy: answered ? correct / answered : 0,
        topicsStarted: progress.filter((p) => p.attempts > 0 || p.lessonCompletedAt).length,
        lessonsCompleted: progress.filter((p) => p.lessonCompletedAt).length,
        topicCount: topics.length,
        streakDays: streakDays(activeDays),
      },
      last7,
      chapters: [...chapters.values()].map(({ masterySum, count, ...c }) => ({ ...c, mastery: count ? masterySum / count : 0 })),
      weakTopics: await adaptiveService.weakTopics(studentId),
    };
  },

  async activity(studentId: string) {
    const [sessions, answers] = await Promise.all([learningRepository.recentSessions(studentId, 20), learningRepository.recentAnswers(studentId, 20)]);
    return {
      sessions: sessions.map((s) => ({
        id: s.id,
        type: s.type,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        score: s.score,
        total: s.total,
        topic: s.topic,
        chapter: s.chapter,
        assessment: s.assessment,
      })),
      answers: answers.map((a) => ({
        id: a.id,
        isCorrect: a.isCorrect,
        answeredAt: a.answeredAt,
        origin: a.origin,
        question: { slug: a.question.slug, promptHi: a.question.promptHi, promptEn: a.question.promptEn },
        topic: a.question.topic,
      })),
    };
  },
};
