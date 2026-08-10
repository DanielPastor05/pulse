import 'server-only';

import { cache } from 'react';
import type { User } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { errors } from '@/server/errors';

export type SessionUser = User;

/**
 * Resolves the Supabase session into our own user row.
 * `cache` dedupes the work across a single request/render pass.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return prisma.user.findUnique({ where: { id: user.id } });
});

/** Same as `getSessionUser` but throws a 401 instead of returning null. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw errors.unauthorized();
  return user;
}

/** The raw Supabase auth user — needed before the profile row exists. */
export async function getAuthUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
