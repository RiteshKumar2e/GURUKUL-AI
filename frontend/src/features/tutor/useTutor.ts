import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { Conversation, TutorMessage } from '@/types/api';

export type Intent = 'hint' | 'solution' | 'explain' | 'check';

/** Creates a conversation if needed, then asks the tutor. Shared by text, voice and photo pages. */
export function useAskTutor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { conversationId?: string; content: string; intent: Intent; mode?: 'TEXT' | 'VOICE' | 'PHOTO'; topicSlug?: string; subjectSlug?: string; language: 'HI' | 'EN' | 'TE' }) => {
      let id = vars.conversationId;
      if (!id) {
        const conv = await api<Conversation>('/tutor/conversations', { body: { mode: vars.mode ?? 'TEXT', topicSlug: vars.topicSlug, subjectSlug: vars.subjectSlug || undefined, title: vars.content.slice(0, 70) } });
        id = conv.id;
      }
      const res = await api<{ userMessage: TutorMessage; assistantMessage: TutorMessage }>(`/tutor/conversations/${id}/messages`, {
        body: { content: vars.content, intent: vars.intent, language: vars.language },
      });
      return { conversationId: id, ...res };
    },
    onSuccess: (res) => {
      qc.setQueryData<Conversation>(['conversation', res.conversationId], (old) =>
        old ? { ...old, messages: [...(old.messages ?? []), res.userMessage, res.assistantMessage] } : old,
      );
      void qc.invalidateQueries({ queryKey: ['conversations'] });
      void qc.invalidateQueries({ queryKey: ['conversation', res.conversationId] });
    },
  });
}
