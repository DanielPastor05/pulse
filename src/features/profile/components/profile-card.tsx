'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, MessageSquare, ShieldBan, UserRoundCheck, UserRoundPlus } from 'lucide-react';
import type { RelationshipStatus } from '@prisma/client';

import { useDates } from '@/i18n/dates';
import { usePresenceOf } from '@/stores/presence-store';
import { useOpenDirectConversation } from '@/features/conversations/hooks';
import { useRelationshipActions, useSetBlocked } from '@/features/profile/hooks';
import { AvatarConVisor } from '@/features/profile/components/avatar-viewer';
import { Button } from '@/components/ui/button';
import type { PublicUser } from '@/types/dto';
import { useT } from '@/i18n/provider';

type Props = {
  user: PublicUser;
  isMe: boolean;
  relationship: { id: string; status: RelationshipStatus; direction: 'incoming' | 'outgoing' } | null;
  blockedByMe: boolean;
};

export function ProfileCard({ user, isMe, relationship, blockedByMe }: Props) {
  const t = useT();
  const { formatLastSeen } = useDates();
  const router = useRouter();
  const openDirect = useOpenDirectConversation();
  const { send, respond } = useRelationshipActions();
  const setBlocked = useSetBlocked();

  const presence = usePresenceOf(user.id, user.presence);

  return (
    <div className="panel flex h-full flex-col overflow-hidden rounded-[var(--radius-panel)] shadow-[var(--shadow-raised)]">
      <div className="flex items-center gap-2 border-b border-[var(--hairline)] px-3 py-2.5">
        <Button size="icon-sm" variant="ghost" onClick={() => router.back()} aria-label={t.nav.goBack}>
          <ArrowLeft />
        </Button>
        <h1 className="text-[15px] font-semibold">{t.nav.profile}</h1>
      </div>

      <div className="scroll-area flex-1 overflow-y-auto pb-24 lg:pb-6">
        <div className="mx-auto max-w-lg">
          <div className="px-6 pt-8">
            <AvatarConVisor src={user.avatarUrl} name={user.displayName} size="xl" presence={presence} />

            <div className="mt-4 space-y-1">
              <h2 className="font-[family-name:var(--font-display)] text-[2rem] leading-tight tracking-[-0.01em]">
                {user.displayName}
              </h2>
              <p className="text-[14px] text-[var(--text-2)]">@{user.username}</p>
              <p className="text-[12.5px] text-[var(--text-3)]">
                {presence === 'ONLINE' ? t.common.online : formatLastSeen(user.lastSeenAt)}
              </p>
            </div>

            {user.statusText ? (
              <p className="mt-3 inline-flex rounded-full bg-[var(--surface-sunken)] px-3 py-1 text-[13px]">
                {user.statusText}
              </p>
            ) : null}

            {user.bio ? (
              <p className="mt-4 text-[14px] leading-relaxed text-[var(--text-2)]">{user.bio}</p>
            ) : null}

            {!isMe ? (
              <div className="mt-6 flex flex-wrap gap-2">
                <Button
                  onClick={() => openDirect.mutate(user.id)}
                  loading={openDirect.isPending}
                  disabled={blockedByMe}
                >
                  <MessageSquare />
                  {t.nav.message}
                </Button>

                {relationship?.status === 'ACCEPTED' ? (
                  <Button variant="secondary" disabled>
                    <UserRoundCheck />
                    {t.nav.friends}
                  </Button>
                ) : relationship?.status === 'PENDING' && relationship.direction === 'incoming' ? (
                  <Button
                    variant="secondary"
                    onClick={() => respond.mutate({ id: relationship.id, accept: true })}
                    loading={respond.isPending}
                  >
                    <UserRoundCheck />
                    {t.nav.acceptRequest}
                  </Button>
                ) : relationship?.status === 'PENDING' ? (
                  <Button variant="secondary" disabled>
                    {t.nav.requestSent}
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={() => send.mutate(user.id)}
                    loading={send.isPending}
                    disabled={blockedByMe}
                  >
                    <UserRoundPlus />
                    {t.nav.addFriend}
                  </Button>
                )}

                <Button
                  variant="ghost"
                  className="text-[var(--danger)]"
                  onClick={() => setBlocked.mutate({ userId: user.id, blocked: !blockedByMe })}
                  loading={setBlocked.isPending}
                >
                  <ShieldBan />
                  {blockedByMe ? t.nav.unblock : t.nav.block}
                </Button>
              </div>
            ) : (
              <div className="mt-6">
                <Button variant="secondary" onClick={() => router.push('/settings')}>
                  {t.nav.editProfile}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
