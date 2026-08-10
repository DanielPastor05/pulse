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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'direct' | 'group';
};

export function NewConversationDialog({ open, onOpenChange, defaultTab = 'direct' }: Props) {
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
          <DialogTitle>Start something new</DialogTitle>
          <DialogDescription>
            Message one person directly, or spin up a group with a name and a vibe.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={defaultTab}>
          <TabsList className="mb-5 w-full">
            <TabsTrigger value="direct" className="flex-1">
              <span className="flex items-center justify-center gap-1.5">
                <MessageSquarePlus className="size-4" />
                Direct
              </span>
            </TabsTrigger>
            <TabsTrigger value="group" className="flex-1">
              <span className="flex items-center justify-center gap-1.5">
                <Hash className="size-4" />
                Group
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="direct" className="space-y-5">
            <UserPicker
              selected={directTarget}
              onChange={(users) => setDirectTarget(users.slice(-1))}
              max={1}
              placeholder="Who do you want to talk to?"
            />
            <DialogFooter>
              <Button variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button
                onClick={startDirect}
                disabled={directTarget.length === 0}
                loading={openDirect.isPending}
              >
                <UserRoundPlus />
                Open chat
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="group">
            <form onSubmit={submitGroup} className="space-y-5">
              <div className="flex items-start gap-5">
                <AvatarPicker
                  value={values.avatarUrl ?? null}
                  name={values.name || 'New group'}
                  onChange={(url) => setValue('avatarUrl', url)}
                  size="lg"
                />
              </div>

              <Field label="Group name" htmlFor="group-name" error={formState.errors.name?.message}>
                <Input
                  id="group-name"
                  placeholder="Design guild"
                  aria-invalid={Boolean(formState.errors.name)}
                  {...register('name')}
                />
              </Field>

              <Field
                label="Description"
                htmlFor="group-description"
                hint="Optional"
                error={formState.errors.description?.message}
              >
                <Textarea
                  id="group-description"
                  rows={2}
                  placeholder="What is this space for?"
                  {...register('description')}
                />
              </Field>

              <Field label="Accent">
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
                      {values.isPublic ? 'Public group' : 'Private group'}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-[var(--text-2)]">
                      {values.isPublic
                        ? 'Anyone can find this group in Discover.'
                        : 'Only people you invite can join.'}
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
                          Review join requests
                        </span>
                        <span className="mt-0.5 block text-[12px] text-[var(--text-2)]">
                          Moderators approve each person before they can post.
                        </span>
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <Field label="Invite people" hint="Optional">
                <UserPicker selected={groupMembers} onChange={setGroupMembers} />
              </Field>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={close}>
                  Cancel
                </Button>
                <Button type="submit" loading={createGroup.isPending}>
                  <Hash />
                  Create group
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
