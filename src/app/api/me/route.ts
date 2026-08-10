import { updateProfileSchema } from '@/features/profile/validators';
import { requireUser } from '@/server/auth';
import { json, parseBody, route } from '@/server/http';
import { rateLimit, rateLimits } from '@/server/rate-limit';
import { toCurrentUser, updateProfile } from '@/server/services/user.service';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const user = await requireUser();
  return json(toCurrentUser(user));
});

export const PATCH = route(async (request) => {
  const user = await requireUser();
  await rateLimit(`profile:${user.id}`, rateLimits.mutate);
  const input = await parseBody(request, updateProfileSchema);
  return json(await updateProfile(user, input));
});
