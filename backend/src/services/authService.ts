import bcrypt from 'bcryptjs';
import type { Language, Role } from '../db/schema';
import { isUniqueViolation } from '../db/client';
import { userRepository } from '../repositories/userRepository';
import { conflict, unauthorized, badRequest } from '../utils/errors';
import { createRefreshToken, generateLinkCode, hashRefreshToken, refreshExpiry, signAccessToken } from '../utils/tokens';

const BCRYPT_ROUNDS = 12;
// Used to keep login timing similar whether or not the username exists
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

export interface RegisterInput {
  role: Extract<Role, 'STUDENT' | 'PARENT' | 'TEACHER'>;
  username: string;
  displayName: string;
  password: string;
  email?: string;
  preferredLanguage: Language;
  schoolName?: string;
  website?: string; // honeypot
  /** Student declares that a parent or guardian agreed */
  guardianConsent?: boolean;
}

async function issueTokens(user: { id: string; role: Role; studentId?: string | null }) {
  const accessToken = signAccessToken({ sub: user.id, role: user.role, sid: user.studentId ?? undefined });
  const refreshToken = createRefreshToken();
  await userRepository.saveRefreshToken(user.id, hashRefreshToken(refreshToken), refreshExpiry());
  return { accessToken, refreshToken };
}

export const authService = {
  async register(input: RegisterInput) {
    if (input.website) throw badRequest('Registration could not be completed.');
    const username = input.username.trim().toLowerCase();
    if (await userRepository.findByUsername(username)) throw conflict('This username is already taken. Try another one.');
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    let lastErr: unknown;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const user = await userRepository.create({
          username,
          email: input.role === 'STUDENT' ? null : input.email?.trim().toLowerCase() || null,
          passwordHash,
          role: input.role,
          displayName: input.displayName.trim(),
          preferredLanguage: input.preferredLanguage,
          linkCode: input.role === 'STUDENT' ? generateLinkCode() : undefined,
          schoolName: input.schoolName,
          guardianConsentDeclaredAt: input.role === 'STUDENT' && input.guardianConsent ? new Date() : null,
        });
        const tokens = await issueTokens({ id: user.id, role: user.role, studentId: user.student?.id });
        return { user, ...tokens };
      } catch (err) {
        // retry only on a link-code collision; surface everything else
        if (isUniqueViolation(err)) {
          if (isUniqueViolation(err, 'users.email')) throw conflict('This email is already registered.');
          if (isUniqueViolation(err, 'users.username')) throw conflict('This username is already taken. Try another one.');
          lastErr = err; // link-code collision: try a new code
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  },

  async login(usernameRaw: string, password: string) {
    const user = await userRepository.findByUsername(usernameRaw.trim().toLowerCase());
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw unauthorized('Username or password is incorrect.');
    await userRepository.update(user.id, { lastLoginAt: new Date() });
    const tokens = await issueTokens({ id: user.id, role: user.role, studentId: user.student?.id });
    const publicUser = await userRepository.findPublicById(user.id);
    return { user: publicUser!, ...tokens };
  },

  async refresh(refreshToken: string | undefined) {
    if (!refreshToken) throw unauthorized('Sign in to continue.');
    const hash = hashRefreshToken(refreshToken);
    const stored = await userRepository.findRefreshToken(hash);
    if (!stored) throw unauthorized('Sign in to continue.');
    if (stored.revokedAt) {
      // Reuse of a rotated token: assume theft and end every session for this user
      await userRepository.revokeAllForUser(stored.userId);
      throw unauthorized('Your session ended. Please sign in again.');
    }
    if (stored.expiresAt < new Date()) throw unauthorized('Your session has expired. Please sign in again.');
    await userRepository.revokeRefreshToken(hash);
    const tokens = await issueTokens({ id: stored.user.id, role: stored.user.role, studentId: stored.user.student?.id });
    const user = await userRepository.findPublicById(stored.user.id);
    return { user: user!, ...tokens };
  },

  async logout(refreshToken: string | undefined) {
    if (refreshToken) await userRepository.revokeRefreshToken(hashRefreshToken(refreshToken));
  },

  async changePassword(userId: string, current: string, next: string) {
    const user = await userRepository.findById(userId);
    if (!user || !(await bcrypt.compare(current, user.passwordHash))) throw badRequest('Current password is incorrect.');
    await userRepository.update(userId, { passwordHash: await bcrypt.hash(next, BCRYPT_ROUNDS) });
    await userRepository.revokeAllForUser(userId);
  },
};
