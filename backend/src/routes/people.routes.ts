import { Router } from 'express';
import { studentController } from '../controllers/learningController';
import { guardianController } from '../controllers/miscController';
import { requireAuth, requireRole, requireStudent } from '../middleware/auth';
import { authLimiter } from '../middleware/security';
import { validate } from '../middleware/validate';
import { asyncHandler as h } from '../utils/errors';
import { linkSchema, studentIdParam, updateStudentSchema } from '../validators';

export const studentsRouter = Router();
studentsRouter.use(requireAuth, requireStudent);
studentsRouter.get('/me', h(studentController.profile));
studentsRouter.patch('/me', validate(updateStudentSchema), h(studentController.update));
studentsRouter.get('/me/dashboard', h(studentController.dashboard));
studentsRouter.post('/me/link-code', h(studentController.rotateCode));

/** Parent and teacher ("guardian") access. Every student route checks the link first. */
export const parentsRouter = Router();
parentsRouter.use(requireAuth, requireRole('PARENT', 'TEACHER'));
parentsRouter.post('/link', authLimiter, validate(linkSchema), h(guardianController.link));
parentsRouter.get('/students', h(guardianController.students));
parentsRouter.get('/students/:studentId/report', validate(studentIdParam, 'params'), h(guardianController.report));
parentsRouter.delete('/students/:studentId', validate(studentIdParam, 'params'), h(guardianController.unlink));
