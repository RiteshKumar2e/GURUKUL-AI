export type Role = 'STUDENT' | 'PARENT' | 'TEACHER' | 'ADMIN';
export type Lang = 'HI' | 'EN';
export type TeachingLevel = 'BASIC' | 'STANDARD' | 'ADVANCED';

export interface User {
  id: string;
  username: string;
  email: string | null;
  role: Role;
  displayName: string;
  preferredLanguage: Lang;
  createdAt: string;
  student: {
    id: string;
    classLevel: number;
    board: string;
    state: string;
    district: string | null;
    teachingLevel: TeachingLevel;
    dailyGoalMinutes: number;
    onboardingDone: boolean;
    linkCode: string;
  } | null;
  parent: { id: string } | null;
  teacher: { id: string; schoolName: string | null } | null;
}

export interface Bilingual {
  hi: string;
  en: string;
}

export interface ChapterSummary {
  id: string;
  slug: string;
  number: number;
  nameHi: string;
  nameEn: string;
  summaryHi: string;
  summaryEn: string;
  source: 'ORIGINAL_SAMPLE' | 'VERIFIED_PUBLIC';
  topicCount: number;
  questionCount: number;
  hasAssessment: boolean;
  assessmentSlug: string | null;
  mastery: number;
  topicsStarted: number;
  lessonsCompleted: number;
}

export interface ContentMeta {
  description: string;
  curriculumVerification: { status: string; verifiedOn: string; note: string; sources: string[] };
  contentLicence: string;
}

export interface CurriculumOverview {
  subjects: Array<{ id: string; slug: string; nameHi: string; nameEn: string; classLevel: number; board: string }>;
  chapters: ChapterSummary[];
  meta: ContentMeta;
}

export interface TopicProgress {
  mastery: number;
  attempts: number;
  correct: number;
  lessonCompleted: boolean;
  level: number;
}

export interface ChapterDetail {
  id: string;
  slug: string;
  number: number;
  nameHi: string;
  nameEn: string;
  summaryHi: string;
  summaryEn: string;
  source: string;
  assessment: { slug: string; titleHi: string; titleEn: string; durationMinutes: number; questionCount: number } | null;
  topics: Array<{
    id: string;
    slug: string;
    order: number;
    titleHi: string;
    titleEn: string;
    summaryHi: string;
    summaryEn: string;
    estMinutes: number | null;
    questionCount: number;
    progress: TopicProgress | null;
  }>;
}

export interface LessonBlock {
  kind: 'para' | 'example' | 'note' | 'formula';
  hi?: string;
  en?: string;
}

export interface TopicDetail {
  id: string;
  slug: string;
  titleHi: string;
  titleEn: string;
  summaryHi: string;
  summaryEn: string;
  chapter: { id: string; slug: string; number: number; nameHi: string; nameEn: string };
  questionCount: number;
  lesson: { id: string; titleHi: string; titleEn: string; content: LessonBlock[]; estMinutes: number; source: string; version: number; updatedAt: string } | null;
  previous: { slug: string; titleHi: string; titleEn: string } | null;
  next: { slug: string; titleHi: string; titleEn: string } | null;
  progress: TopicProgress | null;
}

export interface QuestionOption {
  id: string;
  hi: string;
  en: string;
}

export interface PublicQuestion {
  id: string;
  slug: string;
  type: 'MCQ' | 'NUMERIC';
  difficulty: number;
  promptHi: string;
  promptEn: string;
  options: QuestionOption[] | null;
  hintHi?: string;
  hintEn?: string;
  topicId: string;
}

export interface NextQuestion {
  question: PublicQuestion;
  topic: { id: string; slug: string; titleHi: string; titleEn: string; chapterSlug: string } | null;
  level: number;
  mastery: number;
  allRecentlySolved: boolean;
}

export interface AnswerFeedback {
  isCorrect: boolean;
  correctAnswer: string;
  correctAnswerDisplay: Bilingual;
  explanationHi: string;
  explanationEn: string;
  progress?: { mastery: number; attempts: number; correct: number; level: number };
}

export interface Recommendation {
  id: string;
  kind: 'REVIEW_LESSON' | 'PRACTICE' | 'ADVANCE';
  reasonHi: string;
  reasonEn: string;
  priority: number;
  topic: { slug: string; titleHi: string; titleEn: string; chapter: { slug: string; number: number; nameHi: string; nameEn: string } };
}

export interface WeakTopic {
  topic: { id: string; slug: string; titleHi: string; titleEn: string; chapter: { slug: string; number: number; nameHi: string; nameEn: string } };
  mastery: number;
  attempts: number;
  accuracy: number;
}

export interface Totals {
  answered: number;
  correct: number;
  accuracy: number;
  topicsStarted: number;
  lessonsCompleted: number;
  topicCount: number;
  streakDays: number;
}

export interface DayActivity {
  date: string;
  answered: number;
  correct: number;
}

export interface SessionRow {
  id: string;
  type: 'LESSON' | 'PRACTICE' | 'QUIZ' | 'TUTOR' | 'VOICE' | 'PHOTO';
  startedAt: string;
  endedAt: string | null;
  score: number | null;
  total: number | null;
  topic: { slug: string; titleHi: string; titleEn: string } | null;
  chapter: { slug: string; nameHi: string; nameEn: string } | null;
  assessment: { slug: string; titleHi: string; titleEn: string } | null;
}

export interface Dashboard {
  totals: Totals;
  last7: DayActivity[];
  weakTopics: WeakTopic[];
  recommendations: Recommendation[];
  continueTopic: { slug: string; titleHi: string; titleEn: string } | null;
  recentSessions: SessionRow[];
}

export interface ProgressChapter {
  slug: string;
  number: number;
  nameHi: string;
  nameEn: string;
  mastery: number;
  topics: Array<{ slug: string; titleHi: string; titleEn: string; mastery: number; attempts: number; correct: number; level: number; lessonCompleted: boolean; lastActivityAt: string | null }>;
}

export interface ProgressOverview {
  totals: Totals;
  last7: DayActivity[];
  chapters: ProgressChapter[];
  weakTopics: WeakTopic[];
}

export interface GuardianStudent {
  id: string;
  displayName: string;
  classLevel: number;
  board: string;
  district: string | null;
  answered: number;
  accuracy: number;
  topicsStarted: number;
  lastActivityAt: string | null;
}

export interface GuardianReport extends ProgressOverview {
  student: { id: string; displayName: string; classLevel: number; board: string; district: string | null };
  sessions: SessionRow[];
  tutorConversations: number;
}

export interface TutorStructured {
  reply: string;
  steps: Array<{ title: string; detail: string }>;
  hint: string | null;
  finalAnswer: string | null;
  followUp: string | null;
  confidence: 'high' | 'medium' | 'low';
  caveat: string | null;
  verification: 'verified' | 'mismatch' | 'unchecked';
  computed?: number;
  demo?: boolean;
  intent: 'hint' | 'solution' | 'explain' | 'check';
  /** Language the reply was written in (older messages may not have it) */
  language?: TutorLanguage;
}

export type TutorLanguage = 'HI' | 'EN' | 'TE';
export type VoiceLang = 'hi' | 'en' | 'te';

export interface VoiceCapabilities {
  serverTranscription: boolean;
  serverSpeech: boolean;
  sttProvider: string;
  ttsProvider: string;
  llm: { provider: string; live: boolean };
  languages: VoiceLang[];
  maxRecordingSeconds: number;
}

export interface TutorMessage {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  structured: TutorStructured | null;
  provider: string | null;
  model: string | null;
  verification: string | null;
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  mode: 'TEXT' | 'VOICE' | 'PHOTO';
  topicId: string | null;
  createdAt: string;
  updatedAt: string;
  messages?: TutorMessage[];
  _count?: { messages: number };
}

export interface Health {
  status: string;
  db: 'up' | 'down';
  ai: { mode: 'live' | 'demo'; provider: string; model: string | null };
}

export interface QuizSummary {
  slug: string;
  titleHi: string;
  titleEn: string;
  durationMinutes: number;
  questionCount: number;
  chapter: { slug: string; number: number; nameHi: string; nameEn: string };
}

export interface QuizDetail {
  slug: string;
  titleHi: string;
  titleEn: string;
  durationMinutes: number;
  chapter: { id: string; slug: string; number: number; nameHi: string; nameEn: string };
  questions: PublicQuestion[];
}

export interface QuizResult {
  score: number;
  total: number;
  results: Array<AnswerFeedback & { questionId: string; promptHi: string; promptEn: string; answer: string; skipped: boolean }>;
}

export interface OfflineQuestion extends PublicQuestion {
  correctAnswer: string;
  correctAnswerDisplay: Bilingual;
  explanationHi: string;
  explanationEn: string;
}

export interface OfflinePack {
  version: number;
  generatedAt: string;
  chapter: { slug: string; number: number; nameHi: string; nameEn: string; summaryHi: string; summaryEn: string };
  topics: Array<{
    slug: string;
    titleHi: string;
    titleEn: string;
    summaryHi: string;
    summaryEn: string;
    lesson: { titleHi: string; titleEn: string; content: LessonBlock[]; estMinutes: number } | null;
    questions: OfflineQuestion[];
  }>;
}
