import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth';
import { json, parseQuery, route } from '@/server/http';

export const dynamic = 'force-dynamic';

const querySchema = z.object({ q: z.string().max(80).default('') });

export type DiscoverGroup = {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  avatarUrl: string | null;
  accent: string;
  memberCount: number;
  requiresApproval: boolean;
  isMember: boolean;
  requested: boolean;
};

export const GET = route(async (request) => {
  const user = await requireUser();
  const { q } = parseQuery(request, querySchema);
  const term = q.trim();

  const groups = await prisma.conversation.findMany({
    where: {
      type: 'GROUP',
      isPublic: true,
      ...(term
        ? {
            OR: [
              { name: { contains: term, mode: 'insensitive' } },
              { description: { contains: term, mode: 'insensitive' } },
              { slug: { contains: term, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: {
      _count: { select: { members: true } },
      members: { where: { userId: user.id }, select: { id: true } },
      joinRequests: { where: { userId: user.id, status: 'PENDING' }, select: { id: true } },
    },
    orderBy: [{ lastMessageAt: 'desc' }],
    take: 40,
  });

  const items: DiscoverGroup[] = groups.map((group) => ({
    id: group.id,
    name: group.name ?? 'Untitled group',
    slug: group.slug,
    description: group.description,
    avatarUrl: group.avatarUrl,
    accent: group.accent,
    memberCount: group._count.members,
    requiresApproval: group.requiresApproval,
    isMember: group.members.length > 0,
    requested: group.joinRequests.length > 0,
  }));

  return json({ groups: items });
});
