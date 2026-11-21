import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { env } from '../config/env';
import { badRequest } from '../utils/errors';

export const uploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR);
fs.mkdirSync(uploadDir, { recursive: true });

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const AUDIO_TYPES = ['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/m4a', 'audio/x-m4a'];

const storage = multer.diskStorage({
  destination: uploadDir,
  // Random name; never trust the client's filename
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${path.extname(file.originalname).slice(0, 6).replace(/[^.a-z0-9]/gi, '')}`),
});

const maxBytes = env.MAX_UPLOAD_MB * 1024 * 1024;

export const imageUpload = multer({
  storage,
  limits: { fileSize: maxBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!IMAGE_TYPES.includes(file.mimetype)) return cb(badRequest('Please upload a JPG, PNG or WebP image.'));
    return cb(null, true);
  },
});

export const audioUpload = multer({
  storage,
  limits: { fileSize: maxBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    const base = file.mimetype.split(';')[0];
    if (!AUDIO_TYPES.includes(base)) return cb(badRequest('Unsupported audio format.'));
    return cb(null, true);
  },
});

/** Checks the real file signature, since the MIME type is client-controlled. */
export function detectImageType(buf: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

export async function removeFile(filePath?: string) {
  if (!filePath) return;
  await fs.promises.unlink(filePath).catch(() => undefined);
}
