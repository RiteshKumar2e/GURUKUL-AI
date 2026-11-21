import type { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

const message = (text: string) => ({ error: { code: 'RATE_LIMITED', message: text } });

export const globalLimiter = rateLimit({
  windowMs: 60_000,
  limit: env.isTest ? 10_000 : 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message('Too many requests. Please wait a minute.'),
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: env.isTest ? 10_000 : 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message('Too many sign-in attempts. Please try again in 15 minutes.'),
});

/** AI calls cost money and quota; keep them tighter per client. */
export const aiLimiter = rateLimit({
  windowMs: 60_000,
  limit: env.isTest ? 10_000 : 12,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message('You are asking very fast. Take a breath and try again in a minute.'),
});

/** Read-aloud audio: cheaper than a tutor call and cached on the device, so a separate, looser budget. */
export const ttsLimiter = rateLimit({
  windowMs: 60_000,
  limit: env.isTest ? 10_000 : 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message('Too many read-aloud requests. Please wait a minute.'),
});

/** Redirects plain HTTP to HTTPS when running behind a TLS-terminating proxy. */
export function enforceHttps(req: Request, res: Response, next: NextFunction) {
  if (!env.ENFORCE_HTTPS) return next();
  // Hosting platforms (e.g. Render) probe the health check over internal HTTP; it returns no private data
  if (req.path === '/api/health') return next();
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') return next();
  if (req.method === 'GET' || req.method === 'HEAD') return res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
  return res.status(403).json({ error: { code: 'HTTPS_REQUIRED', message: 'Use HTTPS.' } });
}
