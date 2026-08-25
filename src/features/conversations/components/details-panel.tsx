'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import {
  Check,
  Crown,
  Flag,
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
import { useDates } from '@/i18n/dates';
import { can } from '@/lib/permissions';
import {
  useJoinRequests,
  useMemberMutations,
  useUpdateConversation,
} from '@/features/conversations/hooks';
import { useReports, useReviewReport } from '@/features/moderation/hooks';
import { UserPicker } from '@/features/profile/components/user-picker';
import { BotonDeAmistad } from '@/features/profile/components/friend-button';
import { BotonDeApodo } from '@/features/conversations/components/nickname-button';
import { AccentPicker } from '@/features/profile/components/accent-picker';
import { AvatarPicker } from '@/features/profile/components/avatar-picker';
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
import type { ConversationDetail, PublicUser, ReportDTO } from '@/types/dto';
import { useT } from '@/i18n/provider';
import type { SoloTexto } from '@/i18n/en';

const ROLE_ICON: Record<MemberRole, typeof Crown | null> = {
  OWNER: Crown,
  ADMIN: ShieldCheck,
  MODERATOR: Shield,
  MEMBER: null,
};

const REPORT_LABEL: Record<ReportDTO['reason'], SoloTexto<'conversation'>> = {
  SPAM: 'spam',
  HARASSMENT: 'harassment',
  HATE: 'hate',
  VIOLENCE: 'violence',
  SEXUAL: 'sexual',
  SELF_HARM: 'selfHarm',
  OTHER: 'other',
};

const ROLE_LABEL: Record<MemberRole, SoloTexto<'conversation'>> = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  MEMBER: 'member',
};

function InviteLink({ conversationId }: { conversationId: string }) {
  const t = useT();
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
        toast.success(t.conversation.inviteCopied, { description: t.conversation.inviteValid });
      } catch {
        toast.success(t.conversation.inviteCreated, { description: url });
      }
    },
    onError: (error) => toast.error(t.conversation.inviteFailed, { description: error.message }),
  });

  return (
    <Button variant="secondary" block onClick={() => create.mutate()} loading={create.isPending}>
      {copied ? <Check /> : <Link2 />}
      {copied ? t.conversation.copied : t.conversation.createInviteLink}
    </Button>
  );
}

function GroupSettings({ conversation }: { conversation: ConversationDetail }) {
  const t = useT();
  const update = useUpdateConversation(conversation.id);
  const [name, setName] = React.useState(conversation.name);
  const [description, setDescription] = React.useState(conversation.description ?? '');

  const dirty = name !== conversation.name || description !== (conversation.description ?? '');

  return (
    <div className="space-y-4">
      {/*
        Foto y color, como en el perfil.

        Los dos campos existían en el esquema y en el validador desde el
        principio — `avatarUrl` y `accent` en la conversación— y no había forma
        de tocarlos desde la interfaz: un grupo salía siempre con la almohadilla
        y el color por defecto. Se pidió «personalización de los grupos como la
        del perfil», y era casi todo interfaz.

        Se reutilizan los mismos selectores que el perfil en vez de escribir
        otros: si un día cambia la lista de acentos, cambia en los dos sitios.
      */}
      <AvatarPicker
        value={conversation.avatarUrl}
        name={conversation.name}
        size="lg"
        onChange={(url) => update.mutate({ avatarUrl: url })}
      />

      <Field label={t.auth.accentColour}>
        <AccentPicker
          value={conversation.accent}
          onChange={(accent) => update.mutate({ accent })}
        />
      </Field>

      <Field label={t.conversation.groupName} htmlFor="details-name">
        <Input id="details-name" value={name} onChange={(event) => setName(event.target.value)} />
      </Field>

      <Field label={t.conversation.description} htmlFor="details-description">
        <Textarea
          id="details-description"
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={t.conversation.descriptionPlaceholder}
        />
      </Field>

      <label className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] bg-[var(--surface-sunken)] p-3">
        <span>
          <span className="block text-[13px] font-medium">{t.conversation.publicGroup}</span>
          <span className="block text-[12px] text-[var(--text-2)]">{t.conversation.publicGroupHintShort}</span>
        </span>
        <Switch
          checked={conversation.isPublic}
          onCheckedChange={(checked) => update.mutate({ isPublic: checked })}
        />
      </label>

      {conversation.isPublic ? (
        <label className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] bg-[var(--surface-sunken)] p-3">
          <span>
            <span className="block text-[13px] font-medium">{t.conversation.reviewRequests}</span>
            <span className="block text-[12px] text-[var(--text-2)]">{t.conversation.approveEach}</span>
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
          {t.common.saveChanges}
        </Button>
      ) : null}
    </div>
  );
}

function JoinRequests({ conversation }: { conversation: ConversationDetail }) {
  const t = useT();
  const enabled = can.reviewJoinRequests(conversation.role);
  const { data: requests } = useJoinRequests(conversation.id, enabled);
  const { reviewJoinRequest } = useMemberMutations(conversation.id);

  if (!enabled || !requests || requests.length === 0) return null;

  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
        {t.conversation.joinRequests}
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
              aria-label={t.conversation.reject}
              onClick={() =>
                reviewJoinRequest.mutate({ requestId: request.id, status: 'REJECTED' })
              }
            >
              <X />
            </Button>
            <Button
              size="icon-sm"
              aria-label={t.conversation.approve}
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

/** Same shape as JoinRequests: a queue only moderators ever see. */
function Reports({ conversation }: { conversation: ConversationDetail }) {
  const t = useT();
  const enabled = can.moderateMessages(conversation.role);
  const { data: reports } = useReports(conversation.id, enabled);
  const review = useReviewReport(conversation.id);

  if (!enabled || !reports || reports.length === 0) return null;

  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
        {t.conversation.reports}
        <Badge tone="danger">{reports.length}</Badge>
      </h3>
      <ul className="space-y-1.5">
        {reports.map((report) => (
          <li
            key={report.id}
            className="rounded-[var(--radius-card)] bg-[var(--surface-sunken)] p-2.5"
          >
            <div className="flex items-center gap-2">
              <Flag className="size-3.5 shrink-0 text-[var(--danger)]" />
              <p className="min-w-0 flex-1 truncate text-[12px] font-medium">
                {t.conversation[REPORT_LABEL[report.reason]]}
              </p>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={t.conversation.dismissReport}
                onClick={() => review.mutate({ reportId: report.id, status: 'DISMISSED' })}
              >
                <X />
              </Button>
              <Button
                size="icon-sm"
                aria-label={t.conversation.markResolved}
                onClick={() => review.mutate({ reportId: report.id, status: 'RESOLVED' })}
              >
                <Check />
              </Button>
            </div>

            {report.message ? (
              <p className="mt-1.5 line-clamp-2 rounded bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--text-2)]">
                {report.message.deleted ? t.conversation.deletedPrefix : ''}
                {report.message.content || t.conversation.noText}
              </p>
            ) : null}

            <p className="mt-1 text-[11px] text-[var(--text-3)]">
              {report.reportedUser ? t.conversation.aboutUser(report.reportedUser.username) : ''}
              {t.conversation.reportedBy(report.reporter.username)}
            </p>
            {report.note ? (
              <p className="mt-0.5 text-[11px] italic text-[var(--text-3)]">“{report.note}”</p>
            ) : null}
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
  const t = useT();
  const { formatRelative } = useDates();
  const [addOpen, setAddOpen] = React.useState(false);
  const [invitees, setInvitees] = React.useState<PublicUser[]>([]);
  const { addMembers, updateMember, removeMember, transferOwnership, leave } = useMemberMutations(
    conversation.id,
  );

  const blockMutation = useMutation({
    mutationFn: (blocked: boolean) =>
      api('/blocks', { method: 'POST', body: { userId: conversation.peer?.id, blocked } }),
    onSuccess: (_data, blocked) =>
      toast.success(blocked ? t.conversation.personBlocked : t.conversation.personUnblocked),
    onError: (error) => toast.error(t.conversation.updateFailed, { description: error.message }),
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
              {t.conversation.members(conversation.memberCount)} ·{' '}
              {conversation.isPublic ? t.conversation.public : t.conversation.private}
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
          <Reports conversation={conversation} />

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
                {t.conversation.membersHeading} · {conversation.members.length}
              </h3>
              {manages ? (
                <Button size="sm" variant="ghost" onClick={() => setAddOpen(true)}>
                  <UserRoundPlus />
                  {t.conversation.add}
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
                          {isMe ? <span className="text-[11px] text-[var(--text-3)]">({t.common.you})</span> : null}
                        </p>
                        <p className="truncate text-[11px] text-[var(--text-3)]">
                          {RoleIcon
                            ? t.conversation[ROLE_LABEL[member.role]]
                            : t.conversation.joinedAgo(formatRelative(member.joinedAt))}
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

                      {/*
                        Añadir a amigos desde donde está la gente.

                        Antes sólo se podía desde el perfil, y para llegar había
                        que saber que el nombre era pulsable. Se reportó como
                        «el añadir amigos es lioso, poner un botón al lado del
                        nombre», y es literalmente eso: la lista de miembros es
                        el sitio donde uno ve a alguien y decide agregarlo.
                      */}
                      {!isMe ? <BotonDeAmistad user={member.user} /> : null}

                      {/*
                        El apodo estaba construido entero y no se podía poner.
                        Modelo, validador, permisos y pintado existían desde
                        siempre; faltaba el botón. Se pidió como «apodos», y era
                        interfaz sobre algo que ya funcionaba.

                        Quien puede: uno mismo siempre —el servicio lo permite— y
                        quien modera, sobre los demás. Esa es exactamente la
                        regla de `updateMember`, no una copia suya.
                      */}
                      {isMe || manages ? (
                        <BotonDeApodo
                          nombre={member.user.displayName}
                          apodo={member.nickname}
                          onGuardar={(nickname) =>
                            updateMember.mutate({ userId: member.user.id, nickname })
                          }
                        />
                      ) : null}

                      {manages && !isMe && member.role !== 'OWNER' ? (
                        <Menu>
                          <MenuTrigger asChild>
                            <Button size="icon-sm" variant="ghost" aria-label={t.conversation.manageMember(member.user.displayName)}>
                              <span className="text-base leading-none">⋯</span>
                            </Button>
                          </MenuTrigger>
                          <MenuContent align="end">
                            {can.assignRoles(conversation.role) ? (
                              <>
                                <MenuLabel>{t.conversation.role}</MenuLabel>
                                {(['ADMIN', 'MODERATOR', 'MEMBER'] as const).map((role) => (
                                  <MenuItem
                                    key={role}
                                    onSelect={() =>
                                      updateMember.mutate({ userId: member.user.id, role })
                                    }
                                  >
                                    {t.conversation[ROLE_LABEL[role]]}
                                    {member.role === role ? <Check className="ml-auto size-3.5" /> : null}
                                  </MenuItem>
                                ))}
                                <MenuSeparator />
                              </>
                            ) : null}
                            {conversation.role === 'OWNER' ? (
                              <>
                                <MenuItem
                                  onSelect={() => {
                                    // One-way and demotes the caller, so it asks
                                    // rather than firing off a menu click.
                                    if (
                                      window.confirm(
                                        t.conversation.makeOwnerConfirm(member.user.displayName),
                                      )
                                    ) {
                                      transferOwnership.mutate(member.user.id);
                                    }
                                  }}
                                >
                                  <Crown />
                                  {t.conversation.makeOwner}
                                </MenuItem>
                                <MenuSeparator />
                              </>
                            ) : null}
                            <MenuItem danger onSelect={() => removeMember.mutate(member.user.id)}>
                              <UserRoundMinus />
                              {t.conversation.removeFromGroup}
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
                {t.conversation.groupSettings}
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
              {t.conversation.leaveGroup}
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
            {conversation.blockedByMe ? t.conversation.unblockPerson : t.conversation.blockPerson}
          </Button>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t.conversation.addMembers}</DialogTitle>
            <DialogDescription>{t.conversation.addMembersHint}</DialogDescription>
          </DialogHeader>

          <UserPicker
            selected={invitees}
            onChange={setInvitees}
            excludeIds={conversation.members.map((member) => member.user.id)}
          />

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              {t.common.cancel}
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
              {t.conversation.add} {invitees.length > 0 ? invitees.length : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
