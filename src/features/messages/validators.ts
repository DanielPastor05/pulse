import { z } from 'zod';

import { MAX_ATTACHMENTS_PER_MESSAGE, MAX_MESSAGE_LENGTH } from '@/lib/constants';
import { httpUrl } from '@/lib/zod';

export const attachmentInputSchema = z.object({
  kind: z.enum(['IMAGE', 'VIDEO', 'AUDIO', 'VOICE', 'DOCUMENT']),
  url: httpUrl,
  path: z.string().min(1).max(512),
  name: z.string().min(1).max(255),
  size: z.number().int().nonnegative(),
  mimeType: z.string().min(1).max(160),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  duration: z.number().int().nonnegative().nullable().optional(),
  waveform: z.array(z.number()).max(128).optional(),
});

export const sendMessageSchema = z
  .object({
    content: z.string().max(MAX_MESSAGE_LENGTH, 'That message is too long.').default(''),
    replyToId: z.string().uuid().nullable().optional(),
    forwardedFromId: z.string().uuid().nullable().optional(),
    attachments: z.array(attachmentInputSchema).max(MAX_ATTACHMENTS_PER_MESSAGE).default([]),
    clientId: z.string().min(1).max(64).optional(),
  })
  .refine((value) => value.content.trim().length > 0 || value.attachments.length > 0, {
    message: 'Write something or attach a file.',
    path: ['content'],
  });

export const editMessageSchema = z.object({
  content: z.string().trim().min(1, 'Message cannot be empty.').max(MAX_MESSAGE_LENGTH),
});

export const reactionSchema = z.object({
  emoji: z.string().min(1).max(16),
});

export const forwardMessageSchema = z.object({
  conversationIds: z.array(z.string().uuid()).min(1).max(10),
});

export const messagesQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type EditMessageInput = z.infer<typeof editMessageSchema>;
export type AttachmentInput = z.infer<typeof attachmentInputSchema>;
