import type { Request, Response } from 'express';
import { studentId } from '../middleware/auth';
import { curriculumService, practiceService, assessmentService } from '../services/learningServices';
import { adaptiveService } from '../services/adaptive-learning/adaptiveService';
import { progressService } from '../services/progressService';
import { studentService } from '../services/studentService';
import { learningRepository } from '../repositories/learningRepository';
import { syncService } from '../services/sync/syncService';
import { catalogService, studentCurriculumService } from '../services/curriculum/studentCurriculum';

const classQuery = (req: Request) => ({
  board: typeof req.query.board === 'string' ? req.query.board : undefined,
  session: typeof req.query.session === 'string' ? req.query.session : undefined,
  classLevel: req.query.class ? Number(req.query.class) || undefined : undefined,
});

const optionalStudent = (req: Request) => (req.user?.role === 'STUDENT' ? req.user.studentId : undefined);

export const studentController = {
  profile: async (req: Request, res: Response) => res.json(await studentService.profile(studentId(req))),
  update: async (req: Request, res: Response) => res.json(await studentService.update(studentId(req), req.body)),
  dashboard: async (req: Request, res: Response) => res.json(await studentService.dashboard(studentId(req))),
  rotateCode: async (req: Request, res: Response) => res.json(await studentService.rotateLinkCode(studentId(req))),
  curriculum: async (req: Request, res: Response) => res.json({ curriculum: await studentCurriculumService.active(studentId(req)) }),
  curriculumHistory: async (req: Request, res: Response) => res.json(await studentCurriculumService.history(studentId(req))),
  setCurriculum: async (req: Request, res: Response) => {
    const sid = studentId(req);
    const curriculum = await studentCurriculumService.set(sid, req.body);
    await adaptiveService.recompute(sid);
    res.json({ curriculum });
  },
};

export const catalogController = {
  options: async (_req: Request, res: Response) => res.json(await catalogService.options()),
  subjects: async (req: Request, res: Response) => res.json(await catalogService.subjects(String(req.query.board), String(req.query.session), Number(req.query.class))),
};

export const curriculumController = {
  overview: async (req: Request, res: Response) => res.json(await curriculumService.overview(optionalStudent(req), classQuery(req))),
  chapters: async (req: Request, res: Response) => res.json((await curriculumService.overview(optionalStudent(req), classQuery(req))).chapters),
  chapter: async (req: Request, res: Response) => res.json(await curriculumService.chapter(req.params.slug, optionalStudent(req))),
  offlinePack: async (req: Request, res: Response) => res.json(await curriculumService.offlinePack(req.params.slug)),
  topic: async (req: Request, res: Response) => res.json(await curriculumService.topic(req.params.slug, optionalStudent(req))),
  completeTopic: async (req: Request, res: Response) => res.json(await curriculumService.completeLesson(studentId(req), req.params.slug)),
};

export const practiceController = {
  next: async (req: Request, res: Response) => res.json(await practiceService.next(studentId(req), req.query.topic as string | undefined)),
  answer: async (req: Request, res: Response) => res.json(await practiceService.answer(studentId(req), req.body)),
  startSession: async (req: Request, res: Response) => res.status(201).json(await practiceService.startSession(studentId(req), req.body.topic)),
  endSession: async (req: Request, res: Response) => res.json(await practiceService.endSession(studentId(req), req.params.id)),
};

export const assessmentController = {
  list: async (req: Request, res: Response) => res.json(await assessmentService.list(optionalStudent(req))),
  get: async (req: Request, res: Response) => res.json(await assessmentService.get(req.params.slug)),
  start: async (req: Request, res: Response) => res.status(201).json(await assessmentService.start(studentId(req), req.params.slug)),
  submit: async (req: Request, res: Response) => res.json(await assessmentService.submit(studentId(req), req.params.id, req.body.answers)),
};

export const adaptiveController = {
  recommendations: async (req: Request, res: Response) => res.json(await learningRepository.activeRecommendations(studentId(req))),
  recompute: async (req: Request, res: Response) => res.json(await adaptiveService.recompute(studentId(req))),
  dismiss: async (req: Request, res: Response) => {
    await learningRepository.dismissRecommendation(studentId(req), req.params.id);
    res.status(204).end();
  },
  weakTopics: async (req: Request, res: Response) => res.json(await adaptiveService.weakTopics(studentId(req))),
};

export const progressController = {
  overview: async (req: Request, res: Response) => res.json(await progressService.overview(studentId(req))),
  activity: async (req: Request, res: Response) => res.json(await progressService.activity(studentId(req))),
};

export const syncController = {
  push: async (req: Request, res: Response) => res.json(await syncService.apply(studentId(req), req.body.records)),
};
