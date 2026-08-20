import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth';
import { errors } from '@/server/errors';
import { json, route } from '@/server/http';
import { rateLimit, rateLimits } from '@/server/rate-limit';
import type { RouteContext } from '@/server/route-context';
import { redeemInvite } from '@/server/services/access.service';

export const dynamic = 'force-dynamic';

type Context = RouteContext<{ code: string }>;

export const GET = route<Context>(async (_request, context) => {
  await requireUser();
  const { code } = await context.params;

  const invite = await prisma.invite.findUnique({
    where: { code },
    include: {
      conversation: {
        select: {
          id: true,
          name: true,
          description: true,
          avatarUrl: true,
          accent: true,
          _count: { select: { members: true } },
        },
      },
      createdBy: { select: { displayName: true } },
    },
  });
  if (!invite) throw errors.notFound('That invite link is not valid.');

  const expired =
    (invite.expiresAt !== null && invite.expiresAt < new Date()) ||
    (invite.maxUses !== null && invite.uses >= invite.maxUses);

  return json({
    code: invite.code,
    expired,
    invitedBy: invite.createdBy.displayName,
    conversation: {
      id: invite.conversation.id,
      name: invite.conversation.name ?? 'Group',
      description: invite.conversation.description,
      avatarUrl: invite.conversation.avatarUrl,
      accent: invite.conversation.accent,
      memberCount: invite.conversation._count.members,
    },
  });
});

export const POST = route<Context>(async (_request, context) => {
  const user = await requireUser();
  const { code } = await context.params;
  await rateLimit(`redeem:${user.id}`, rateLimits.mutate);

  const conversationId = await redeemInvite(code, user);
  return json({ conversationId });
});
