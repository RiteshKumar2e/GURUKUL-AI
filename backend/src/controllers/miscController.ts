import type { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { aiStatus } from '../services/ai';
import { guardianService } from '../services/guardianService';
import { contentMeta } from '../utils/contentMeta';

export const healthController = {
  async health(_req: Request, res: Response) {
    let db: 'up' | 'down' = 'up';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'down';
    }
    res.status(db === 'up' ? 200 : 503).json({ status: db === 'up' ? 'ok' : 'degraded', db, ai: aiStatus(), time: new Date().toISOString() });
  },
};

export const guardianController = {
  link: async (req: Request, res: Response) => res.status(201).json(await guardianService.link(req.user!.id, req.user!.role, req.body.code)),
  students: async (req: Request, res: Response) => res.json(await guardianService.students(req.user!.id, req.user!.role)),
  report: async (req: Request, res: Response) => res.json(await guardianService.report(req.user!.id, req.user!.role, req.params.studentId)),
  unlink: async (req: Request, res: Response) => {
    await guardianService.unlink(req.user!.id, req.user!.role, req.params.studentId);
    res.status(204).end();
  },
};

export const metaController = {
  content: (_req: Request, res: Response) => res.json(contentMeta()),
};

export const analyticsController = {
  /** Anonymous page view, only sent by the frontend after the visitor opts in. */
  async pageview(req: Request, res: Response) {
    await prisma.analyticsEvent.create({ data: { path: req.body.path, lang: req.body.lang } });
    res.status(204).end();
  },
};
