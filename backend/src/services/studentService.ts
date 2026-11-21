import type { TeachingLevel } from '@prisma/client';
import { prisma } from '../config/prisma';
import { guardianRepository } from '../repositories/guardianRepository';
import { learningRepository } from '../repositories/learningRepository';
import { notFound } from '../utils/errors';
import { generateLinkCode } from '../utils/tokens';
import { progressService } from './progressService';

export const studentService = {
  async profile(studentId: string) {
    const s = await prisma.studentProfile.findUnique({ where: { id: studentId }, include: { user: { select: { displayName: true, preferredLanguage: true, username: true } } } });
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
    await prisma.studentProfile.update({ where: { id: studentId }, data });
    return this.profile(studentId);
  },

  async rotateLinkCode(studentId: string) {
    for (let i = 0; i < 5; i++) {
      try {
        const s = await prisma.studentProfile.update({ where: { id: studentId }, data: { linkCode: generateLinkCode() } });
        return { linkCode: s.linkCode };
      } catch {
        /* collision: retry */
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
