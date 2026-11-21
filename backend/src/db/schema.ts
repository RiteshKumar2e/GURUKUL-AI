/**
 * GURUKUL AI data model for Turso / libSQL (SQLite dialect), ported 1:1 from the former
 * Prisma/PostgreSQL schema. Same tables, relations, unique constraints and indexes.
 *
 * SQLite type mapping used here:
 *   - ids            -> TEXT (UUID generated in the app; old cuid ids are kept when copied)
 *   - enums          -> TEXT limited to the listed values (checked by the app and by CHECK-free
 *                       typing; Zod validates every value that comes from a request)
 *   - DateTime       -> INTEGER milliseconds since epoch (mode 'timestamp_ms')
 *   - Boolean        -> INTEGER 0/1
 *   - Float          -> REAL
 *   - Json           -> TEXT holding JSON (mode 'json')
 *
 * Column names are snake_case in the database (drizzle `casing: 'snake_case'`).
 */
import { randomUUID } from 'crypto';
import { relations } from 'drizzle-orm';
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const ROLES = ['STUDENT', 'PARENT', 'TEACHER', 'ADMIN'] as const;
export const LANGUAGES = ['HI', 'EN'] as const;
export const TEACHING_LEVELS = ['BASIC', 'STANDARD', 'ADVANCED'] as const;
export const CONTENT_SOURCES = ['ORIGINAL_SAMPLE', 'VERIFIED_PUBLIC'] as const;
export const QUESTION_TYPES = ['MCQ', 'NUMERIC'] as const;
export const SESSION_TYPES = ['LESSON', 'PRACTICE', 'QUIZ', 'TUTOR', 'VOICE', 'PHOTO'] as const;
export const ANSWER_ORIGINS = ['ONLINE', 'OFFLINE_SYNC'] as const;
export const RECOMMENDATION_KINDS = ['REVIEW_LESSON', 'PRACTICE', 'ADVANCE'] as const;
export const RECOMMENDATION_STATUSES = ['ACTIVE', 'DONE', 'DISMISSED'] as const;
export const CONVERSATION_MODES = ['TEXT', 'VOICE', 'PHOTO'] as const;
export const MESSAGE_ROLES = ['USER', 'ASSISTANT'] as const;
export const SYNC_STATUSES = ['PENDING', 'APPLIED', 'DUPLICATE', 'REJECTED'] as const;

const id = () => text().primaryKey().$defaultFn(() => randomUUID());
const createdAt = () => integer({ mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date());
const updatedAt = () =>
  integer({ mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date());

export type LessonBlock = { kind: 'para' | 'example' | 'note' | 'formula'; hi?: string; en?: string; [k: string]: unknown };
export type QuestionOption = { id: string; hi: string; en: string };

/* ------------------------------------------------------------------ people */

export const users = sqliteTable('users', {
  id: id(),
  username: text().notNull().unique(),
  email: text().unique(),
  passwordHash: text().notNull(),
  role: text({ enum: ROLES }).notNull(),
  displayName: text().notNull(),
  preferredLanguage: text({ enum: LANGUAGES }).notNull().default('HI'),
  lastLoginAt: integer({ mode: 'timestamp_ms' }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const refreshTokens = sqliteTable(
  'refresh_tokens',
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text().notNull().unique(),
    expiresAt: integer({ mode: 'timestamp_ms' }).notNull(),
    revokedAt: integer({ mode: 'timestamp_ms' }),
    createdAt: createdAt(),
  },
  (t) => [index('refresh_tokens_user_id_idx').on(t.userId)],
);

export const studentProfiles = sqliteTable('student_profiles', {
  id: id(),
  userId: text()
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  classLevel: integer().notNull().default(9),
  board: text().notNull().default('JAC'),
  state: text().notNull().default('Jharkhand'),
  district: text(),
  teachingLevel: text({ enum: TEACHING_LEVELS }).notNull().default('STANDARD'),
  dailyGoalMinutes: integer().notNull().default(20),
  onboardingDone: integer({ mode: 'boolean' }).notNull().default(false),
  linkCode: text().notNull().unique(),
  createdAt: createdAt(),
});

export const parentProfiles = sqliteTable('parent_profiles', {
  id: id(),
  userId: text()
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: createdAt(),
});

export const teacherProfiles = sqliteTable('teacher_profiles', {
  id: id(),
  userId: text()
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  schoolName: text(),
  createdAt: createdAt(),
});

export const studentParents = sqliteTable(
  'student_parents',
  {
    id: id(),
    studentId: text()
      .notNull()
      .references(() => studentProfiles.id, { onDelete: 'cascade' }),
    parentId: text()
      .notNull()
      .references(() => parentProfiles.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('student_parents_student_parent_uq').on(t.studentId, t.parentId), index('student_parents_parent_id_idx').on(t.parentId)],
);

export const studentTeachers = sqliteTable(
  'student_teachers',
  {
    id: id(),
    studentId: text()
      .notNull()
      .references(() => studentProfiles.id, { onDelete: 'cascade' }),
    teacherId: text()
      .notNull()
      .references(() => teacherProfiles.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('student_teachers_student_teacher_uq').on(t.studentId, t.teacherId), index('student_teachers_teacher_id_idx').on(t.teacherId)],
);

/* --------------------------------------------------------------- curriculum */

export const subjects = sqliteTable('subjects', {
  id: id(),
  slug: text().notNull().unique(),
  nameHi: text().notNull(),
  nameEn: text().notNull(),
  classLevel: integer().notNull(),
  board: text().notNull(),
  sourceNote: text(),
});

export const chapters = sqliteTable(
  'chapters',
  {
    id: id(),
    subjectId: text()
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
    slug: text().notNull().unique(),
    number: integer().notNull(),
    nameHi: text().notNull(),
    nameEn: text().notNull(),
    summaryHi: text().notNull(),
    summaryEn: text().notNull(),
    source: text({ enum: CONTENT_SOURCES }).notNull().default('ORIGINAL_SAMPLE'),
  },
  (t) => [uniqueIndex('chapters_subject_number_uq').on(t.subjectId, t.number)],
);

export const topics = sqliteTable(
  'topics',
  {
    id: id(),
    chapterId: text()
      .notNull()
      .references(() => chapters.id, { onDelete: 'cascade' }),
    slug: text().notNull().unique(),
    order: integer().notNull(),
    titleHi: text().notNull(),
    titleEn: text().notNull(),
    summaryHi: text().notNull(),
    summaryEn: text().notNull(),
  },
  (t) => [index('topics_chapter_order_idx').on(t.chapterId, t.order)],
);

export const lessons = sqliteTable(
  'lessons',
  {
    id: id(),
    topicId: text()
      .notNull()
      .references(() => topics.id, { onDelete: 'cascade' }),
    slug: text().notNull().unique(),
    titleHi: text().notNull(),
    titleEn: text().notNull(),
    content: text({ mode: 'json' }).$type<LessonBlock[]>().notNull(),
    estMinutes: integer().notNull().default(8),
    source: text({ enum: CONTENT_SOURCES }).notNull().default('ORIGINAL_SAMPLE'),
    isPublished: integer({ mode: 'boolean' }).notNull().default(true),
    version: integer().notNull().default(1),
    updatedAt: updatedAt(),
  },
  (t) => [index('lessons_topic_id_idx').on(t.topicId)],
);

export const questions = sqliteTable(
  'questions',
  {
    id: id(),
    topicId: text()
      .notNull()
      .references(() => topics.id, { onDelete: 'cascade' }),
    slug: text().notNull().unique(),
    type: text({ enum: QUESTION_TYPES }).notNull(),
    difficulty: integer().notNull().default(1),
    promptHi: text().notNull(),
    promptEn: text().notNull(),
    options: text({ mode: 'json' }).$type<QuestionOption[] | null>(),
    correctAnswer: text().notNull(),
    hintHi: text().notNull(),
    hintEn: text().notNull(),
    explanationHi: text().notNull(),
    explanationEn: text().notNull(),
    source: text({ enum: CONTENT_SOURCES }).notNull().default('ORIGINAL_SAMPLE'),
  },
  (t) => [index('questions_topic_difficulty_idx').on(t.topicId, t.difficulty)],
);

export const assessments = sqliteTable(
  'assessments',
  {
    id: id(),
    chapterId: text()
      .notNull()
      .references(() => chapters.id, { onDelete: 'cascade' }),
    slug: text().notNull().unique(),
    titleHi: text().notNull(),
    titleEn: text().notNull(),
    durationMinutes: integer().notNull().default(15),
  },
  (t) => [index('assessments_chapter_id_idx').on(t.chapterId)],
);

export const assessmentQuestions = sqliteTable(
  'assessment_questions',
  {
    assessmentId: text()
      .notNull()
      .references(() => assessments.id, { onDelete: 'cascade' }),
    questionId: text()
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    order: integer().notNull(),
  },
  (t) => [primaryKey({ columns: [t.assessmentId, t.questionId] })],
);

/* ----------------------------------------------------------------- learning */

export const learningSessions = sqliteTable(
  'learning_sessions',
  {
    id: id(),
    studentId: text()
      .notNull()
      .references(() => studentProfiles.id, { onDelete: 'cascade' }),
    type: text({ enum: SESSION_TYPES }).notNull(),
    chapterId: text().references(() => chapters.id, { onDelete: 'set null' }),
    topicId: text().references(() => topics.id, { onDelete: 'set null' }),
    assessmentId: text().references(() => assessments.id, { onDelete: 'set null' }),
    score: integer(),
    total: integer(),
    startedAt: createdAt(),
    endedAt: integer({ mode: 'timestamp_ms' }),
  },
  (t) => [index('learning_sessions_student_started_idx').on(t.studentId, t.startedAt)],
);

export const studentAnswers = sqliteTable(
  'student_answers',
  {
    id: id(),
    studentId: text()
      .notNull()
      .references(() => studentProfiles.id, { onDelete: 'cascade' }),
    questionId: text()
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    sessionId: text().references(() => learningSessions.id, { onDelete: 'set null' }),
    answer: text().notNull(),
    isCorrect: integer({ mode: 'boolean' }).notNull(),
    difficulty: integer().notNull(),
    timeTakenSec: integer(),
    origin: text({ enum: ANSWER_ORIGINS }).notNull().default('ONLINE'),
    answeredAt: createdAt(),
  },
  (t) => [index('student_answers_student_answered_idx').on(t.studentId, t.answeredAt), index('student_answers_question_id_idx').on(t.questionId)],
);

export const learningProgress = sqliteTable(
  'learning_progress',
  {
    id: id(),
    studentId: text()
      .notNull()
      .references(() => studentProfiles.id, { onDelete: 'cascade' }),
    topicId: text()
      .notNull()
      .references(() => topics.id, { onDelete: 'cascade' }),
    attempts: integer().notNull().default(0),
    correct: integer().notNull().default(0),
    mastery: real().notNull().default(0),
    currentDifficulty: integer().notNull().default(1),
    streak: integer().notNull().default(0),
    lessonCompletedAt: integer({ mode: 'timestamp_ms' }),
    lastActivityAt: createdAt(),
  },
  (t) => [uniqueIndex('learning_progress_student_topic_uq').on(t.studentId, t.topicId), index('learning_progress_student_mastery_idx').on(t.studentId, t.mastery)],
);

export const adaptiveRecommendations = sqliteTable(
  'adaptive_recommendations',
  {
    id: id(),
    studentId: text()
      .notNull()
      .references(() => studentProfiles.id, { onDelete: 'cascade' }),
    topicId: text()
      .notNull()
      .references(() => topics.id, { onDelete: 'cascade' }),
    kind: text({ enum: RECOMMENDATION_KINDS }).notNull(),
    reasonHi: text().notNull(),
    reasonEn: text().notNull(),
    priority: integer().notNull().default(0),
    status: text({ enum: RECOMMENDATION_STATUSES }).notNull().default('ACTIVE'),
    createdAt: createdAt(),
  },
  (t) => [index('adaptive_recommendations_student_status_idx').on(t.studentId, t.status)],
);

/* -------------------------------------------------------------------- tutor */

export const tutorConversations = sqliteTable(
  'tutor_conversations',
  {
    id: id(),
    studentId: text()
      .notNull()
      .references(() => studentProfiles.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    mode: text({ enum: CONVERSATION_MODES }).notNull().default('TEXT'),
    topicId: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('tutor_conversations_student_updated_idx').on(t.studentId, t.updatedAt)],
);

export const tutorMessages = sqliteTable(
  'tutor_messages',
  {
    id: id(),
    conversationId: text()
      .notNull()
      .references(() => tutorConversations.id, { onDelete: 'cascade' }),
    role: text({ enum: MESSAGE_ROLES }).notNull(),
    content: text().notNull(),
    structured: text({ mode: 'json' }).$type<unknown>(),
    provider: text(),
    model: text(),
    verification: text(),
    createdAt: createdAt(),
  },
  (t) => [index('tutor_messages_conversation_created_idx').on(t.conversationId, t.createdAt)],
);

/* --------------------------------------------------------------------- sync */

export const syncRecords = sqliteTable(
  'sync_records',
  {
    id: id(),
    studentId: text()
      .notNull()
      .references(() => studentProfiles.id, { onDelete: 'cascade' }),
    clientId: text().notNull(),
    kind: text().notNull(),
    payload: text({ mode: 'json' }).$type<unknown>().notNull(),
    status: text({ enum: SYNC_STATUSES }).notNull(),
    error: text(),
    clientCreatedAt: integer({ mode: 'timestamp_ms' }).notNull(),
    processedAt: createdAt(),
  },
  (t) => [uniqueIndex('sync_records_student_client_uq').on(t.studentId, t.clientId)],
);

/** Anonymous, consent-based page-view counts. No user id, IP or device fingerprint is stored. */
export const analyticsEvents = sqliteTable(
  'analytics_events',
  {
    id: id(),
    path: text().notNull(),
    lang: text(),
    createdAt: createdAt(),
  },
  (t) => [index('analytics_events_created_at_idx').on(t.createdAt)],
);

/* ---------------------------------------------------------------- relations */

export const usersRelations = relations(users, ({ one, many }) => ({
  student: one(studentProfiles),
  parent: one(parentProfiles),
  teacher: one(teacherProfiles),
  refreshTokens: many(refreshTokens),
}));
export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({ user: one(users, { fields: [refreshTokens.userId], references: [users.id] }) }));

export const studentProfilesRelations = relations(studentProfiles, ({ one, many }) => ({
  user: one(users, { fields: [studentProfiles.userId], references: [users.id] }),
  parents: many(studentParents),
  teachers: many(studentTeachers),
  answers: many(studentAnswers),
  progress: many(learningProgress),
  sessions: many(learningSessions),
  recommendations: many(adaptiveRecommendations),
  conversations: many(tutorConversations),
  syncRecords: many(syncRecords),
}));
export const parentProfilesRelations = relations(parentProfiles, ({ one, many }) => ({
  user: one(users, { fields: [parentProfiles.userId], references: [users.id] }),
  students: many(studentParents),
}));
export const teacherProfilesRelations = relations(teacherProfiles, ({ one, many }) => ({
  user: one(users, { fields: [teacherProfiles.userId], references: [users.id] }),
  students: many(studentTeachers),
}));
export const studentParentsRelations = relations(studentParents, ({ one }) => ({
  student: one(studentProfiles, { fields: [studentParents.studentId], references: [studentProfiles.id] }),
  parent: one(parentProfiles, { fields: [studentParents.parentId], references: [parentProfiles.id] }),
}));
export const studentTeachersRelations = relations(studentTeachers, ({ one }) => ({
  student: one(studentProfiles, { fields: [studentTeachers.studentId], references: [studentProfiles.id] }),
  teacher: one(teacherProfiles, { fields: [studentTeachers.teacherId], references: [teacherProfiles.id] }),
}));

export const subjectsRelations = relations(subjects, ({ many }) => ({ chapters: many(chapters) }));
export const chaptersRelations = relations(chapters, ({ one, many }) => ({
  subject: one(subjects, { fields: [chapters.subjectId], references: [subjects.id] }),
  topics: many(topics),
  assessments: many(assessments),
  sessions: many(learningSessions),
}));
export const topicsRelations = relations(topics, ({ one, many }) => ({
  chapter: one(chapters, { fields: [topics.chapterId], references: [chapters.id] }),
  lessons: many(lessons),
  questions: many(questions),
  progress: many(learningProgress),
  recommendations: many(adaptiveRecommendations),
  sessions: many(learningSessions),
}));
export const lessonsRelations = relations(lessons, ({ one }) => ({ topic: one(topics, { fields: [lessons.topicId], references: [topics.id] }) }));
export const questionsRelations = relations(questions, ({ one, many }) => ({
  topic: one(topics, { fields: [questions.topicId], references: [topics.id] }),
  answers: many(studentAnswers),
  assessments: many(assessmentQuestions),
}));
export const assessmentsRelations = relations(assessments, ({ one, many }) => ({
  chapter: one(chapters, { fields: [assessments.chapterId], references: [chapters.id] }),
  questions: many(assessmentQuestions),
  sessions: many(learningSessions),
}));
export const assessmentQuestionsRelations = relations(assessmentQuestions, ({ one }) => ({
  assessment: one(assessments, { fields: [assessmentQuestions.assessmentId], references: [assessments.id] }),
  question: one(questions, { fields: [assessmentQuestions.questionId], references: [questions.id] }),
}));

export const learningSessionsRelations = relations(learningSessions, ({ one, many }) => ({
  student: one(studentProfiles, { fields: [learningSessions.studentId], references: [studentProfiles.id] }),
  chapter: one(chapters, { fields: [learningSessions.chapterId], references: [chapters.id] }),
  topic: one(topics, { fields: [learningSessions.topicId], references: [topics.id] }),
  assessment: one(assessments, { fields: [learningSessions.assessmentId], references: [assessments.id] }),
  answers: many(studentAnswers),
}));
export const studentAnswersRelations = relations(studentAnswers, ({ one }) => ({
  student: one(studentProfiles, { fields: [studentAnswers.studentId], references: [studentProfiles.id] }),
  question: one(questions, { fields: [studentAnswers.questionId], references: [questions.id] }),
  session: one(learningSessions, { fields: [studentAnswers.sessionId], references: [learningSessions.id] }),
}));
export const learningProgressRelations = relations(learningProgress, ({ one }) => ({
  student: one(studentProfiles, { fields: [learningProgress.studentId], references: [studentProfiles.id] }),
  topic: one(topics, { fields: [learningProgress.topicId], references: [topics.id] }),
}));
export const adaptiveRecommendationsRelations = relations(adaptiveRecommendations, ({ one }) => ({
  student: one(studentProfiles, { fields: [adaptiveRecommendations.studentId], references: [studentProfiles.id] }),
  topic: one(topics, { fields: [adaptiveRecommendations.topicId], references: [topics.id] }),
}));
export const tutorConversationsRelations = relations(tutorConversations, ({ one, many }) => ({
  student: one(studentProfiles, { fields: [tutorConversations.studentId], references: [studentProfiles.id] }),
  messages: many(tutorMessages),
}));
export const tutorMessagesRelations = relations(tutorMessages, ({ one }) => ({
  conversation: one(tutorConversations, { fields: [tutorMessages.conversationId], references: [tutorConversations.id] }),
}));
export const syncRecordsRelations = relations(syncRecords, ({ one }) => ({
  student: one(studentProfiles, { fields: [syncRecords.studentId], references: [studentProfiles.id] }),
}));

/* -------------------------------------------------------------------- types */

export type Role = (typeof ROLES)[number];
export type Language = (typeof LANGUAGES)[number];
export type TeachingLevel = (typeof TEACHING_LEVELS)[number];
export type QuestionType = (typeof QUESTION_TYPES)[number];
export type SessionType = (typeof SESSION_TYPES)[number];
export type AnswerOrigin = (typeof ANSWER_ORIGINS)[number];
export type RecommendationKind = (typeof RECOMMENDATION_KINDS)[number];
export type ConversationMode = (typeof CONVERSATION_MODES)[number];
export type MessageRole = (typeof MESSAGE_ROLES)[number];
export type User = typeof users.$inferSelect;
export type StudentProfile = typeof studentProfiles.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
