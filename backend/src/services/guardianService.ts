import { eq } from 'drizzle-orm';
import type { Role } from '../db/schema';
import { studentProfiles } from '../db/schema';
import { db } from '../db/client';
import { tutorRepository } from '../repositories/tutorRepository';
import { guardianRepository } from '../repositories/guardianRepository';
import { badRequest, forbidden, notFound } from '../utils/errors';
import { progressService } from './progressService';

async function profileId(userId: string, role: Role) {
  const id = await guardianRepository.profileIdFor(userId, role);
  if (!id) throw forbidden('This dashboard is for parent and teacher accounts.');
  return id;
}

export const guardianService = {
  async link(userId: string, role: Role, code: string, guardianConsent = false) {
    const pid = await profileId(userId, role);
    const student = await guardianRepository.studentByLinkCode(code.trim().toUpperCase());
    if (!student) throw badRequest('This code did not match any student. Check it and try again.');
    await guardianRepository.link(role, pid, student.id);
    // Only a parent can confirm consent; a teacher link never counts as guardian consent
    if (role === 'PARENT' && guardianConsent) {
      await db.update(studentProfiles).set({ guardianConsentConfirmedAt: new Date() }).where(eq(studentProfiles.id, student.id));
    }
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
      db.query.studentProfiles.findFirst({ where: eq(studentProfiles.id, studentId), columns: { classLevel: true, board: true, district: true }, with: { user: { columns: { displayName: true } } } }),
      progressService.overview(studentId),
      progressService.activity(studentId),
      tutorRepository.countForStudent(studentId),
    ]);
    return {
      student: { id: studentId, displayName: student!.user.displayName, classLevel: student!.classLevel, board: student!.board, district: student!.district },
      ...overview,
      sessions: activity.sessions,
      tutorConversations: tutorCount,
    };
  },
};
