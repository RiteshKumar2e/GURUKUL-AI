import { z } from 'zod';
import { eq } from 'drizzle-orm';
import type { ConversationMode } from '../../db/schema';
import { studentProfiles } from '../../db/schema';
import { db } from '../../db/client';
import { tutorRepository } from '../../repositories/tutorRepository';
import { curriculumRepository } from '../../repositories/curriculumRepository';
import { badRequest, notFound, unavailable } from '../../utils/errors';
import { AIProviderError, type ChatMessage } from '../ai';
import { getLlmProvider } from '../voice/registry';
import { systemPrompt, userTurn, type TutorIntent, type TutorLanguage } from './prompts';
import { calculatorFromText, verifyCheck, type CheckSpec } from './verifier';

const structuredSchema = z.object({
  reply: z.string().default(''),
  steps: z
    .array(z.object({ title: z.string().default(''), detail: z.string().default('') }))
    .default([])
    .catch([]),
  hint: z.string().nullable().optional().catch(null),
  finalAnswer: z.union([z.string(), z.number()]).nullable().optional().transform((v) => (v === null || v === undefined ? null : String(v))).catch(null),
  followUp: z.string().nullable().optional().catch(null),
  confidence: z.enum(['high', 'medium', 'low']).catch('low'),
  caveat: z.string().nullable().optional().catch(null),
  check: z
    .object({
      kind: z.enum(['arithmetic', 'linear']),
      expression: z.string().optional(),
      equation: z.string().optional(),
      variable: z.string().optional(),
      claimed: z.union([z.string(), z.number()]).transform(String),
    })
    .nullable()
    .optional()
    .catch(null),
});

export type TutorStructured = z.infer<typeof structuredSchema> & {
  verification: 'verified' | 'mismatch' | 'unchecked';
  computed?: number;
  demo?: boolean;
  intent: TutorIntent;
  /** Language the reply was written in, so the client can read it aloud with the right voice */
  language: TutorLanguage;
};

/** UI messages the server writes into replies. Telugu strings should be reviewed by a native speaker. */
const MSG = {
  demoReply: {
    HI: 'डेमो मोड: अभी AI ट्यूटर सर्वर से जुड़ा नहीं है, इसलिए यह पूरा समझाने वाला उत्तर नहीं है। जो संभव है वह नीचे है।',
    EN: 'Demo mode: the AI tutor is not connected on this server, so this is not a full explanation. Here is what can be done without it.',
    TE: 'డెమో మోడ్: ఈ సర్వర్‌లో AI ట్యూటర్ ఇంకా కనెక్ట్ కాలేదు, కాబట్టి ఇది పూర్తి వివరణ కాదు. AI లేకుండా చేయగలిగింది కింద ఉంది.',
  },
  calcTitle: { HI: 'कैलकुलेटर जाँच (AI नहीं)', EN: 'Calculator check (not AI)', TE: 'కాలిక్యులేటర్ తనిఖీ (AI కాదు)' },
  fromLesson: { HI: 'इस पाठ से', EN: 'From this lesson', TE: 'ఈ పాఠం నుండి' },
  demoCaveat: {
    HI: 'पूरा AI ट्यूटर चालू करने के लिए सर्वर पर AI key (Groq या Gemini) सेट करें। तब तक पाठ और अभ्यास प्रश्न पूरी तरह काम करते हैं।',
    EN: 'Set an AI key (Groq or Gemini) on the server to enable the full AI tutor. Lessons and practice work fully meanwhile.',
    TE: 'పూర్తి AI ట్యూటర్ కోసం సర్వర్‌లో AI కీ (Groq లేదా Gemini) సెట్ చేయండి. అప్పటి వరకు పాఠాలు, అభ్యాస ప్రశ్నలు పూర్తిగా పనిచేస్తాయి.',
  },
  badFormat: {
    HI: 'उत्तर अपेक्षित रूप में नहीं आया; ध्यान से जाँचें।',
    EN: 'The answer did not come in the expected format; check it carefully.',
    TE: 'సమాధానం ఆశించిన రూపంలో రాలేదు; జాగ్రత్తగా తనిఖీ చేయండి.',
  },
  mismatch: {
    HI: (n: number) => `कैलकुलेटर जाँच में अंतिम उत्तर मेल नहीं खाया (गणना: ${n})। इस उत्तर पर भरोसा न करें।`,
    EN: (n: number) => `The calculator check did not match the final answer (computed: ${n}). Do not rely on this answer.`,
    TE: (n: number) => `కాలిక్యులేటర్ తనిఖీలో చివరి సమాధానం సరిపోలలేదు (లెక్క: ${n}). ఈ సమాధానాన్ని నమ్మవద్దు.`,
  },
  unavailable: {
    HI: 'AI ट्यूटर अभी उपलब्ध नहीं है। थोड़ी देर बाद फिर कोशिश करें।',
    EN: 'The AI tutor is unavailable right now. Please try again shortly.',
    TE: 'AI ట్యూటర్ ఇప్పుడు అందుబాటులో లేదు. కొద్దిసేపటి తర్వాత మళ్లీ ప్రయత్నించండి.',
  },
} as const;

function extractJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        /* fall through */
      }
    }
    return null;
  }
}

function lessonContext(lesson: { content: unknown } | undefined, title: string) {
  if (!lesson || !Array.isArray(lesson.content)) return undefined;
  const lines = (lesson.content as Array<{ kind: string; hi?: string; en?: string }>).map((b) => `- ${b.en ?? ''}`).join('\n');
  return `Topic: ${title}\n${lines}`.slice(0, 2500);
}

function renderPlain(s: TutorStructured): string {
  const parts = [s.reply];
  if (s.steps.length) parts.push(s.steps.map((st, i) => `${i + 1}. ${st.title}: ${st.detail}`).join('\n'));
  if (s.hint) parts.push(`Hint: ${s.hint}`);
  if (s.finalAnswer) parts.push(`Answer: ${s.finalAnswer}`);
  if (s.followUp) parts.push(s.followUp);
  return parts.filter(Boolean).join('\n\n');
}

function demoReply(content: string, language: TutorLanguage, intent: TutorIntent, topic?: { titleHi: string; titleEn: string; summaryHi: string; summaryEn: string }): TutorStructured {
  const calc = calculatorFromText(content);
  const steps: Array<{ title: string; detail: string }> = [];
  if (calc) {
    const r = Math.round(calc.result * 10000) / 10000;
    steps.push({
      title: MSG.calcTitle[language],
      detail: calc.kind === 'linear' ? `${calc.input} ⇒ x = ${r}` : `${calc.input} = ${r}`,
    });
  }
  if (topic) {
    const useHi = language === 'HI';
    steps.push({ title: `${MSG.fromLesson[language]}: ${useHi ? topic.titleHi : topic.titleEn}`, detail: useHi ? topic.summaryHi : topic.summaryEn });
  }
  return {
    reply: MSG.demoReply[language],
    steps,
    hint: null,
    finalAnswer: null,
    followUp: null,
    confidence: 'low',
    caveat: MSG.demoCaveat[language],
    check: null,
    verification: calc ? 'verified' : 'unchecked',
    computed: calc?.result,
    demo: true,
    intent,
    language,
  };
}

export const tutorService = {
  list: (studentId: string) => tutorRepository.list(studentId),

  async create(studentId: string, input: { title?: string; mode?: ConversationMode; topicSlug?: string }) {
    let topicId: string | null = null;
    if (input.topicSlug) {
      const topic = await curriculumRepository.topicBySlug(input.topicSlug);
      if (!topic) throw notFound('Topic not found.');
      topicId = topic.id;
    }
    return tutorRepository.create(studentId, { title: input.title?.slice(0, 80) || 'नया सवाल', mode: input.mode ?? 'TEXT', topicId });
  },

  async get(studentId: string, id: string) {
    const c = await tutorRepository.findOwned(studentId, id);
    if (!c) throw notFound('Conversation not found.');
    return c;
  },

  async remove(studentId: string, id: string) {
    const r = await tutorRepository.remove(studentId, id);
    if (r.count === 0) throw notFound('Conversation not found.');
  },

  async ask(studentId: string, conversationId: string, input: { content: string; intent: TutorIntent; language?: TutorLanguage }) {
    const conversation = await tutorRepository.findOwned(studentId, conversationId);
    if (!conversation) throw notFound('Conversation not found.');
    const content = input.content.trim();
    if (!content) throw badRequest('Please type a question.');

    const student = await db.query.studentProfiles.findFirst({ where: eq(studentProfiles.id, studentId), with: { user: { columns: { preferredLanguage: true } } } });
    const language: TutorLanguage = input.language ?? student?.user.preferredLanguage ?? 'HI';
    const topic = conversation.topicId ? await curriculumRepository.topicById(conversation.topicId) : null;

    const userMsg = await tutorRepository.addMessage({ conversationId, role: 'USER', content });
    if (conversation.messages.length === 0 && conversation.title === 'नया सवाल') {
      await tutorRepository.setTitle(conversationId, content.slice(0, 70));
    }

    const provider = getLlmProvider();
    let structured: TutorStructured;
    let model: string | null = null;

    if (!provider.live) {
      structured = demoReply(content, language, input.intent, topic ?? undefined);
    } else {
      const history: ChatMessage[] = conversation.messages.slice(-10).map((m) => ({
        role: m.role === 'USER' ? 'user' : 'assistant',
        content: m.content.slice(0, 2000),
      }));
      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt({ language, level: student?.teachingLevel ?? 'STANDARD', voice: conversation.mode === 'VOICE', topicContext: topic ? lessonContext(topic.lessons[0], topic.titleEn) : undefined }) },
        ...history,
        { role: 'user', content: userTurn(content, input.intent) },
      ];
      try {
        const result = await provider.chat(messages, { json: true, temperature: 0.25 });
        model = result.model;
        const raw = extractJson(result.text);
        const parsed = structuredSchema.safeParse(raw ?? {});
        const base = parsed.success && (parsed.data.reply || parsed.data.steps.length)
          ? parsed.data
          : structuredSchema.parse({ reply: result.text.slice(0, 2000), confidence: 'low', caveat: MSG.badFormat[language] });
        if (input.intent === 'hint') base.finalAnswer = null; // never leak the answer on a hint request
        const v = verifyCheck(base.check as CheckSpec | null);
        structured = { ...base, verification: v.status, computed: v.computed, intent: input.intent, language };
        if (v.status === 'mismatch') {
          structured.confidence = 'low';
          structured.caveat = [
            structured.caveat,
            MSG.mismatch[language](Math.round((v.computed ?? 0) * 10000) / 10000),
          ]
            .filter(Boolean)
            .join(' ');
        }
      } catch (err) {
        if (err instanceof AIProviderError) {
          await tutorRepository.deleteMessage(userMsg.id).catch(() => undefined);
          console.warn(`[tutor] provider error: ${err.message}`);
          throw unavailable(MSG.unavailable[language]);
        }
        throw err;
      }
    }

    const assistant = await tutorRepository.addMessage({
      conversationId,
      role: 'ASSISTANT',
      content: renderPlain(structured),
      structured,
      provider: provider.name,
      model,
      verification: structured.verification,
    });
    return { userMessage: userMsg, assistantMessage: assistant };
  },
};
