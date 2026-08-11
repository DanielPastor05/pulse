import { reportMessageSchema } from '@/features/moderation/validators';
import { requireUser } from '@/server/auth';
import { json, parseBody, route } from '@/server/http';
import { rateLimit, rateLimits } from '@/server/rate-limit';
import type { RouteContext } from '@/server/route-context';
import { reportMessage } from '@/server/services/report.service';

export const dynamic = 'force-dynamic';

/**
 * Anyone in the conversation may report. Gating this behind a role would leave
 * the people most likely to need it with no way to speak up.
 */
export const POST = route<RouteContext<{ id: string }>>(async (request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  await rateLimit(`report:${user.id}`, rateLimits.mutate);

  const input = await parseBody(request, reportMessageSchema);
  await reportMessage(id, user, input);
  return json({ ok: true }, { status: 201 });
});
