import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client';
import { parentProfiles, studentParents, studentProfiles, studentTeachers, teacherProfiles, type Role } from '../db/schema';

/** Parents and teachers are both "guardians" for access-control purposes. */
export const guardianRepository = {
  profileIdFor: async (userId: string, role: Role): Promise<string | null> => {
    if (role === 'PARENT') return (await db.query.parentProfiles.findFirst({ where: eq(parentProfiles.userId, userId), columns: { id: true } }))?.id ?? null;
    if (role === 'TEACHER') return (await db.query.teacherProfiles.findFirst({ where: eq(teacherProfiles.userId, userId), columns: { id: true } }))?.id ?? null;
    return null;
  },

  studentByLinkCode: async (linkCode: string) =>
    (await db.query.studentProfiles.findFirst({ where: eq(studentProfiles.linkCode, linkCode), with: { user: { columns: { displayName: true } } } })) ?? null,

  /** Idempotent: linking twice is not an error (unique index + DO NOTHING). */
  link: (role: Role, profileId: string, studentId: string) =>
    role === 'PARENT'
      ? db.insert(studentParents).values({ studentId, parentId: profileId }).onConflictDoNothing()
      : db.insert(studentTeachers).values({ studentId, teacherId: profileId }).onConflictDoNothing(),

  unlink: (role: Role, profileId: string, studentId: string) =>
    role === 'PARENT'
      ? db.delete(studentParents).where(and(eq(studentParents.studentId, studentId), eq(studentParents.parentId, profileId)))
      : db.delete(studentTeachers).where(and(eq(studentTeachers.studentId, studentId), eq(studentTeachers.teacherId, profileId))),

  isLinked: async (role: Role, profileId: string, studentId: string) => {
    if (role === 'PARENT')
      return !!(await db.query.studentParents.findFirst({ where: and(eq(studentParents.studentId, studentId), eq(studentParents.parentId, profileId)), columns: { id: true } }));
    return !!(await db.query.studentTeachers.findFirst({ where: and(eq(studentTeachers.studentId, studentId), eq(studentTeachers.teacherId, profileId)), columns: { id: true } }));
  },

  linkedStudents: async (role: Role, profileId: string) => {
    const links =
      role === 'PARENT'
        ? await db.select({ studentId: studentParents.studentId }).from(studentParents).where(eq(studentParents.parentId, profileId))
        : await db.select({ studentId: studentTeachers.studentId }).from(studentTeachers).where(eq(studentTeachers.teacherId, profileId));
    if (!links.length) return [];
    return db.query.studentProfiles.findMany({
      where: inArray(
        studentProfiles.id,
        links.map((l) => l.studentId),
      ),
      columns: { id: true, classLevel: true, board: true, district: true },
      with: {
        user: { columns: { displayName: true } },
        progress: { columns: { mastery: true, attempts: true, correct: true, lastActivityAt: true } },
      },
    });
  },

  linkedGuardians: async (studentId: string) =>
    (await db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.id, studentId),
      columns: { id: true },
      with: {
        parents: { columns: { createdAt: true }, with: { parent: { columns: { id: true }, with: { user: { columns: { displayName: true } } } } } },
        teachers: { columns: { createdAt: true }, with: { teacher: { columns: { schoolName: true }, with: { user: { columns: { displayName: true } } } } } },
      },
    })) ?? null,
};
