import { prisma } from '@/lib/prisma';
import { onboardingSchema } from '@/features/profile/validators';
import { getAuthUser } from '@/server/auth';
import { errors } from '@/server/errors';
import { json, parseBody, route } from '@/server/http';
import { rateLimit, rateLimits } from '@/server/rate-limit';
import { toCurrentUser } from '@/server/services/user.service';

export const dynamic = 'force-dynamic';

/**
 * Creates (or completes) the profile row for a freshly authenticated account.
 * Runs once, right after sign-up or the first OAuth sign-in.
 */
export const POST = route(async (request) => {
  const authUser = await getAuthUser();
  if (!authUser?.email) throw errors.unauthorized();

  await rateLimit(`onboarding:${authUser.id}`, rateLimits.auth);
  const input = await parseBody(request, onboardingSchema);

  const taken = await prisma.user.findFirst({
    where: { username: input.username, NOT: { id: authUser.id } },
    select: { id: true },
  });
  if (taken) throw errors.conflict('That username is taken.');

  const user = await prisma.user.upsert({
    where: { id: authUser.id },
    create: {
      id: authUser.id,
      email: authUser.email,
      username: input.username,
      displayName: input.displayName,
      bio: input.bio || null,
      avatarUrl: input.avatarUrl ?? (authUser.user_metadata?.avatar_url as string | undefined) ?? null,
      accent: input.accent,
      bannerColor: input.accent,
      presence: 'ONLINE',
      onboardedAt: new Date(),
    },
    update: {
      username: input.username,
      displayName: input.displayName,
      bio: input.bio || null,
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      accent: input.accent,
      bannerColor: input.accent,
      onboardedAt: new Date(),
    },
  });

  return json(toCurrentUser(user));
});
