import type { Language, Prisma, Role } from '@prisma/client';
import { prisma } from '../config/prisma';

const publicUser = {
  id: true,
  username: true,
  email: true,
  role: true,
  displayName: true,
  preferredLanguage: true,
  createdAt: true,
  student: {
    select: {
      id: true,
      classLevel: true,
      board: true,
      state: true,
      district: true,
      teachingLevel: true,
      dailyGoalMinutes: true,
      onboardingDone: true,
      linkCode: true,
    },
  },
  parent: { select: { id: true } },
  teacher: { select: { id: true, schoolName: true } },
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUser }>;

export const userRepository = {
  findByUsername: (username: string) => prisma.user.findUnique({ where: { username }, include: { student: true } }),
  findPublicById: (id: string) => prisma.user.findUnique({ where: { id }, select: publicUser }),
  findById: (id: string) => prisma.user.findUnique({ where: { id }, include: { student: true } }),

  create(data: {
    username: string;
    email?: string | null;
    passwordHash: string;
    role: Role;
    displayName: string;
    preferredLanguage: Language;
    linkCode?: string;
    schoolName?: string | null;
  }) {
    return prisma.user.create({
      data: {
        username: data.username,
        email: data.email || null,
        passwordHash: data.passwordHash,
        role: data.role,
        displayName: data.displayName,
        preferredLanguage: data.preferredLanguage,
        student: data.role === 'STUDENT' ? { create: { linkCode: data.linkCode! } } : undefined,
        parent: data.role === 'PARENT' ? { create: {} } : undefined,
        teacher: data.role === 'TEACHER' ? { create: { schoolName: data.schoolName ?? null } } : undefined,
      },
      select: publicUser,
    });
  },

  update: (id: string, data: Prisma.UserUpdateInput) => prisma.user.update({ where: { id }, data, select: publicUser }),
  delete: (id: string) => prisma.user.delete({ where: { id } }),

  // refresh tokens
  saveRefreshToken: (userId: string, tokenHash: string, expiresAt: Date) =>
    prisma.refreshToken.create({ data: { userId, tokenHash, expiresAt } }),
  findRefreshToken: (tokenHash: string) => prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: { include: { student: true } } } }),
  revokeRefreshToken: (tokenHash: string) =>
    prisma.refreshToken.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } }),
  revokeAllForUser: (userId: string) =>
    prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
};
