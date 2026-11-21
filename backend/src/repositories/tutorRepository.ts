import type { ConversationMode, MessageRole, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

export const tutorRepository = {
  list: (studentId: string) =>
    prisma.tutorConversation.findMany({
      where: { studentId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: { id: true, title: true, mode: true, topicId: true, createdAt: true, updatedAt: true, _count: { select: { messages: true } } },
    }),

  create: (studentId: string, data: { title: string; mode: ConversationMode; topicId?: string | null }) =>
    prisma.tutorConversation.create({ data: { studentId, ...data } }),

  findOwned: (studentId: string, id: string) =>
    prisma.tutorConversation.findFirst({ where: { id, studentId }, include: { messages: { orderBy: { createdAt: 'asc' } } } }),

  addMessage: (data: {
    conversationId: string;
    role: MessageRole;
    content: string;
    structured?: Prisma.InputJsonValue;
    provider?: string;
    model?: string | null;
    verification?: string | null;
  }) =>
    prisma.$transaction(async (tx) => {
      const msg = await tx.tutorMessage.create({ data });
      await tx.tutorConversation.update({ where: { id: data.conversationId }, data: { updatedAt: new Date() } });
      return msg;
    }),

  remove: (studentId: string, id: string) => prisma.tutorConversation.deleteMany({ where: { id, studentId } }),
};
