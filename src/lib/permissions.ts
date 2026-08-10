import type { MemberRole } from '@prisma/client';

/**
 * Role rules. Isomorphic on purpose: the server enforces them, the client uses
 * the same table to decide which controls to render — one source of truth.
 */
const RANK: Record<MemberRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  MODERATOR: 2,
  MEMBER: 1,
};

export function atLeast(role: MemberRole, minimum: MemberRole): boolean {
  return RANK[role] >= RANK[minimum];
}

export function outranks(actor: MemberRole, target: MemberRole): boolean {
  return RANK[actor] > RANK[target];
}

export const can = {
  editConversation: (role: MemberRole) => atLeast(role, 'ADMIN'),
  deleteConversation: (role: MemberRole) => role === 'OWNER',
  manageMembers: (role: MemberRole) => atLeast(role, 'MODERATOR'),
  assignRoles: (role: MemberRole) => atLeast(role, 'ADMIN'),
  createInvite: (role: MemberRole) => atLeast(role, 'MODERATOR'),
  reviewJoinRequests: (role: MemberRole) => atLeast(role, 'MODERATOR'),
  pinMessages: (role: MemberRole) => atLeast(role, 'MODERATOR'),
  moderateMessages: (role: MemberRole) => atLeast(role, 'MODERATOR'),
} as const;
