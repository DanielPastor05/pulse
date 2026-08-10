'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import {
  Check,
  Crown,
  Hash,
  Link2,
  LogOut,
  Shield,
  ShieldCheck,
  Trash2,
  UserRoundMinus,
  UserRoundPlus,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import type { MemberRole } from '@prisma/client';

import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { formatRelative } from '@/lib/date';
import { can } from '@/lib/permissions';
import {
  useJoinRequests,
  useMemberMutations,
  useUpdateConversation,
} from '@/features/conversations/hooks';
import { UserPicker } from '@/features/profile/components/user-picker';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { Badge, Switch } from '@/components/ui/misc';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import type { ConversationDetail, PublicUser } from '@/types/dto';

const ROLE_ICON: Record<MemberRole, typeof Crown | null> = {
  OWNER: Crown,
  ADMIN: ShieldCheck,
  MODERATOR: Shield,
  MEMBER: null,
};

const ROLE_LABEL: Record<MemberRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MODERATOR: 'Moderator',
  MEMBER: 'Member',
};

function InviteLink({ conversationId }: { conversationId: string }) {
  const [copied, setCopied] = React.useState(false);

  const create = useMutation({
    mutationFn: () =>
      api<{ url: string }>(`/conversations/${conversationId}/invites`, {
        method: 'POST',
        body: { expiresInHours: 168 },
      }),
    onSuccess: async ({ url }) => {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
        toast.success('Invite link copied', { description: 'Valid for 7 days.' });
      } catch {
        toast.success('Invite link created', { description: url });
      }
    },
    onError: (error) => toast.error('Could not create an invite', { description: error.message }),
  });

  return (
    <Button variant="secondary" block onClick={() => create.mutate()} loading={create.isPending}>
      {copied ? <Check /> : <Link2 />}
      {copied ? 'Copied to clipboard' : 'Create invite link'}
    </Button>
  );
}

function GroupSettings({ conversation }: { conversation: ConversationDetail }) {
  const update = useUpdateConversation(conversation.id);
  const [name, setName] = React.useState(conversation.name);
  const [description, setDescription] = React.useState(conversation.description ?? '');

  const dirty = name !== conversation.name || description !== (conversation.description ?? '');

  return (
    <div className="space-y-4">
      <Field label="Group name" htmlFor="details-name">
        <Input id="details-name" value={name} onChange={(event) => setName(event.target.value)} />
      </Field>

      <Field label="Description" htmlFor="details-description">
        <Textarea
          id="details-description"
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What is this space for?"
        />
      </Field>

      <label className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] bg-[var(--surface-sunken)] p-3">
        <span>
          <span className="block text-[13px] font-medium">Public group</span>
          <span className="block text-[12px] text-[var(--text-2)]">Listed in Discover.</span>
        </span>
        <Switch
          checked={conversation.isPublic}
          onCheckedChange={(checked) => update.mutate({ isPublic: checked })}
        />
      </label>

      {conversation.isPublic ? (
        <label className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] bg-[var(--surface-sunken)] p-3">
          <span>
            <span className="block text-[13px] font-medium">Review join requests</span>
            <span className="block text-[12px] text-[var(--text-2)]">Approve each new member.</span>
          </span>
          <Switch
            checked={conversation.requiresApproval}
            onCheckedChange={(checked) => update.mutate({ requiresApproval: checked })}
          />
        </label>
      ) : null}

      {dirty ? (
        <Button
          block
          loading={update.isPending}
          onClick={() => update.mutate({ name, description: description || null })}
        >
          Save changes
        </Button>
      ) : null}
    </div>
  );
}

function JoinRequests({ conversation }: { conversation: ConversationDetail }) {
  const enabled = can.reviewJoinRequests(conversation.role);
  const { data: requests } = useJoinRequests(conversation.id, enabled);
  const { reviewJoinRequest } = useMemberMutations(conversation.id);

  if (!enabled || !requests || requests.length === 0) return null;

  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
        Join requests
        <Badge tone="accent">{requests.length}</Badge>
      </h3>
      <ul className="space-y-1.5">
        {requests.map((request) => (
          <li
            key={request.id}
            className="flex items-center gap-2.5 rounded-[var(--radius-card)] bg-[var(--surface-sunken)] p-2.5"
          >
            <Avatar src={request.user.avatarUrl} name={request.user.displayName} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">{request.user.displayName}</p>
              <p className="truncate text-[11px] text-[var(--text-3)]">
                {request.message || `@${request.user.username}`}
              </p>
            </div>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Reject"
              onClick={() =>
                reviewJoinRequest.mutate({ requestId: request.id, status: 'REJECTED' })
              }
            >
              <X />
            </Button>
            <Button
              size="icon-sm"
              aria-label="Approve"
              onClick={() =>
                reviewJoinRequest.mutate({ requestId: request.id, status: 'APPROVED' })
              }
            >
              <Check />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DetailsPanel({
  conversation,
  meId,
}: {
  conversation: ConversationDetail;
  meId: string;
}) {
  const [addOpen, setAddOpen] = React.useState(false);
  const [invitees, setInvitees] = React.useState<PublicUser[]>([]);
  const { addMembers, updateMember, removeMember, leave } = useMemberMutations(conversation.id);

  const blockMutation = useMutation({
    mutationFn: (blocked: boolean) =>
      api('/blocks', { method: 'POST', body: { userId: conversation.peer?.id, blocked } }),
    onSuccess: (_data, blocked) =>
      toast.success(blocked ? 'Person blocked' : 'Person unblocked'),
    onError: (error) => toast.error('Could not update', { description: error.message }),
  });

  const isGroup = conversation.type === 'GROUP';
  const manages = can.manageMembers(conversation.role);

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-col items-center gap-3 text-center">
        {isGroup && !conversation.avatarUrl ? (
          <span className="bg-[var(--accent)] grid size-20 place-items-center rounded-[var(--radius-card)] text-white shadow-[var(--shadow-raised)]">
            <Hash className="size-9" />
          </span>
        ) : (
          <Avatar src={conversation.avatarUrl} name={conversation.name} size="xl" />
        )}

        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">{conversation.name}</h2>
          {conversation.peer ? (
            <Link
              href={`/u/${conversation.peer.username}`}
              className="text-[13px] text-[var(--accent)] hover:underline"
            >
              @{conversation.peer.username}
            </Link>
          ) : (
            <p className="text-[13px] text-[var(--text-2)]">
              {conversation.memberCount} members · {conversation.isPublic ? 'Public' : 'Private'}
            </p>
          )}
          {conversation.description || conversation.peer?.bio ? (
            <p className="pt-1 text-[13px] leading-relaxed text-[var(--text-2)]">
              {conversation.description ?? conversation.peer?.bio}
            </p>
          ) : null}
        </div>
      </div>

      {isGroup ? (
        <>
          {can.createInvite(conversation.role) ? <InviteLink conversationId={conversation.id} /> : null}
          <JoinRequests conversation={conversation} />

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
                Members · {conversation.members.length}
              </h3>
              {manages ? (
                <Button size="sm" variant="ghost" onClick={() => setAddOpen(true)}>
                  <UserRoundPlus />
                  Add
                </Button>
              ) : null}
            </div>

            <ul className="space-y-0.5">
              {conversation.members.map((member) => {
                const RoleIcon = ROLE_ICON[member.role];
                const isMe = member.user.id === meId;

                return (
                  <li key={member.id}>
                    <div className="flex items-center gap-2.5 rounded-[var(--radius-card)] p-2 transition-colors hover:bg-[var(--surface-sunken)]">
                      <Avatar
                        src={member.user.avatarUrl}
                        name={member.user.displayName}
                        size="sm"
                        presence={member.user.presence}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate text-[13px] font-medium">
                          {member.nickname ?? member.user.displayName}
                          {isMe ? <span className="text-[11px] text-[var(--text-3)]">(you)</span> : null}
                        </p>
                        <p className="truncate text-[11px] text-[var(--text-3)]">
                          {RoleIcon ? ROLE_LABEL[member.role] : `joined ${formatRelative(member.joinedAt)}`}
                        </p>
                      </div>

                      {RoleIcon ? (
                        <RoleIcon
                          className={cn(
                            'size-3.5 shrink-0',
                            member.role === 'OWNER' ? 'text-[var(--warning)]' : 'text-[var(--accent)]',
                          )}
                        />
                      ) : null}

                      {manages && !isMe && member.role !== 'OWNER' ? (
                        <Menu>
                          <MenuTrigger asChild>
                            <Button size="icon-sm" variant="ghost" aria-label={`Manage ${member.user.displayName}`}>
                              <span className="text-base leading-none">⋯</span>
                            </Button>
                          </MenuTrigger>
                          <MenuContent align="end">
                            {can.assignRoles(conversation.role) ? (
                              <>
                                <MenuLabel>Role</MenuLabel>
                                {(['ADMIN', 'MODERATOR', 'MEMBER'] as const).map((role) => (
                                  <MenuItem
                                    key={role}
                                    onSelect={() =>
                                      updateMember.mutate({ userId: member.user.id, role })
                                    }
                                  >
                                    {ROLE_LABEL[role]}
                                    {member.role === role ? <Check className="ml-auto size-3.5" /> : null}
                                  </MenuItem>
                                ))}
                                <MenuSeparator />
                              </>
                            ) : null}
                            <MenuItem danger onSelect={() => removeMember.mutate(member.user.id)}>
                              <UserRoundMinus />
                              Remove from group
                            </MenuItem>
                          </MenuContent>
                        </Menu>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {can.editConversation(conversation.role) ? (
            <section className="space-y-3 border-t border-[var(--hairline)] pt-5">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
                Group settings
              </h3>
              <GroupSettings conversation={conversation} />
            </section>
          ) : null}

          <div className="border-t border-[var(--hairline)] pt-4">
            <Button
              variant="ghost"
              block
              className="text-[var(--danger)]"
              onClick={() => leave.mutate(meId)}
              loading={leave.isPending}
            >
              <LogOut />
              Leave group
            </Button>
          </div>
        </>
      ) : (
        <div className="space-y-2 border-t border-[var(--hairline)] pt-4">
          <Button
            variant="ghost"
            block
            className="text-[var(--danger)]"
            onClick={() => blockMutation.mutate(!conversation.blockedByMe)}
            loading={blockMutation.isPending}
          >
            <Trash2 />
            {conversation.blockedByMe ? 'Unblock this person' : 'Block this person'}
          </Button>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Add members</DialogTitle>
            <DialogDescription>They will see the full message history.</DialogDescription>
          </DialogHeader>

          <UserPicker
            selected={invitees}
            onChange={setInvitees}
            excludeIds={conversation.members.map((member) => member.user.id)}
          />

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={invitees.length === 0}
              loading={addMembers.isPending}
              onClick={() =>
                addMembers.mutate(
                  invitees.map((user) => user.id),
                  {
                    onSuccess: () => {
                      setInvitees([]);
                      setAddOpen(false);
                    },
                  },
                )
              }
            >
              <UserRoundPlus />
              Add {invitees.length > 0 ? invitees.length : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
