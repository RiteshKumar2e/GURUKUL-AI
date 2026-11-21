import type { CookieOptions, Request, Response } from 'express';
import { env } from '../config/env';
import { authService } from '../services/authService';
import { userRepository } from '../repositories/userRepository';
import { notFound } from '../utils/errors';

const COOKIE = 'gk_rt';

const cookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE || env.COOKIE_SAMESITE === 'none',
  sameSite: env.COOKIE_SAMESITE,
  path: '/api/auth',
  maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 3600 * 1000,
});

function send(res: Response, status: number, result: { user: unknown; accessToken: string; refreshToken: string }) {
  res.cookie(COOKIE, result.refreshToken, cookieOptions());
  res.status(status).json({ user: result.user, accessToken: result.accessToken });
}

export const authController = {
  async register(req: Request, res: Response) {
    send(res, 201, await authService.register(req.body));
  },
  async login(req: Request, res: Response) {
    send(res, 200, await authService.login(req.body.username, req.body.password));
  },
  async refresh(req: Request, res: Response) {
    try {
      send(res, 200, await authService.refresh(req.cookies?.[COOKIE]));
    } catch (err) {
      res.clearCookie(COOKIE, { ...cookieOptions(), maxAge: undefined });
      throw err;
    }
  },
  async logout(req: Request, res: Response) {
    await authService.logout(req.cookies?.[COOKIE]);
    res.clearCookie(COOKIE, { ...cookieOptions(), maxAge: undefined });
    res.status(204).end();
  },
  async me(req: Request, res: Response) {
    const user = await userRepository.findPublicById(req.user!.id);
    if (!user) throw notFound('Account not found.');
    res.json({ user });
  },
  clearCookie(res: Response) {
    res.clearCookie(COOKIE, { ...cookieOptions(), maxAge: undefined });
  },
};
