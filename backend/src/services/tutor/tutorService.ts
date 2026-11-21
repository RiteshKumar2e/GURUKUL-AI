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
import { adaptiveService } from '../adaptive-learning/adaptiveService';
import { stageOf, studentCurriculumService } from '../curriculum/studentCurriculum';
import { subjects as subjectsTable } from '../../db/schema';

const nullableText = z.string().nullable().optional().catch(null);

const structuredSchema = z.object({
  reply: z.string().default(''),
  understanding: nullableText,
  explanation: nullableText,
  outOfSyllabus: z.boolean().optional().catch(false),
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

/** Section headings in the fixed teaching order, used for the stored plain-text copy. */
export const SECTION_TITLES = {
  understanding: { HI: 'प्रश्न की समझ', EN: 'Understanding the question', TE: 'ప్రశ్న అర్థం' },
  hint: { HI: 'पहला संकेत', EN: 'First hint', TE: 'మొదటి సూచన' },
  explanation: { HI: 'आसान व्याख्या', EN: 'Simple explanation', TE: 'సులభ వివరణ' },
  steps: { HI: 'चरण-दर-चरण हल', EN: 'Step-by-step solution', TE: 'దశల వారీ పరిష్కారం' },
  finalAnswer: { HI: 'अंतिम उत्तर', EN: 'Final answer', TE: 'తుది సమాధానం' },
  followUp: { HI: 'अब आप कोशिश करें', EN: 'Now you try', TE: 'ఇప్పుడు మీరు ప్రయత్నించండి' },
} as const;

export function renderPlain(s: TutorStructured): string {
  const t = (k: keyof typeof SECTION_TITLES) => SECTION_TITLES[k][s.language];
  const parts: Array<string | null | undefined> = [s.reply];
  if (s.understanding) parts.push(`${t('understanding')}: ${s.understanding}`);
  if (s.hint) parts.push(`${t('hint')}: ${s.hint}`);
  if (s.explanation) parts.push(`${t('explanation')}: ${s.explanation}`);
  if (s.steps.length) parts.push(`${t('steps')}:\n${s.steps.map((st, i) => `${i + 1}. ${st.title}: ${st.detail}`).join('\n')}`);
  if (s.finalAnswer) parts.push(`${t('finalAnswer')}: ${s.finalAnswer}`);
  if (s.followUp) parts.push(`${t('followUp')}: ${s.followUp}`);
  return parts.filter(Boolean).join('\n\n');
}

/**
 * Turns the model's raw text into the structured reply. Pure, so the rules are unit-tested:
 *  - unparseable output is kept as plain text with low confidence and a warning;
 *  - a hint request never carries the final answer or a calculator check (whose computed value
 *    would give the answer away);
 *  - a calculator mismatch lowers confidence and tells the student not to rely on the answer.
 */
export function buildStructured(text: string, intent: TutorIntent, language: TutorLanguage): TutorStructured {
  const raw = extractJson(text);
  const parsed = structuredSchema.safeParse(raw ?? {});
  const base =
    parsed.success && (parsed.data.reply || parsed.data.steps.length)
      ? parsed.data
      : structuredSchema.parse({ reply: text.slice(0, 2000), confidence: 'low', caveat: MSG.badFormat[language] });
  if (intent === 'hint') {
    base.finalAnswer = null;
    base.check = null;
    base.steps = base.steps.slice(0, 1);
  }
  const v = verifyCheck(base.check as CheckSpec | null);
  const structured: TutorStructured = { ...base, outOfSyllabus: base.outOfSyllabus ?? false, verification: v.status, computed: v.computed, intent, language };
  if (v.status === 'mismatch') {
    structured.confidence = 'low';
    structured.caveat = [structured.caveat, MSG.mismatch[language](Math.round((v.computed ?? 0) * 10000) / 10000)].filter(Boolean).join(' ');
  }
  return structured;
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
    understanding: null,
    explanation: null,
    outOfSyllabus: false,
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

  async create(studentId: string, input: { title?: string; mode?: ConversationMode; topicSlug?: string; subjectSlug?: string }) {
    let topicId: string | null = null;
    let subjectId: string | null = null;
    if (input.topicSlug) {
      const topic = await curriculumRepository.topicBySlug(input.topicSlug);
      if (!topic) throw notFound('Topic not found.');
      topicId = topic.id;
    }
    if (input.subjectSlug) {
      // Only a subject the student actually studies, so class, board and subject stay consistent
      const mine = await studentCurriculumService.subjectIds(studentId);
      const subject = await db.query.subjects.findFirst({ where: eq(subjectsTable.slug, input.subjectSlug), columns: { id: true } });
      if (!subject || !mine.includes(subject.id)) throw badRequest('Choose one of your own subjects.');
      subjectId = subject.id;
    }
    return tutorRepository.create(studentId, { title: input.title?.slice(0, 80) || 'नया सवाल', mode: input.mode ?? 'TEXT', topicId, subjectId });
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
    const curriculum = await studentCurriculumService.active(studentId);
    const language: TutorLanguage = input.language ?? curriculum?.medium ?? student?.user.preferredLanguage ?? 'HI';
    const classLevel = curriculum?.classLevel ?? student?.classLevel ?? 9;
    const conversationSubject = conversation.subjectId ? curriculum?.subjects.find((s) => s.id === conversation.subjectId) : undefined;
    const learner = {
      classLevel,
      stage: stageOf(classLevel),
      board: curriculum?.board.code ?? student?.board ?? null,
      subjects: curriculum?.subjects.map((s) => s.nameEn),
      subject: conversationSubject?.nameEn ?? null,
    };
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
      const weak = await adaptiveService.weakTopics(studentId).catch(() => []);
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: systemPrompt({
            language,
            learner,
            level: student?.teachingLevel ?? 'STANDARD',
            voice: conversation.mode === 'VOICE',
            topicContext: topic ? lessonContext(topic.lessons[0], topic.titleEn) : undefined,
            weakTopics: weak.slice(0, 3).map((w) => `${w.topic.titleEn} (${Math.round(w.accuracy * 100)}% correct)`),
          }),
        },
        ...history,
        { role: 'user', content: userTurn(content, input.intent) },
      ];
      try {
        const result = await provider.chat(messages, { json: true, temperature: 0.25 });
        model = result.model;
        structured = buildStructured(result.text, input.intent, language);
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
