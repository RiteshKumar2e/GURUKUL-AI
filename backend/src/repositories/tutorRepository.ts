import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client';
import { tutorConversations, tutorMessages, type ConversationMode, type MessageRole } from '../db/schema';

export const tutorRepository = {
  /** Newest 50 conversations, with a message count (same `_count.messages` shape the app already uses). */
  async list(studentId: string) {
    const rows = await db
      .select({
        id: tutorConversations.id,
        title: tutorConversations.title,
        mode: tutorConversations.mode,
        topicId: tutorConversations.topicId,
        createdAt: tutorConversations.createdAt,
        updatedAt: tutorConversations.updatedAt,
      })
      .from(tutorConversations)
      .where(eq(tutorConversations.studentId, studentId))
      .orderBy(desc(tutorConversations.updatedAt))
      .limit(50);
    if (!rows.length) return [];
    const counts = await db
      .select({ conversationId: tutorMessages.conversationId, n: count() })
      .from(tutorMessages)
      .where(
        inArray(
          tutorMessages.conversationId,
          rows.map((r) => r.id),
        ),
      )
      .groupBy(tutorMessages.conversationId);
    const byId = new Map(counts.map((c) => [c.conversationId, c.n]));
    return rows.map((r) => ({ ...r, _count: { messages: byId.get(r.id) ?? 0 } }));
  },

  create: async (studentId: string, data: { title: string; mode: ConversationMode; topicId?: string | null; subjectId?: string | null }) =>
    (await db.insert(tutorConversations).values({ studentId, ...data }).returning())[0],

  findOwned: async (studentId: string, id: string) =>
    (await db.query.tutorConversations.findFirst({
      where: and(eq(tutorConversations.id, id), eq(tutorConversations.studentId, studentId)),
      with: { messages: { orderBy: (m, { asc }) => [asc(m.createdAt)] } },
    })) ?? null,

  /** Adds a message and bumps the conversation's updatedAt in one transaction. */
  addMessage: (data: {
    conversationId: string;
    role: MessageRole;
    content: string;
    structured?: unknown;
    provider?: string;
    model?: string | null;
    verification?: string | null;
  }) =>
    db.transaction(async (tx) => {
      const [msg] = await tx.insert(tutorMessages).values(data).returning();
      await tx.update(tutorConversations).set({ updatedAt: new Date() }).where(eq(tutorConversations.id, data.conversationId));
      return msg;
    }),

  setTitle: (id: string, title: string) => db.update(tutorConversations).set({ title }).where(eq(tutorConversations.id, id)),
  deleteMessage: (id: string) => db.delete(tutorMessages).where(eq(tutorMessages.id, id)),

  /** Deletes an owned conversation and its messages. Returns { count } like before. */
  remove: (studentId: string, id: string) =>
    db.transaction(async (tx) => {
      const owned = await tx
        .select({ id: tutorConversations.id })
        .from(tutorConversations)
        .where(and(eq(tutorConversations.id, id), eq(tutorConversations.studentId, studentId)));
      if (!owned.length) return { count: 0 };
      await tx.delete(tutorMessages).where(eq(tutorMessages.conversationId, id));
      await tx.delete(tutorConversations).where(eq(tutorConversations.id, id));
      return { count: 1 };
    }),

  countForStudent: async (studentId: string) =>
    (await db.select({ n: count() }).from(tutorConversations).where(eq(tutorConversations.studentId, studentId)))[0]?.n ?? 0,
};
