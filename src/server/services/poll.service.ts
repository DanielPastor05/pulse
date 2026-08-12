import type { User } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { realtimeEvents } from '@/lib/realtime';
import { broadcastToConversation } from '@/server/broadcast';
import { errors } from '@/server/errors';
import { requireMembership } from '@/server/repositories/conversation.repository';
import { getMessageOrThrow } from '@/server/repositories/message.repository';
import type { MessageDTO } from '@/types/dto';

/**
 * Creates a poll as a message.
 *
 * The message and the poll go in together: a `POLL` message with no poll
 * attached would render as an empty bubble, and there is no sensible way to
 * recover from it afterwards.
 */
export async function createPoll(
  conversationId: string,
  author: User,
  input: { question: string; options: string[]; multiple: boolean },
): Promise<MessageDTO> {
  await requireMembership(conversationId, author.id);

  const labels = input.options.map((option) => option.trim()).filter(Boolean);
  if (labels.length < 2) throw errors.badRequest('A poll needs at least two options.');
  if (new Set(labels).size !== labels.length) {
    throw errors.badRequest('Two options say the same thing.');
  }

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: {
        conversationId,
        authorId: author.id,
        kind: 'POLL',
        // The question doubles as the message body so search, notification
        // previews and the conversation list all keep working unchanged.
        content: input.question,
      },
      select: { id: true },
    });

    await tx.poll.create({
      data: {
        messageId: created.id,
        question: input.question,
        multiple: input.multiple,
        options: {
          createMany: {
            data: labels.map((label, position) => ({ label, position })),
          },
        },
      },
    });

    await tx.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    return created;
  });

  const dto = await getMessageOrThrow(message.id, author.id);
  await broadcastToConversation(conversationId, realtimeEvents.messageCreated, {
    message: dto,
    clientId: null,
  });

  return dto;
}

/**
 * Casts or withdraws a vote.
 *
 * Single-choice is enforced here rather than by a constraint because the
 * database cannot express "one vote per *poll*" — the votes table only knows
 * about options. Doing it in one transaction is what stops two quick taps
 * leaving somebody with two answers to a single-choice question.
 */
export async function votePoll(
  messageId: string,
  user: User,
  optionId: string,
): Promise<MessageDTO> {
  const poll = await prisma.poll.findUnique({
    where: { messageId },
    select: {
      id: true,
      multiple: true,
      closedAt: true,
      message: { select: { conversationId: true } },
      options: { select: { id: true } },
    },
  });
  if (!poll) throw errors.notFound('That poll no longer exists.');

  await requireMembership(poll.message.conversationId, user.id);
  if (poll.closedAt) throw errors.badRequest('This poll is closed.');
  if (!poll.options.some((option) => option.id === optionId)) {
    throw errors.badRequest('That option is not part of this poll.');
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.pollVote.findUnique({
      where: { optionId_userId: { optionId, userId: user.id } },
      select: { id: true },
    });

    // Tapping your own answer again takes it back, which is what people expect
    // and the only way to undo a vote.
    if (existing) {
      await tx.pollVote.delete({ where: { id: existing.id } });
      return;
    }

    if (!poll.multiple) {
      await tx.pollVote.deleteMany({
        where: { userId: user.id, option: { pollId: poll.id } },
      });
    }

    await tx.pollVote.create({ data: { optionId, userId: user.id } });
  });

  const dto = await getMessageOrThrow(messageId, user.id);
  await broadcastToConversation(poll.message.conversationId, realtimeEvents.messageUpdated, {
    message: dto,
  });
  return dto;
}

/** Closing keeps the results and stops new votes. Author or moderator only. */
export async function closePoll(messageId: string, user: User): Promise<MessageDTO> {
  const poll = await prisma.poll.findUnique({
    where: { messageId },
    select: {
      id: true,
      closedAt: true,
      message: { select: { conversationId: true, authorId: true } },
    },
  });
  if (!poll) throw errors.notFound('That poll no longer exists.');

  const membership = await requireMembership(poll.message.conversationId, user.id);
  const isAuthor = poll.message.authorId === user.id;
  if (!isAuthor && !['OWNER', 'ADMIN', 'MODERATOR'].includes(membership.role)) {
    throw errors.forbidden('Only whoever started the poll can close it.');
  }

  if (!poll.closedAt) {
    await prisma.poll.update({ where: { id: poll.id }, data: { closedAt: new Date() } });
  }

  const dto = await getMessageOrThrow(messageId, user.id);
  await broadcastToConversation(poll.message.conversationId, realtimeEvents.messageUpdated, {
    message: dto,
  });
  return dto;
}
