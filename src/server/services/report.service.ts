import type { ReportReason, ReportStatus, User } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { can } from '@/lib/permissions';
import { errors } from '@/server/errors';
import { requireMembership } from '@/server/repositories/conversation.repository';
import { publicUserSelect, toPublicUser } from '@/server/repositories/selectors';
import type { ReportDTO } from '@/types/dto';

const reportInclude = {
  reporter: { select: publicUserSelect },
  reportedUser: { select: publicUserSelect },
  message: { select: { id: true, content: true, deletedAt: true } },
} as const;

function toReport(row: {
  id: string;
  reason: ReportReason;
  note: string | null;
  status: ReportStatus;
  createdAt: Date;
  reviewedAt: Date | null;
  reporter: Parameters<typeof toPublicUser>[0];
  reportedUser: Parameters<typeof toPublicUser>[0] | null;
  message: { id: string; content: string; deletedAt: Date | null } | null;
}): ReportDTO {
  return {
    id: row.id,
    reason: row.reason,
    note: row.note,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reporter: toPublicUser(row.reporter),
    reportedUser: row.reportedUser ? toPublicUser(row.reportedUser) : null,
    message: row.message
      ? {
          id: row.message.id,
          // A moderator needs to see what was reported even after the author
          // deleted it — that is often exactly why it was reported.
          content: row.message.content,
          deleted: Boolean(row.message.deletedAt),
        }
      : null,
  };
}

/**
 * Files a report against a message.
 *
 * Anyone in the conversation can report; the point is to reach a moderator, and
 * gating that behind a role would mean the people most likely to be on the
 * receiving end have no way to speak up.
 */
export async function reportMessage(
  messageId: string,
  reporter: User,
  input: { reason: ReportReason; note?: string | null },
): Promise<void> {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true, conversationId: true, authorId: true },
  });
  if (!message) throw errors.notFound('That message no longer exists.');

  await requireMembership(message.conversationId, reporter.id);
  if (message.authorId === reporter.id) {
    throw errors.badRequest('You cannot report your own message.');
  }

  await prisma.report.upsert({
    where: { messageId_reporterId: { messageId, reporterId: reporter.id } },
    // Reporting twice is a slip, not a stronger signal: the second one updates
    // the reason rather than piling up duplicates for a moderator to wade
    // through.
    update: { reason: input.reason, note: input.note ?? null },
    create: {
      conversationId: message.conversationId,
      messageId,
      reporterId: reporter.id,
      reportedUserId: message.authorId,
      reason: input.reason,
      note: input.note ?? null,
    },
  });
}

/** The moderation queue for one conversation. */
export async function listReports(
  conversationId: string,
  actor: User,
  status: ReportStatus = 'OPEN',
): Promise<ReportDTO[]> {
  const membership = await requireMembership(conversationId, actor.id);
  if (!can.moderateMessages(membership.role)) {
    throw errors.forbidden('Only moderators can see reports.');
  }

  const rows = await prisma.report.findMany({
    where: { conversationId, status },
    include: reportInclude,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return rows.map(toReport);
}

export async function reviewReport(
  reportId: string,
  actor: User,
  status: Exclude<ReportStatus, 'OPEN'>,
): Promise<ReportDTO> {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: { conversationId: true },
  });
  if (!report) throw errors.notFound('That report no longer exists.');

  const membership = await requireMembership(report.conversationId, actor.id);
  if (!can.moderateMessages(membership.role)) {
    throw errors.forbidden('Only moderators can review reports.');
  }

  const updated = await prisma.report.update({
    where: { id: reportId },
    data: { status, reviewedById: actor.id, reviewedAt: new Date() },
    include: reportInclude,
  });

  return toReport(updated);
}

export async function openReportCount(conversationId: string, actor: User): Promise<number> {
  const membership = await requireMembership(conversationId, actor.id);
  if (!can.moderateMessages(membership.role)) return 0;
  return prisma.report.count({ where: { conversationId, status: 'OPEN' } });
}
