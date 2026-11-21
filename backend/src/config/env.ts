import 'dotenv/config';
import { z } from 'zod';

const bool = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  AI_PROVIDER: z.enum(['groq', 'openai-compatible']).default('groq'),
  AI_API_KEY: z.string().optional().default(''),
  AI_MODEL: z.string().optional().default('openai/gpt-oss-120b'),
  AI_BASE_URL: z.string().url().optional().default('https://api.groq.com/openai/v1'),
  AI_VISION_MODEL: z.string().optional().default('qwen/qwen3.8-27b'),
  AI_STT_MODEL: z.string().optional().default('whisper-large-v3'),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),

  // Tutor LLM: auto = Groq if AI_API_KEY is set, else Gemini if GEMINI_API_KEY is set, else demo mode
  LLM_PROVIDER: z.enum(['auto', 'groq', 'gemini']).default('auto'),
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_BASE_URL: z.string().url().optional().default('https://generativelanguage.googleapis.com/v1beta/openai'),
  GEMINI_MODEL: z.string().optional().default('gemini-2.5-flash'),

  // Voice: auto = Sarvam if SARVAM_API_KEY is set (best for Telugu/Hindi), else Groq Whisper, else browser only
  STT_PROVIDER: z.enum(['auto', 'sarvam', 'groq', 'none']).default('auto'),
  // auto = Sarvam if SARVAM_API_KEY is set, else the browser's own speechSynthesis
  TTS_PROVIDER: z.enum(['auto', 'sarvam', 'browser']).default('auto'),
  SARVAM_API_KEY: z.string().optional().default(''),
  SARVAM_BASE_URL: z.string().url().optional().default('https://api.sarvam.ai'),
  SARVAM_STT_MODEL: z.string().optional().default('saarika:v2.5'),
  SARVAM_TTS_MODEL: z.string().optional().default('bulbul:v2'),
  SARVAM_TTS_SPEAKER: z.string().optional().default('anushka'),
  VOICE_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  FRONTEND_URL: z.string().min(1).default('http://localhost:5173'),
  UPLOAD_DIR: z.string().default('uploads'),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(6),
  COOKIE_SECURE: bool,
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  ENFORCE_HTTPS: bool,
  TRUST_PROXY: bool,
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  // eslint-disable-next-line no-console
  console.error(`\nInvalid environment configuration:\n${issues}\n\nCopy backend/.env.example to backend/.env and fill the values.\n`);
  process.exit(1);
}

const data = parsed.data;

if (data.NODE_ENV === 'production') {
  if (!data.COOKIE_SECURE) console.warn('[env] COOKIE_SECURE should be true in production');
  if (data.JWT_SECRET === data.JWT_REFRESH_SECRET) {
    console.error('[env] JWT_SECRET and JWT_REFRESH_SECRET must differ');
    process.exit(1);
  }
}

export const env = {
  ...data,
  isProd: data.NODE_ENV === 'production',
  isTest: data.NODE_ENV === 'test',
  aiEnabled: data.AI_API_KEY.trim().length > 0,
  geminiEnabled: data.GEMINI_API_KEY.trim().length > 0,
  sarvamEnabled: data.SARVAM_API_KEY.trim().length > 0,
  frontendOrigins: data.FRONTEND_URL.split(',').map((s) => s.trim()).filter(Boolean),
};
