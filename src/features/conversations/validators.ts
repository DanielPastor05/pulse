import { z } from 'zod';

import { FONDOS } from '@/lib/constants';
import { httpUrl } from '@/lib/zod';

export const slugSchema = z
  .string()
  .min(3)
  .max(32)
  .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers and dashes only.');

export const createGroupSchema = z.object({
  name: z.string().trim().min(2, 'At least 2 characters.').max(50, 'At most 50 characters.'),
  description: z.string().max(300).optional().or(z.literal('')),
  isPublic: z.boolean().default(false),
  requiresApproval: z.boolean().default(false),
  slug: slugSchema.optional(),
  avatarUrl: httpUrl.nullable().optional(),
  accent: z.string().min(1).max(24).default('violet'),
  memberIds: z.array(z.string().uuid()).max(50).default([]),
});

export const updateConversationSchema = z.object({
  name: z.string().trim().min(2).max(50).optional(),
  description: z.string().max(300).nullable().optional(),
  avatarUrl: httpUrl.nullable().optional(),
  accent: z.string().min(1).max(24).optional(),
  isPublic: z.boolean().optional(),
  requiresApproval: z.boolean().optional(),
  slug: slugSchema.nullable().optional(),
});

export const memberPreferencesSchema = z.object({
  favorite: z.boolean().optional(),
  archived: z.boolean().optional(),
  muted: z.boolean().optional(),
  draft: z.string().max(4000).nullable().optional(),
  // Lista cerrada: el fondo es el identificador de un dibujo que ya existe en
  // el CSS, no algo que el cliente pueda inventarse.
  background: z.enum(FONDOS).nullable().optional(),
});

export const updateMemberSchema = z.object({
  role: z.enum(['ADMIN', 'MODERATOR', 'MEMBER']).optional(),
  nickname: z.string().max(40).nullable().optional(),
});

export const addMembersSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(50),
});

export const transferOwnershipSchema = z.object({
  userId: z.string().uuid(),
});

export const createDirectSchema = z.object({
  userId: z.string().uuid(),
});

export const markReadSchema = z.object({
  messageId: z.string().uuid(),
});

export const createInviteSchema = z.object({
  maxUses: z.number().int().min(1).max(1000).nullable().optional(),
  expiresInHours: z.number().int().min(1).max(24 * 30).nullable().optional(),
});

export const joinRequestSchema = z.object({
  message: z.string().max(300).optional().or(z.literal('')),
});

export const reviewJoinRequestSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;
