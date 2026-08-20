import { createInviteSchema } from '@/features/conversations/validators';
import { requireUser } from '@/server/auth';
import { json, parseBody, route } from '@/server/http';
import { rateLimit, rateLimits } from '@/server/rate-limit';
import type { RouteContext } from '@/server/route-context';
import { createInvite } from '@/server/services/access.service';

export const dynamic = 'force-dynamic';

export const POST = route<RouteContext<{ id: string }>>(async (request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  await rateLimit(`invite:${user.id}`, rateLimits.mutate);

  const input = await parseBody(request, createInviteSchema);
  const invite = await createInvite(id, user, input);

  // Built from the origin the caller actually reached us on, not from config.
  // A hardcoded value has to be kept in sync with every domain the app is
  // served from, and when it drifts the link still looks fine and 404s on
  // click. Deriving it means a custom domain works the day it is added.
  const origin = new URL(request.url).origin;

  return json(
    {
      code: invite.code,
      url: `${origin}/invite/${invite.code}`,
      expiresAt: invite.expiresAt?.toISOString() ?? null,
      maxUses: invite.maxUses,
    },
    { status: 201 },
  );
});
