'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Globe, Hash, Lock, MessageSquarePlus, ShieldCheck, UserRoundPlus } from 'lucide-react';

import { cn } from '@/lib/utils';
import { createGroupSchema, type CreateGroupInput } from '@/features/conversations/validators';
import { useCreateGroup, useOpenDirectConversation } from '@/features/conversations/hooks';
import { AccentPicker } from '@/features/profile/components/accent-picker';
import { AvatarPicker } from '@/features/profile/components/avatar-picker';
import { UserPicker } from '@/features/profile/components/user-picker';
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
import { Switch, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import type { PublicUser } from '@/types/dto';
import { useT } from '@/i18n/provider';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'direct' | 'group';
};

export function NewConversationDialog({ open, onOpenChange, defaultTab = 'direct' }: Props) {
  const t = useT();
  const [directTarget, setDirectTarget] = React.useState<PublicUser[]>([]);
  const [groupMembers, setGroupMembers] = React.useState<PublicUser[]>([]);

  const openDirect = useOpenDirectConversation();
  const createGroup = useCreateGroup();

  const form = useForm<CreateGroupInput>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: {
      name: '',
      description: '',
      isPublic: false,
      requiresApproval: false,
      accent: 'violet',
      avatarUrl: null,
      memberIds: [],
    },
  });

  const { register, handleSubmit, watch, setValue, formState, reset } = form;
  const values = watch();

  const close = () => {
    onOpenChange(false);
    setDirectTarget([]);
    setGroupMembers([]);
    reset();
  };

  const startDirect = () => {
    const target = directTarget[0];
    if (!target) return;
    openDirect.mutate(target.id, { onSuccess: close });
  };

  const submitGroup = handleSubmit((input) => {
    createGroup.mutate(
      { ...input, memberIds: groupMembers.map((member) => member.id) },
      { onSuccess: close },
    );
  });

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{t.conversation.createTitle}</DialogTitle>
          <DialogDescription>
            {t.conversation.createHint}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={defaultTab}>
          <TabsList className="mb-5 w-full">
            <TabsTrigger value="direct" className="flex-1">
              <span className="flex items-center justify-center gap-1.5">
                <MessageSquarePlus className="size-4" />
                {t.conversation.direct}
              </span>
            </TabsTrigger>
            <TabsTrigger value="group" className="flex-1">
              <span className="flex items-center justify-center gap-1.5">
                <Hash className="size-4" />
                {t.conversation.group}
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="direct" className="space-y-5">
            <UserPicker
              selected={directTarget}
              onChange={(users) => setDirectTarget(users.slice(-1))}
              max={1}
              placeholder={t.conversation.whoTalkTo}
            />
            <DialogFooter>
              <Button variant="ghost" onClick={close}>
                {t.common.cancel}
              </Button>
              <Button
                onClick={startDirect}
                disabled={directTarget.length === 0}
                loading={openDirect.isPending}
              >
                <UserRoundPlus />
                {t.conversation.openChat}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="group">
            <form onSubmit={submitGroup} className="space-y-5">
              <div className="flex items-start gap-5">
                <AvatarPicker
                  value={values.avatarUrl ?? null}
                  name={values.name || t.conversation.newGroup}
                  onChange={(url) => setValue('avatarUrl', url)}
                  size="lg"
                />
              </div>

              <Field label={t.conversation.groupName} htmlFor="group-name" error={formState.errors.name?.message}>
                <Input
                  id="group-name"
                  placeholder={t.conversation.groupNamePlaceholder}
                  aria-invalid={Boolean(formState.errors.name)}
                  {...register('name')}
                />
              </Field>

              <Field
                label={t.conversation.description}
                htmlFor="group-description"
                hint={t.conversation.optional}
                error={formState.errors.description?.message}
              >
                <Textarea
                  id="group-description"
                  rows={2}
                  placeholder={t.conversation.descriptionPlaceholder}
                  {...register('description')}
                />
              </Field>

              <Field label={t.settings.accent}>
                <AccentPicker
                  value={values.accent}
                  onChange={(accent) => setValue('accent', accent)}
                />
              </Field>

              <div className="space-y-2.5 rounded-[var(--radius-card)] bg-[var(--surface-sunken)] p-3.5">
                <label className="flex items-start gap-3">
                  <Switch
                    checked={values.isPublic}
                    onCheckedChange={(checked) => setValue('isPublic', checked)}
                  />
                  <span className="flex-1">
                    <span className="flex items-center gap-1.5 text-[13px] font-medium">
                      {values.isPublic ? <Globe className="size-3.5" /> : <Lock className="size-3.5" />}
                      {values.isPublic ? t.conversation.publicGroup : 'Private group'}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-[var(--text-2)]">
                      {values.isPublic
                        ? t.conversation.publicHint
                        : t.conversation.privateHint}
                    </span>
                  </span>
                </label>

                <div
                  className={cn(
                    'grid transition-all duration-300 ease-[var(--ease-out)]',
                    values.isPublic ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                  )}
                >
                  <div className="overflow-hidden">
                    <label className="flex items-start gap-3 pt-2.5">
                      <Switch
                        checked={values.requiresApproval}
                        onCheckedChange={(checked) => setValue('requiresApproval', checked)}
                      />
                      <span className="flex-1">
                        <span className="flex items-center gap-1.5 text-[13px] font-medium">
                          <ShieldCheck className="size-3.5" />
                          {t.conversation.reviewRequests}
                        </span>
                        <span className="mt-0.5 block text-[12px] text-[var(--text-2)]">
                          {t.conversation.reviewRequestsHint}
                        </span>
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <Field label={t.conversation.invitePeople} hint={t.conversation.optional}>
                <UserPicker selected={groupMembers} onChange={setGroupMembers} />
              </Field>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={close}>
                  {t.common.cancel}
                </Button>
                <Button type="submit" loading={createGroup.isPending}>
                  <Hash />
                  {t.conversation.createGroup}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
