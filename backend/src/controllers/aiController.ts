import type { Request, Response } from 'express';
import { studentId } from '../middleware/auth';
import { tutorService } from '../services/tutor/tutorService';
import { visionService } from '../services/vision/visionService';
import { voiceService } from '../services/voice/voiceService';
import { badRequest } from '../utils/errors';

export const tutorController = {
  list: async (req: Request, res: Response) => res.json(await tutorService.list(studentId(req))),
  create: async (req: Request, res: Response) => res.status(201).json(await tutorService.create(studentId(req), req.body)),
  get: async (req: Request, res: Response) => res.json(await tutorService.get(studentId(req), req.params.id)),
  ask: async (req: Request, res: Response) => res.json(await tutorService.ask(studentId(req), req.params.id, req.body)),
  remove: async (req: Request, res: Response) => {
    await tutorService.remove(studentId(req), req.params.id);
    res.status(204).end();
  },
};

export const visionController = {
  extract: async (req: Request, res: Response) => {
    if (!req.file) throw badRequest('Please attach a photo of the question.');
    res.json(await visionService.extractQuestion(req.file));
  },
};

export const voiceController = {
  capabilities: async (_req: Request, res: Response) => res.json(voiceService.capabilities()),
  transcribe: async (req: Request, res: Response) => {
    if (!req.file) throw badRequest('No recording was received.');
    res.json(await voiceService.transcribe(req.file, (req.query.language as 'hi' | 'en' | 'te') ?? 'hi'));
  },
  speak: async (req: Request, res: Response) => {
    const result = await voiceService.speak(req.body.text, req.body.language);
    res.set({ 'Content-Type': result.mimeType, 'Content-Length': String(result.audio.length), 'Cache-Control': 'private, max-age=86400', 'X-Voice-Provider': result.provider });
    res.send(result.audio);
  },
};
