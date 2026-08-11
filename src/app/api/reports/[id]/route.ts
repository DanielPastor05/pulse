import { reviewReportSchema } from '@/features/moderation/validators';
import { requireUser } from '@/server/auth';
import { json, parseBody, route } from '@/server/http';
import { rateLimit, rateLimits } from '@/server/rate-limit';
import type { RouteContext } from '@/server/route-context';
import { reviewReport } from '@/server/services/report.service';

export const dynamic = 'force-dynamic';

export const PATCH = route<RouteContext<{ id: string }>>(async (request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  await rateLimit(`review-report:${user.id}`, rateLimits.mutate);

  const { status } = await parseBody(request, reviewReportSchema);
  return json(await reviewReport(id, user, status));
});
