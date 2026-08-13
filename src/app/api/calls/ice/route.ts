import { requireUser } from '@/server/auth';
import { json, route } from '@/server/http';
import { rateLimit, rateLimits } from '@/server/rate-limit';
import { issueIceServers } from '@/server/turn';

export const dynamic = 'force-dynamic';

/**
 * Mints relay credentials for one call.
 *
 * Behind auth and rate limited on purpose: every response spends a little of
 * the account's TURN quota, so an open endpoint would be someone else's free
 * relay.
 */
export const GET = route(async () => {
  const user = await requireUser();
  await rateLimit(`ice:${user.id}`, rateLimits.mutate);

  return json(await issueIceServers());
});
