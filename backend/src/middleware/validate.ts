import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { badRequest } from '../utils/errors';

type Part = 'body' | 'query' | 'params';

/** Validates and replaces req[part] with the parsed (and coerced) value. */
export const validate =
  (schema: ZodTypeAny, part: Part = 'body') =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      const fields = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
      return next(badRequest('Please check the highlighted fields.', fields));
    }
    if (part === 'query') {
      // req.query is a getter in some Express versions; mutate instead of reassigning
      Object.keys(req.query).forEach((k) => delete (req.query as Record<string, unknown>)[k]);
      Object.assign(req.query, result.data);
    } else {
      (req as unknown as Record<Part, unknown>)[part] = result.data;
    }
    return next();
  };
