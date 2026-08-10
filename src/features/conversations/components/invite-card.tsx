'use client';

import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Hash, LinkIcon, Users } from 'lucide-react';
import { toast } from 'sonner';

import { api } from '@/lib/api-client';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

type InviteSummary = {
  invitedBy: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  accent: string;
  memberCount: number;
};

export function InviteCard({
  code,
  invite,
  expired,
}: {
  code: string;
  invite: InviteSummary | null;
  expired: boolean;
}) {
  const router = useRouter();

  const accept = useMutation({
    mutationFn: () => api<{ conversationId: string }>(`/invites/${code}`, { method: 'POST' }),
    onSuccess: ({ conversationId }) => {
      router.replace(`/chat/${conversationId}`);
      router.refresh();
    },
    onError: (error) => toast.error('Could not join', { description: error.message }),
  });

  if (!invite || expired) {
    return (
      <div className="panel w-full max-w-md rounded-[var(--radius-panel)] shadow-[var(--shadow-overlay)]">
        <EmptyState
          icon={<LinkIcon />}
          title={expired ? 'This invite has expired' : 'Invite not found'}
          description="Ask whoever sent it for a fresh link."
          action={
            <Button variant="secondary" onClick={() => router.push('/chat')}>
              Go to your chats
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div      data-accent={invite.accent}
      className="panel w-full max-w-md overflow-hidden rounded-[var(--radius-panel)] shadow-[var(--shadow-overlay)]"
    >
      

      <div className="-mt-10 px-7 pb-7 text-center">
        <div className="flex justify-center">
          {invite.avatarUrl ? (
            <Avatar src={invite.avatarUrl} name={invite.name} size="xl" ring />
          ) : (
            <span className="grid size-16 place-items-center rounded-[var(--radius-card)] border border-[var(--hairline-strong)] bg-[var(--surface-sunken)] text-[var(--text-2)]">
              <Hash className="size-9" />
            </span>
          )}
        </div>

        <p className="mt-5 text-[13px] text-[var(--text-3)]">
          <span className="font-medium text-[var(--text-2)]">{invite.invitedBy}</span> invited you to
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.02em]">{invite.name}</h1>

        <p className="mt-1 flex items-center justify-center gap-1.5 text-[13px] text-[var(--text-3)]">
          <Users className="size-3.5" />
          {invite.memberCount} member{invite.memberCount === 1 ? '' : 's'}
        </p>

        {invite.description ? (
          <p className="mt-4 text-[14px] leading-relaxed text-[var(--text-2)]">
            {invite.description}
          </p>
        ) : null}

        <div className="mt-7 flex flex-col gap-2">
          <Button size="lg" block loading={accept.isPending} onClick={() => accept.mutate()}>
            Accept invite
          </Button>
          <Button variant="ghost" block onClick={() => router.push('/chat')}>
            Not now
          </Button>
        </div>
      </div>
    </div>
  );
}
