import { z } from 'zod';

const username = z
  .string()
  .trim()
  .min(3, 'At least 3 characters')
  .max(24, 'At most 24 characters')
  .regex(/^[a-zA-Z0-9_.]+$/, 'Use only letters, numbers, dot and underscore');

const password = z.string().min(8, 'At least 8 characters').max(72, 'At most 72 characters');
const displayName = z.string().trim().min(2, 'At least 2 characters').max(40, 'At most 40 characters');
const language = z.enum(['HI', 'EN']);

export const registerSchema = z
  .object({
    role: z.enum(['STUDENT', 'PARENT', 'TEACHER']),
    username,
    displayName,
    password,
    email: z.string().trim().email('Enter a valid email').max(120).optional().or(z.literal('')),
    preferredLanguage: language.default('HI'),
    schoolName: z.string().trim().max(80).optional(),
    website: z.string().max(200).optional(), // honeypot: real users never see this field
    acceptTerms: z.literal(true, { errorMap: () => ({ message: 'Please accept the terms to continue' }) }),
  })
  .refine((v) => v.role === 'STUDENT' || !!v.email, { path: ['email'], message: 'Email is required for parent and teacher accounts' });

export const loginSchema = z.object({ username: z.string().trim().min(1, 'Enter your username').max(24), password: z.string().min(1, 'Enter your password').max(72) });

export const updateUserSchema = z.object({ displayName: displayName.optional(), preferredLanguage: language.optional() });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: password });
export const deleteAccountSchema = z.object({ password: z.string().min(1) });

export const updateStudentSchema = z.object({
  district: z.string().trim().max(40).nullable().optional(),
  teachingLevel: z.enum(['BASIC', 'STANDARD', 'ADVANCED']).optional(),
  dailyGoalMinutes: z.coerce.number().int().min(5).max(120).optional(),
  onboardingDone: z.boolean().optional(),
});

export const linkSchema = z.object({ code: z.string().trim().min(6).max(6) });
export const idParam = z.object({ id: z.string().min(1).max(40) });
export const studentIdParam = z.object({ studentId: z.string().min(1).max(40) });
export const slugParam = z.object({ slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/) });

export const practiceNextQuery = z.object({ topic: z.string().max(80).regex(/^[a-z0-9-]+$/).optional() });
export const practiceAnswerSchema = z.object({
  questionId: z.string().min(1).max(40),
  answer: z.string().trim().min(1, 'Enter an answer').max(100),
  timeTakenSec: z.coerce.number().int().min(0).max(36000).optional(),
  sessionId: z.string().max(40).optional(),
});
export const practiceSessionSchema = z.object({ topic: z.string().max(80).optional() });

export const quizSubmitSchema = z.object({
  answers: z.array(z.object({ questionId: z.string().min(1).max(40), answer: z.string().max(100) })).max(50),
});

export const createConversationSchema = z.object({
  title: z.string().trim().max(80).optional(),
  mode: z.enum(['TEXT', 'VOICE', 'PHOTO']).optional(),
  topicSlug: z.string().max(80).optional(),
});

export const askSchema = z.object({
  content: z.string().trim().min(1, 'Type your question').max(2000, 'Keep the question under 2000 characters'),
  intent: z.enum(['hint', 'solution', 'explain', 'check']).default('hint'),
  // Reply language for this question. TE (Telugu) is per-request only; the account language stays HI/EN.
  language: z.enum(['HI', 'EN', 'TE']).optional(),
});

export const voiceLanguage = z.enum(['hi', 'en', 'te']);
export const transcribeQuery = z.object({ language: voiceLanguage.default('hi') });
export const speakSchema = z.object({ text: z.string().trim().min(1, 'Nothing to read aloud').max(1500), language: voiceLanguage.default('hi') });

export const syncSchema = z.object({
  records: z
    .array(
      z.discriminatedUnion('kind', [
        z.object({
          clientId: z.string().min(8).max(64),
          kind: z.literal('answer'),
          createdAt: z.string().datetime(),
          payload: z.object({ questionId: z.string().min(1).max(40), answer: z.string().trim().min(1).max(100), timeTakenSec: z.number().int().min(0).max(36000).optional() }),
        }),
        z.object({
          clientId: z.string().min(8).max(64),
          kind: z.literal('lesson-complete'),
          createdAt: z.string().datetime(),
          payload: z.object({ topicSlug: z.string().min(1).max(80) }),
        }),
      ]),
    )
    .min(1)
    .max(200),
});

export const pageviewSchema = z.object({ path: z.string().max(120).regex(/^\/[\w\-/]*$/), lang: z.enum(['hi', 'en']).optional() });
