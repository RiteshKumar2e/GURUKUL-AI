import type { Role } from '@prisma/client';
import { guardianRepository } from '../repositories/guardianRepository';
import { badRequest, forbidden, notFound } from '../utils/errors';
import { progressService } from './progressService';
import { prisma } from '../config/prisma';

async function profileId(userId: string, role: Role) {
  const id = await guardianRepository.profileIdFor(userId, role);
  if (!id) throw forbidden('This dashboard is for parent and teacher accounts.');
  return id;
}

export const guardianService = {
  async link(userId: string, role: Role, code: string) {
    const pid = await profileId(userId, role);
    const student = await guardianRepository.studentByLinkCode(code.trim().toUpperCase());
    if (!student) throw badRequest('This code did not match any student. Check it and try again.');
    await guardianRepository.link(role, pid, student.id);
    return { studentId: student.id, displayName: student.user.displayName };
  },

  async unlink(userId: string, role: Role, studentId: string) {
    const pid = await profileId(userId, role);
    await guardianRepository.unlink(role, pid, studentId);
  },

  async students(userId: string, role: Role) {
    const pid = await profileId(userId, role);
    const rows = await guardianRepository.linkedStudents(role, pid);
    return rows.map((s) => {
      const attempts = s.progress.reduce((n, p) => n + p.attempts, 0);
      const correct = s.progress.reduce((n, p) => n + p.correct, 0);
      const last = s.progress.reduce<Date | null>((d, p) => (!d || p.lastActivityAt > d ? p.lastActivityAt : d), null);
      return {
        id: s.id,
        displayName: s.user.displayName,
        classLevel: s.classLevel,
        board: s.board,
        district: s.district,
        answered: attempts,
        accuracy: attempts ? correct / attempts : 0,
        topicsStarted: s.progress.length,
        lastActivityAt: last,
      };
    });
  },

  /** Only linked guardians get here. Tutor chat content is intentionally not shared. */
  async report(userId: string, role: Role, studentId: string) {
    const pid = await profileId(userId, role);
    if (!(await guardianRepository.isLinked(role, pid, studentId))) throw notFound('Student not found.');
    const [student, overview, activity, tutorCount] = await Promise.all([
      prisma.studentProfile.findUnique({ where: { id: studentId }, select: { classLevel: true, board: true, district: true, user: { select: { displayName: true } } } }),
      progressService.overview(studentId),
      progressService.activity(studentId),
      prisma.tutorConversation.count({ where: { studentId } }),
    ]);
    return {
      student: { id: studentId, displayName: student!.user.displayName, classLevel: student!.classLevel, board: student!.board, district: student!.district },
      ...overview,
      sessions: activity.sessions,
      tutorConversations: tutorCount,
    };
  },
};
