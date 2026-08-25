import { prisma } from '@/lib/prisma';
import { memberPreferencesSchema } from '@/features/conversations/validators';
import { requireUser } from '@/server/auth';
import { json, parseBody, route } from '@/server/http';
import { requireMembership } from '@/server/repositories/conversation.repository';
import type { RouteContext } from '@/server/route-context';

export const dynamic = 'force-dynamic';

/** Per-member view state: favourite, archive, mute and the saved draft. */
export const PATCH = route<RouteContext<{ id: string }>>(async (request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  await requireMembership(id, user.id);

  const input = await parseBody(request, memberPreferencesSchema);

  await prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId: id, userId: user.id } },
    data: {
      ...(input.favorite !== undefined ? { favorite: input.favorite } : {}),
      ...(input.archived !== undefined ? { archived: input.archived } : {}),
      ...(input.muted !== undefined ? { muted: input.muted } : {}),
      ...(input.draft !== undefined ? { draft: input.draft } : {}),
      ...(input.background !== undefined ? { background: input.background } : {}),
    },
  });

  return json({ ok: true });
});
