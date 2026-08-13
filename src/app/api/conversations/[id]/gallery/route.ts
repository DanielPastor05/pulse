import { z } from 'zod';

import { requireUser } from '@/server/auth';
import { json, parseQuery, route } from '@/server/http';
import { rateLimit, rateLimits } from '@/server/rate-limit';
import { requireMembership } from '@/server/repositories/conversation.repository';
import { listGallery } from '@/server/repositories/gallery.repository';
import type { RouteContext } from '@/server/route-context';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  tab: z.enum(['media', 'files']).default('media'),
  cursor: z.string().uuid().optional(),
  /** Smaller pages let a test cross a boundary without uploading 45 images. */
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const GET = route<RouteContext<{ id: string }>>(async (request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  await rateLimit(`gallery:${user.id}`, rateLimits.search);

  // Membership, not just authentication: attachment URLs are public objects in
  // storage, so the list of what exists is the thing worth guarding.
  await requireMembership(id, user.id);

  const { tab, cursor, limit } = parseQuery(request, querySchema);
  return json(await listGallery(id, { tab, cursor, limit }));
});
