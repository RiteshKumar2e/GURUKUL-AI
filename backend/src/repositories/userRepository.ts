import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../db/client';
import {
  adaptiveRecommendations,
  learningProgress,
  learningSessions,
  parentProfiles,
  refreshTokens,
  studentAnswers,
  studentParents,
  studentProfiles,
  studentTeachers,
  syncRecords,
  teacherProfiles,
  tutorConversations,
  tutorMessages,
  users,
  type Language,
  type Role,
} from '../db/schema';

const publicColumns = {
  columns: { id: true, username: true, email: true, role: true, displayName: true, preferredLanguage: true, createdAt: true },
  with: {
    student: {
      columns: { id: true, classLevel: true, board: true, state: true, district: true, teachingLevel: true, dailyGoalMinutes: true, onboardingDone: true, linkCode: true },
    },
    parent: { columns: { id: true } },
    teacher: { columns: { id: true, schoolName: true } },
  },
} as const;

async function findPublicById(id: string) {
  return (await db.query.users.findFirst({ where: eq(users.id, id), ...publicColumns })) ?? null;
}

export type PublicUser = NonNullable<Awaited<ReturnType<typeof findPublicById>>>;

export const userRepository = {
  findByUsername: async (username: string) => (await db.query.users.findFirst({ where: eq(users.username, username), with: { student: true } })) ?? null,
  findPublicById,
  findById: async (id: string) => (await db.query.users.findFirst({ where: eq(users.id, id), with: { student: true } })) ?? null,

  /** Creates the user and its role profile atomically. */
  async create(data: {
    username: string;
    email?: string | null;
    passwordHash: string;
    role: Role;
    displayName: string;
    preferredLanguage: Language;
    linkCode?: string;
    schoolName?: string | null;
    guardianConsentDeclaredAt?: Date | null;
  }): Promise<PublicUser> {
    const id = await db.transaction(async (tx) => {
      const [u] = await tx
        .insert(users)
        .values({
          username: data.username,
          email: data.email || null,
          passwordHash: data.passwordHash,
          role: data.role,
          displayName: data.displayName,
          preferredLanguage: data.preferredLanguage,
        })
        .returning({ id: users.id });
      if (data.role === 'STUDENT') await tx.insert(studentProfiles).values({ userId: u.id, linkCode: data.linkCode!, guardianConsentDeclaredAt: data.guardianConsentDeclaredAt ?? null });
      if (data.role === 'PARENT') await tx.insert(parentProfiles).values({ userId: u.id });
      if (data.role === 'TEACHER') await tx.insert(teacherProfiles).values({ userId: u.id, schoolName: data.schoolName ?? null });
      return u.id;
    });
    return (await findPublicById(id))!;
  },

  async update(id: string, data: Partial<Pick<typeof users.$inferInsert, 'displayName' | 'preferredLanguage' | 'passwordHash' | 'lastLoginAt'>>) {
    if (Object.keys(data).length) await db.update(users).set(data).where(eq(users.id, id));
    return findPublicById(id);
  },

  /**
   * Permanently deletes an account and everything that belongs to it, in one transaction.
   * Done explicitly (child rows first) so it does not depend on SQLite foreign-key enforcement,
   * which is per-connection and off by default.
   */
  async delete(id: string) {
    await db.transaction(async (tx) => {
      const sp = await tx.select({ id: studentProfiles.id }).from(studentProfiles).where(eq(studentProfiles.userId, id));
      const pp = await tx.select({ id: parentProfiles.id }).from(parentProfiles).where(eq(parentProfiles.userId, id));
      const tp = await tx.select({ id: teacherProfiles.id }).from(teacherProfiles).where(eq(teacherProfiles.userId, id));
      for (const { id: sid } of sp) {
        const convs = await tx.select({ id: tutorConversations.id }).from(tutorConversations).where(eq(tutorConversations.studentId, sid));
        if (convs.length) await tx.delete(tutorMessages).where(inArray(tutorMessages.conversationId, convs.map((c) => c.id)));
        await tx.delete(tutorConversations).where(eq(tutorConversations.studentId, sid));
        await tx.delete(studentAnswers).where(eq(studentAnswers.studentId, sid));
        await tx.delete(learningSessions).where(eq(learningSessions.studentId, sid));
        await tx.delete(learningProgress).where(eq(learningProgress.studentId, sid));
        await tx.delete(adaptiveRecommendations).where(eq(adaptiveRecommendations.studentId, sid));
        await tx.delete(syncRecords).where(eq(syncRecords.studentId, sid));
        await tx.delete(studentParents).where(eq(studentParents.studentId, sid));
        await tx.delete(studentTeachers).where(eq(studentTeachers.studentId, sid));
      }
      for (const { id: pid } of pp) await tx.delete(studentParents).where(eq(studentParents.parentId, pid));
      for (const { id: tid } of tp) await tx.delete(studentTeachers).where(eq(studentTeachers.teacherId, tid));
      await tx.delete(studentProfiles).where(eq(studentProfiles.userId, id));
      await tx.delete(parentProfiles).where(eq(parentProfiles.userId, id));
      await tx.delete(teacherProfiles).where(eq(teacherProfiles.userId, id));
      await tx.delete(refreshTokens).where(eq(refreshTokens.userId, id));
      await tx.delete(users).where(eq(users.id, id));
    });
  },

  // refresh tokens
  saveRefreshToken: (userId: string, tokenHash: string, expiresAt: Date) => db.insert(refreshTokens).values({ userId, tokenHash, expiresAt }),
  findRefreshToken: async (tokenHash: string) =>
    (await db.query.refreshTokens.findFirst({ where: eq(refreshTokens.tokenHash, tokenHash), with: { user: { with: { student: true } } } })) ?? null,
  revokeRefreshToken: (tokenHash: string) =>
    db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt))),
  revokeAllForUser: (userId: string) =>
    db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt))),
};
