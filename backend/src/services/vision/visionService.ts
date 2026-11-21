import fs from 'fs';
import { z } from 'zod';
import { getAIProvider, AIProviderError } from '../ai';
import { VISION_PROMPT } from '../tutor/prompts';
import { detectImageType, removeFile } from '../../middleware/upload';
import { badRequest, unavailable } from '../../utils/errors';

// Groq accepts base64 images up to ~4 MB; base64 adds ~33%.
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

const resultSchema = z.object({
  question: z.string().default(''),
  language: z.enum(['hi', 'en', 'mixed']).catch('mixed'),
  readable: z.boolean().catch(true),
  notes: z.string().catch(''),
});

export const visionService = {
  async extractQuestion(file: Express.Multer.File) {
    try {
      const buffer = await fs.promises.readFile(file.path);
      const type = detectImageType(buffer);
      if (!type) throw badRequest('This file is not a valid JPG, PNG or WebP image.');
      if (buffer.length > MAX_IMAGE_BYTES) throw badRequest('The photo is too large. Please retake it or crop it closer to the question.');

      const provider = getAIProvider();
      if (!provider.live) {
        throw unavailable('Reading photos needs the AI service, which is not configured on this server (demo mode). Please type the question instead.');
      }
      const dataUrl = `data:${type};base64,${buffer.toString('base64')}`;
      try {
        const res = await provider.vision(VISION_PROMPT, dataUrl, { json: true, temperature: 0, maxTokens: 600 });
        let raw: unknown = {};
        try {
          raw = JSON.parse(res.text);
        } catch {
          raw = { question: res.text, readable: true, notes: '' };
        }
        const parsed = resultSchema.parse(raw);
        return { ...parsed, question: parsed.question.trim(), model: res.model, provider: res.provider };
      } catch (err) {
        if (err instanceof AIProviderError) throw unavailable('Could not read the photo right now. Please try again or type the question.');
        throw err;
      }
    } finally {
      // Photos may contain a student's handwriting or notebook; never keep them.
      await removeFile(file.path);
    }
  },
};
