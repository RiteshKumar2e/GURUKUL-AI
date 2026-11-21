import type { Role } from '@prisma/client';
import { prisma } from '../config/prisma';

/** Parents and teachers are both "guardians" for access-control purposes. */
export const guardianRepository = {
  profileIdFor: async (userId: string, role: Role): Promise<string | null> => {
    if (role === 'PARENT') return (await prisma.parentProfile.findUnique({ where: { userId } }))?.id ?? null;
    if (role === 'TEACHER') return (await prisma.teacherProfile.findUnique({ where: { userId } }))?.id ?? null;
    return null;
  },

  studentByLinkCode: (linkCode: string) =>
    prisma.studentProfile.findUnique({ where: { linkCode }, include: { user: { select: { displayName: true } } } }),

  link: (role: Role, profileId: string, studentId: string) =>
    role === 'PARENT'
      ? prisma.studentParent.upsert({
          where: { studentId_parentId: { studentId, parentId: profileId } },
          create: { studentId, parentId: profileId },
          update: {},
        })
      : prisma.studentTeacher.upsert({
          where: { studentId_teacherId: { studentId, teacherId: profileId } },
          create: { studentId, teacherId: profileId },
          update: {},
        }),

  unlink: (role: Role, profileId: string, studentId: string) =>
    role === 'PARENT'
      ? prisma.studentParent.deleteMany({ where: { studentId, parentId: profileId } })
      : prisma.studentTeacher.deleteMany({ where: { studentId, teacherId: profileId } }),

  isLinked: async (role: Role, profileId: string, studentId: string) => {
    if (role === 'PARENT') return !!(await prisma.studentParent.findUnique({ where: { studentId_parentId: { studentId, parentId: profileId } } }));
    return !!(await prisma.studentTeacher.findUnique({ where: { studentId_teacherId: { studentId, teacherId: profileId } } }));
  },

  linkedStudents: (role: Role, profileId: string) => {
    const where = role === 'PARENT' ? { parents: { some: { parentId: profileId } } } : { teachers: { some: { teacherId: profileId } } };
    return prisma.studentProfile.findMany({
      where,
      select: {
        id: true,
        classLevel: true,
        board: true,
        district: true,
        user: { select: { displayName: true } },
        progress: { select: { mastery: true, attempts: true, correct: true, lastActivityAt: true } },
      },
    });
  },

  linkedGuardians: (studentId: string) =>
    prisma.studentProfile.findUnique({
      where: { id: studentId },
      select: {
        parents: { select: { parent: { select: { user: { select: { displayName: true } } } }, createdAt: true } },
        teachers: { select: { teacher: { select: { schoolName: true, user: { select: { displayName: true } } } }, createdAt: true } },
      },
    }),
};
