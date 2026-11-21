import { Router } from 'express';
import { tutorController, visionController, voiceController } from '../controllers/aiController';
import { requireAuth, requireStudent } from '../middleware/auth';
import { aiLimiter, ttsLimiter } from '../middleware/security';
import { audioUpload, imageUpload } from '../middleware/upload';
import { validate } from '../middleware/validate';
import { asyncHandler as h } from '../utils/errors';
import { askSchema, createConversationSchema, idParam, speakSchema, transcribeQuery } from '../validators';

export const tutorRouter = Router();
tutorRouter.use(requireAuth, requireStudent);
tutorRouter.get('/conversations', h(tutorController.list));
tutorRouter.post('/conversations', validate(createConversationSchema), h(tutorController.create));
tutorRouter.get('/conversations/:id', validate(idParam, 'params'), h(tutorController.get));
tutorRouter.post('/conversations/:id/messages', aiLimiter, validate(idParam, 'params'), validate(askSchema), h(tutorController.ask));
tutorRouter.delete('/conversations/:id', validate(idParam, 'params'), h(tutorController.remove));

export const voiceRouter = Router();
voiceRouter.get('/capabilities', h(voiceController.capabilities));
voiceRouter.post('/speak', requireAuth, requireStudent, ttsLimiter, validate(speakSchema), h(voiceController.speak));
voiceRouter.post('/transcribe', requireAuth, requireStudent, aiLimiter, validate(transcribeQuery, 'query'), audioUpload.single('audio'), h(voiceController.transcribe));

export const visionRouter = Router();
visionRouter.post('/extract', requireAuth, requireStudent, aiLimiter, imageUpload.single('image'), h(visionController.extract));
