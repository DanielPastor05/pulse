import { createInviteSchema } from '@/features/conversations/validators';
import { publicEnv } from '@/lib/env';
import { requireUser } from '@/server/auth';
import { json, parseBody, route } from '@/server/http';
import { rateLimit, rateLimits } from '@/server/rate-limit';
import type { RouteContext } from '@/server/route-context';
import { createInvite } from '@/server/services/conversation.service';

export const dynamic = 'force-dynamic';

export const POST = route<RouteContext<{ id: string }>>(async (request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  await rateLimit(`invite:${user.id}`, rateLimits.mutate);

  const input = await parseBody(request, createInviteSchema);
  const invite = await createInvite(id, user, input);

  return json(
    {
      code: invite.code,
      url: `${publicEnv.appUrl}/invite/${invite.code}`,
      expiresAt: invite.expiresAt?.toISOString() ?? null,
      maxUses: invite.maxUses,
    },
    { status: 201 },
  );
});
