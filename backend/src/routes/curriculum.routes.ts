import { Router } from 'express';
import { curriculumController } from '../controllers/learningController';
import { metaController } from '../controllers/miscController';
import { optionalAuth, requireAuth, requireStudent } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler as h } from '../utils/errors';
import { slugParam } from '../validators';

export const curriculumRouter = Router();
curriculumRouter.get('/', optionalAuth, h(curriculumController.overview));
curriculumRouter.get('/sources', metaController.content);

export const chaptersRouter = Router();
chaptersRouter.get('/', optionalAuth, h(curriculumController.chapters));
chaptersRouter.get('/:slug', optionalAuth, validate(slugParam, 'params'), h(curriculumController.chapter));
chaptersRouter.get('/:slug/offline-pack', requireAuth, validate(slugParam, 'params'), h(curriculumController.offlinePack));

export const topicsRouter = Router();
topicsRouter.get('/:slug', optionalAuth, validate(slugParam, 'params'), h(curriculumController.topic));
topicsRouter.post('/:slug/complete', requireAuth, requireStudent, validate(slugParam, 'params'), h(curriculumController.completeTopic));
