import type { Request, Response } from 'express';
import { checkDatabase, db } from '../db/client';
import { analyticsEvents } from '../db/schema';
import { aiStatus } from '../services/ai';
import { guardianService } from '../services/guardianService';
import { contentMeta } from '../utils/contentMeta';

export const healthController = {
  async health(_req: Request, res: Response) {
    const d = await checkDatabase();
    const up = d.ok && d.migrated !== false;
    res.status(up ? 200 : 503).json({
      status: up ? 'ok' : 'degraded',
      db: up ? 'up' : 'down',
      database: { driver: d.driver, location: d.location, latencyMs: d.latencyMs, migrated: d.migrated, foreignKeys: d.foreignKeys, ...(d.ok ? {} : { error: 'unreachable' }) },
      ai: aiStatus(),
      time: new Date().toISOString(),
    });
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
    await db.insert(analyticsEvents).values({ path: req.body.path, lang: req.body.lang });
    res.status(204).end();
  },
};
