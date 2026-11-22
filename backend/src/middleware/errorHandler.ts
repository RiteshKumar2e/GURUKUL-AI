import type { NextFunction, Request, Response } from 'express';
import { dbErrorInfo, isForeignKeyViolation, isUniqueViolation } from '../db/client';
import multer from 'multer';
import { AppError } from '../utils/errors';
import { env } from '../config/env';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` } });
}

const SOFT_ERROR_PATHS = /\/auth\/(login|register)$/;
const SOFT_ERROR_STATUSES = new Set([400, 401, 409]);
function wantsSoftError(req: Request, status: number) {
  return req.get('x-soft-errors') === '1' && SOFT_ERROR_STATUSES.has(status) && SOFT_ERROR_PATHS.test(req.originalUrl.split('?')[0]);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    const body = { error: { code: err.code, message: err.message, details: err.details } };
    // Expected form mistakes on the login and sign-up pages (wrong password, username taken):
    // the app shows them in the form. When it asks with `X-Soft-Errors: 1`, answer 200 with the
    // real status in the body, so the browser does not also print a red network error in the
    // console. Every other client still gets the normal 4xx status.
    if (wantsSoftError(req, err.status)) return res.status(200).json({ ...body, error: { ...body.error, status: err.status } });
    return res.status(err.status).json(body);
  }
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? `File is too large (max ${env.MAX_UPLOAD_MB} MB).` : 'Upload failed.';
    return res.status(400).json({ error: { code: 'UPLOAD_ERROR', message } });
  }
  if (isUniqueViolation(err)) return res.status(409).json({ error: { code: 'CONFLICT', message: 'This already exists.' } });
  if (isForeignKeyViolation(err)) return res.status(400).json({ error: { code: 'INVALID_REFERENCE', message: 'A referenced item does not exist.' } });
  if (dbErrorInfo(err) || /fetch failed|ECONNREFUSED|ETIMEDOUT/i.test(String((err as Error)?.message))) {
    console.error(`[db] ${req.method} ${req.originalUrl}`, dbErrorInfo(err)?.code ?? (err as Error).message);
    return res.status(503).json({ error: { code: 'DB_UNAVAILABLE', message: 'The database is not reachable right now. Please try again shortly.' } });
  }
  if (err instanceof SyntaxError && 'body' in (err as object)) {
    return res.status(400).json({ error: { code: 'BAD_JSON', message: 'Request body is not valid JSON.' } });
  }
  console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  return res.status(500).json({
    error: { code: 'INTERNAL', message: 'Something went wrong on our side. Please try again.' },
  });
}
