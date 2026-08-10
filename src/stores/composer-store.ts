import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { MessageDTO } from '@/types/dto';

export type ReplyTarget = {
  id: string;
  content: string;
  authorName: string;
  hasAttachments: boolean;
};

type ComposerState = {
  /** conversationId → draft text. Persisted so a reload never loses typing. */
  drafts: Record<string, string>;
  replyTo: Record<string, ReplyTarget | undefined>;
  editing: Record<string, { id: string; content: string } | undefined>;

  setDraft: (conversationId: string, value: string) => void;
  clearDraft: (conversationId: string) => void;
  setReplyTo: (conversationId: string, message: MessageDTO | null) => void;
  setEditing: (conversationId: string, message: MessageDTO | null) => void;
  setEditingContent: (conversationId: string, content: string) => void;
};

export const useComposerStore = create<ComposerState>()(
  persist(
    (set) => ({
      drafts: {},
      replyTo: {},
      editing: {},

      setDraft: (conversationId, value) =>
        set((state) => ({ drafts: { ...state.drafts, [conversationId]: value } })),

      clearDraft: (conversationId) =>
        set((state) => {
          const drafts = { ...state.drafts };
          delete drafts[conversationId];
          return { drafts };
        }),

      setReplyTo: (conversationId, message) =>
        set((state) => ({
          replyTo: {
            ...state.replyTo,
            [conversationId]: message
              ? {
                  id: message.id,
                  content: message.content,
                  authorName: message.author?.displayName ?? 'Unknown',
                  hasAttachments: message.attachments.length > 0,
                }
              : undefined,
          },
        })),

      setEditing: (conversationId, message) =>
        set((state) => ({
          editing: {
            ...state.editing,
            [conversationId]: message ? { id: message.id, content: message.content } : undefined,
          },
        })),

      setEditingContent: (conversationId, content) =>
        set((state) => {
          const current = state.editing[conversationId];
          if (!current) return state;
          return { editing: { ...state.editing, [conversationId]: { ...current, content } } };
        }),
    }),
    {
      name: 'pulse.composer',
      // Reply/edit targets are transient; only drafts are worth persisting.
      partialize: (state) => ({ drafts: state.drafts, replyTo: {}, editing: {} }),
    },
  ),
);
