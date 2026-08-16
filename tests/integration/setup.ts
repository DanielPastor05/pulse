import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

/**
 * These tests write real rows, so they refuse to run anywhere that looks like
 * the deployed database. A guard rather than a convention: the cost of being
 * wrong is somebody's conversations, and `DATABASE_URL` is one stray shell
 * export away from pointing at production.
 */
const url = process.env.DATABASE_URL ?? '';
if (/supabase\.(co|com)/.test(url)) {
  throw new Error(
    'DATABASE_URL apunta a Supabase. Estas pruebas escriben datos: usa un Postgres desechable.',
  );
}

export const prisma = new PrismaClient();

/** Everything created by a run, torn down in reverse order of dependency. */
const created = { users: [] as string[], conversations: [] as string[] };

export async function makeUser(tag: string) {
  const id = randomUUID();
  const user = await prisma.user.create({
    data: {
      id,
      email: `${tag}-${id.slice(0, 8)}@integration.test`,
      username: `${tag}_${id.slice(0, 8)}`,
      displayName: `${tag} de prueba`,
      onboardedAt: new Date(),
    },
  });
  created.users.push(user.id);
  return user;
}

export async function makeConversation(
  ownerId: string,
  options: { type?: 'DIRECT' | 'GROUP'; name?: string; members?: string[] } = {},
) {
  const conversation = await prisma.conversation.create({
    data: {
      type: options.type ?? 'GROUP',
      name: options.name ?? 'Sala de integración',
      ownerId,
      members: {
        create: [
          { userId: ownerId, role: 'OWNER' },
          ...(options.members ?? []).map((userId) => ({ userId, role: 'MEMBER' as const })),
        ],
      },
    },
  });
  created.conversations.push(conversation.id);
  return conversation;
}

/**
 * Writes messages one at a time rather than with `createMany`.
 *
 * `createdAt` defaults to the insert moment, and a batch insert lands them all
 * inside the same millisecond — which is exactly the collision the cursor test
 * needs to be able to produce on purpose.
 */
export async function sendMessages(
  conversationId: string,
  authorId: string,
  contents: string[],
) {
  const messages = [];
  for (const content of contents) {
    messages.push(
      await prisma.message.create({ data: { conversationId, authorId, content } }),
    );
  }
  return messages;
}

export async function teardown() {
  await prisma.conversation.deleteMany({ where: { id: { in: created.conversations } } });
  await prisma.user.deleteMany({ where: { id: { in: created.users } } });
  created.conversations.length = 0;
  created.users.length = 0;
  await prisma.$disconnect();
}
