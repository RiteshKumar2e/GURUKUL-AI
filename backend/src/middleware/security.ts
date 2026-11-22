import type { NextFunction, Request, Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { env } from '../config/env';

const message = (text: string) => ({ error: { code: 'RATE_LIMITED', message: text } });

/**
 * The student's IP. Requests from the web app arrive through the Vercel /api rewrite, so the
 * connection IP is a shared Vercel address; Vercel passes the real client IP in
 * x-vercel-forwarded-for. Counting by the shared address would lock many students out at once.
 * A caller that reaches the API directly could fake that header, so login and registration also
 * have connectionLimiter below, which counts by the connection IP only.
 */
export function clientKey(req: Request): string {
  const header = req.headers['x-vercel-forwarded-for'];
  const forwarded = (Array.isArray(header) ? header[0] : header)?.split(',')[0]?.trim();
  return ipKeyGenerator(forwarded || req.ip || 'unknown');
}
const keyGenerator = (req: Request) => clientKey(req);

export const globalLimiter = rateLimit({
  keyGenerator,
  windowMs: 60_000,
  limit: env.isTest ? 10_000 : 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message('Too many requests. Please wait a minute.'),
});

export const authLimiter = rateLimit({
  keyGenerator,
  windowMs: 15 * 60_000,
  limit: env.isTest ? 10_000 : 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message('Too many sign-in attempts. Please try again in 15 minutes.'),
});

/** AI calls cost money and quota; keep them tighter per client. */
export const aiLimiter = rateLimit({
  keyGenerator,
  windowMs: 60_000,
  limit: env.isTest ? 10_000 : 12,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message('You are asking very fast. Take a breath and try again in a minute.'),
});

/** Read-aloud audio: cheaper than a tutor call and cached on the device, so a separate, looser budget. */
export const ttsLimiter = rateLimit({
  keyGenerator,
  windowMs: 60_000,
  limit: env.isTest ? 10_000 : 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message('Too many read-aloud requests. Please wait a minute.'),
});

/**
 * Second line of defence for sign-in: counts by connection IP only (cannot be faked by a header).
 * Generous, because every student using the web app shares Vercel's few outgoing addresses.
 */
export const connectionLimiter = rateLimit({
  keyGenerator: (req) => ipKeyGenerator(req.ip || 'unknown'),
  windowMs: 15 * 60_000,
  limit: env.isTest ? 10_000 : 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message('Too many sign-in attempts. Please try again in 15 minutes.'),
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
