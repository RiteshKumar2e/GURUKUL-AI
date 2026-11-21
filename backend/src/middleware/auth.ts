import type { NextFunction, Request, Response } from 'express';
import type { Role } from '../db/schema';
import { verifyAccessToken } from '../utils/tokens';
import { forbidden, unauthorized } from '../utils/errors';

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(unauthorized('Sign in to continue.'));
  try {
    const payload = verifyAccessToken(header.slice(7));
    req.user = { id: payload.sub, role: payload.role, studentId: payload.sid };
    return next();
  } catch {
    return next(unauthorized('Your session has expired.'));
  }
}

/** Attaches req.user when a valid token is present; otherwise continues anonymously. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = verifyAccessToken(header.slice(7));
      req.user = { id: payload.sub, role: payload.role, studentId: payload.sid };
    } catch {
      /* treat as anonymous */
    }
  }
  next();
}

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    return next();
  };

/** Student-only routes: guarantees req.user.studentId is set. */
export function requireStudent(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== 'STUDENT' || !req.user.studentId) return next(forbidden('This feature is for student accounts.'));
  return next();
}

export function studentId(req: Request): string {
  if (!req.user?.studentId) throw forbidden('This feature is for student accounts.');
  return req.user.studentId;
}
