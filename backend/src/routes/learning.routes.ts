import { Router } from 'express';
import { adaptiveController, assessmentController, practiceController, progressController, syncController } from '../controllers/learningController';
import { optionalAuth, requireAuth, requireStudent } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler as h } from '../utils/errors';
import { idParam, practiceAnswerSchema, practiceNextQuery, practiceSessionSchema, quizSubmitSchema, slugParam, syncSchema } from '../validators';

export const practiceRouter = Router();
practiceRouter.use(requireAuth, requireStudent);
practiceRouter.get('/next', validate(practiceNextQuery, 'query'), h(practiceController.next));
practiceRouter.post('/answer', validate(practiceAnswerSchema), h(practiceController.answer));
practiceRouter.post('/sessions', validate(practiceSessionSchema), h(practiceController.startSession));
practiceRouter.post('/sessions/:id/end', validate(idParam, 'params'), h(practiceController.endSession));

export const assessmentsRouter = Router();
assessmentsRouter.get('/', optionalAuth, h(assessmentController.list));
assessmentsRouter.get('/:slug', optionalAuth, validate(slugParam, 'params'), h(assessmentController.get));
assessmentsRouter.post('/:slug/start', requireAuth, requireStudent, validate(slugParam, 'params'), h(assessmentController.start));
assessmentsRouter.post('/sessions/:id/submit', requireAuth, requireStudent, validate(idParam, 'params'), validate(quizSubmitSchema), h(assessmentController.submit));

export const adaptiveRouter = Router();
adaptiveRouter.use(requireAuth, requireStudent);
adaptiveRouter.get('/recommendations', h(adaptiveController.recommendations));
adaptiveRouter.post('/recommendations/recompute', h(adaptiveController.recompute));
adaptiveRouter.post('/recommendations/:id/dismiss', validate(idParam, 'params'), h(adaptiveController.dismiss));
adaptiveRouter.get('/weak-topics', h(adaptiveController.weakTopics));

export const progressRouter = Router();
progressRouter.use(requireAuth, requireStudent);
progressRouter.get('/me', h(progressController.overview));
progressRouter.get('/me/activity', h(progressController.activity));

export const syncRouter = Router();
syncRouter.use(requireAuth, requireStudent);
syncRouter.post('/', validate(syncSchema), h(syncController.push));
