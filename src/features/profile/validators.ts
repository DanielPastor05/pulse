import { z } from 'zod';

import { httpUrl } from '@/lib/zod';

const RESERVED_USERNAMES = new Set([
  'admin',
  'api',
  'app',
  'auth',
  'chat',
  'settings',
  'discover',
  'invite',
  'login',
  'register',
  'me',
  'pulse',
  'support',
  'system',
]);

export const usernameSchema = z
  .string()
  .min(3, 'At least 3 characters.')
  .max(24, 'At most 24 characters.')
  .regex(/^[a-z0-9_]+$/, 'Lowercase letters, numbers and underscores only.')
  .refine((value) => !RESERVED_USERNAMES.has(value), 'That username is reserved.');

export const onboardingSchema = z.object({
  username: usernameSchema,
  displayName: z.string().min(2, 'At least 2 characters.').max(40, 'At most 40 characters.'),
  bio: z.string().max(280, 'Keep it under 280 characters.').optional().or(z.literal('')),
  avatarUrl: httpUrl.nullable().optional(),
  accent: z.string().min(1).max(24).default('violet'),
});

export const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(40).optional(),
  username: usernameSchema.optional(),
  bio: z.string().max(280).nullable().optional(),
  statusText: z.string().max(80).nullable().optional(),
  avatarUrl: httpUrl.nullable().optional(),
  accent: z.string().min(1).max(24).optional(),
  locale: z.enum(['EN', 'ES']).optional(),
  theme: z.enum(['LIGHT', 'DARK', 'SYSTEM']).optional(),
  reducedMotion: z.boolean().optional(),
  presence: z.enum(['ONLINE', 'IDLE', 'DND', 'OFFLINE']).optional(),
  notifyOnMessage: z.boolean().optional(),
  notifyOnMention: z.boolean().optional(),
  notifyOnReaction: z.boolean().optional(),
  notifySounds: z.boolean().optional(),
  notifyDesktopPush: z.boolean().optional(),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
