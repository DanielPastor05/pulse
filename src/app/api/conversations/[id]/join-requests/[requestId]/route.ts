import { reviewJoinRequestSchema } from '@/features/conversations/validators';
import { requireUser } from '@/server/auth';
import { json, parseBody, route } from '@/server/http';
import type { RouteContext } from '@/server/route-context';
import { reviewJoinRequest } from '@/server/services/conversation.service';

export const dynamic = 'force-dynamic';

export const PATCH = route<RouteContext<{ id: string; requestId: string }>>(
  async (request, context) => {
    const user = await requireUser();
    const { id, requestId } = await context.params;
    const { status } = await parseBody(request, reviewJoinRequestSchema);

    await reviewJoinRequest(id, user, requestId, status);
    return json({ ok: true });
  },
);
