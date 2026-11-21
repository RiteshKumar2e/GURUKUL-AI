import { eq } from 'drizzle-orm';
import { db, isUniqueViolation } from '../db/client';
import { studentProfiles, type TeachingLevel } from '../db/schema';
import { guardianRepository } from '../repositories/guardianRepository';
import { learningRepository } from '../repositories/learningRepository';
import { notFound } from '../utils/errors';
import { generateLinkCode } from '../utils/tokens';
import { progressService } from './progressService';

export const studentService = {
  async profile(studentId: string) {
    const s = await db.query.studentProfiles.findFirst({ where: eq(studentProfiles.id, studentId), with: { user: { columns: { displayName: true, preferredLanguage: true, username: true } } } });
    if (!s) throw notFound('Student profile not found.');
    const guardians = await guardianRepository.linkedGuardians(studentId);
    return {
      id: s.id,
      classLevel: s.classLevel,
      board: s.board,
      state: s.state,
      district: s.district,
      teachingLevel: s.teachingLevel,
      dailyGoalMinutes: s.dailyGoalMinutes,
      onboardingDone: s.onboardingDone,
      linkCode: s.linkCode,
      user: s.user,
      guardians: [
        ...(guardians?.parents.map((p) => ({ kind: 'PARENT' as const, name: p.parent.user.displayName, since: p.createdAt })) ?? []),
        ...(guardians?.teachers.map((t) => ({ kind: 'TEACHER' as const, name: t.teacher.user.displayName, school: t.teacher.schoolName, since: t.createdAt })) ?? []),
      ],
    };
  },

  async update(studentId: string, data: { district?: string | null; teachingLevel?: TeachingLevel; dailyGoalMinutes?: number; onboardingDone?: boolean }) {
    if (Object.keys(data).length) await db.update(studentProfiles).set(data).where(eq(studentProfiles.id, studentId));
    return this.profile(studentId);
  },

  async rotateLinkCode(studentId: string) {
    for (let i = 0; i < 5; i++) {
      try {
        const [s] = await db.update(studentProfiles).set({ linkCode: generateLinkCode() }).where(eq(studentProfiles.id, studentId)).returning({ linkCode: studentProfiles.linkCode });
        if (!s) throw notFound('Student profile not found.');
        return { linkCode: s.linkCode };
      } catch (err) {
        if (!isUniqueViolation(err, 'link_code')) throw err; // only a code collision is retried
      }
    }
    throw new Error('Could not generate a new code');
  },

  async dashboard(studentId: string) {
    const [overview, recommendations, sessions] = await Promise.all([
      progressService.overview(studentId),
      learningRepository.activeRecommendations(studentId),
      learningRepository.recentSessions(studentId, 5),
    ]);
    const lastTopic = sessions.find((s) => s.topic)?.topic ?? null;
    return {
      totals: overview.totals,
      last7: overview.last7,
      weakTopics: overview.weakTopics.slice(0, 3),
      recommendations: recommendations.slice(0, 3),
      continueTopic: lastTopic,
      recentSessions: sessions,
    };
  },
};
