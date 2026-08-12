import { requireUser } from '@/server/auth';
import { json, route } from '@/server/http';
import { rateLimit, rateLimits } from '@/server/rate-limit';
import type { RouteContext } from '@/server/route-context';
import { rejectCall } from '@/server/services/call.service';

export const dynamic = 'force-dynamic';

/**
 * Declining goes through the server because the callee never joined the
 * conversation's channel — they were only ever notified on their own.
 */
export const POST = route<RouteContext<{ id: string; callId: string }>>(
  async (_request, context) => {
    const user = await requireUser();
    const { id, callId } = await context.params;
    await rateLimit(`call-reject:${user.id}`, rateLimits.mutate);

    await rejectCall(id, user, callId);
    return json({ ok: true });
  },
);
