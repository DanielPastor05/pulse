import { z } from 'zod';

import { requireUser } from '@/server/auth';
import { json, parseBody, route } from '@/server/http';
import { touchPresence } from '@/server/services/user.service';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ presence: z.enum(['ONLINE', 'IDLE', 'DND', 'OFFLINE']) });

/** Heartbeat from the client so `lastSeenAt` survives a hard tab close. */
export const POST = route(async (request) => {
  const user = await requireUser();
  const { presence } = await parseBody(request, bodySchema);
  await touchPresence(user.id, presence);
  return json({ ok: true });
});
