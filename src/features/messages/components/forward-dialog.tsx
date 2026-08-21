'use client';

import * as React from 'react';
import { Check, Forward, Hash, Search } from 'lucide-react';

import { cn, truncate } from '@/lib/utils';
import { useConversations } from '@/features/conversations/hooks';
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
import { Input } from '@/components/ui/input';
import { ConversationSkeleton } from '@/components/ui/skeleton';
import type { MessageDTO } from '@/types/dto';
import { useT } from '@/i18n/provider';

type Props = {
  message: MessageDTO | null;
  onClose: () => void;
  onConfirm: (conversationIds: string[]) => void;
  pending: boolean;
};

export function ForwardDialog({ message, onClose, onConfirm, pending }: Props) {
  const t = useT();
  const [term, setTerm] = React.useState('');
  const [selected, setSelected] = React.useState<string[]>([]);
  const { data: conversations, isLoading } = useConversations();

  React.useEffect(() => {
    if (!message) {
      setSelected([]);
      setTerm('');
    }
  }, [message]);

  const results = (conversations ?? []).filter((conversation) =>
    conversation.name.toLowerCase().includes(term.trim().toLowerCase()),
  );

  const toggle = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  return (
    <Dialog open={Boolean(message)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t.message.forwardTitle}</DialogTitle>
          <DialogDescription>
            {t.message.forwardHint}
          </DialogDescription>
        </DialogHeader>

        {message ? (
          <div className="mb-4 rounded-[var(--radius-card)] bg-[var(--surface-sunken)] p-3">
            <p className="text-[11px] font-semibold text-[var(--text-3)]">
              {message.author?.displayName ?? t.message.unknown}
            </p>
            <p className="mt-0.5 text-[13px] text-[var(--text-2)]">
              {message.content
                ? truncate(message.content, 140)
                : `${message.attachments.length} attachment${message.attachments.length === 1 ? '' : 's'}`}
            </p>
          </div>
        ) : null}

        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={t.sidebar.filter}
          icon={<Search />}
          className="h-10 text-[13px]"
        />

        <div className="scroll-area mt-3 max-h-64 overflow-y-auto rounded-[var(--radius-card)] bg-[var(--surface-sunken)] p-1.5">
          {isLoading ? (
            <ConversationSkeleton count={4} />
          ) : results.length === 0 ? (
            <p className="px-3 py-8 text-center text-[13px] text-[var(--text-3)]">
              {t.message.noMatchFilter}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {results.map((conversation) => {
                const checked = selected.includes(conversation.id);
                return (
                  <li key={conversation.id}>
                    <button
                      type="button"
                      onClick={() => toggle(conversation.id)}
                      aria-pressed={checked}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-[var(--radius-field)] p-2 text-left transition-colors',
                        checked ? 'bg-[var(--surface)]' : 'hover:bg-[var(--surface)]',
                      )}
                    >
                      {conversation.type === 'GROUP' && !conversation.avatarUrl ? (
                        <span className="bg-[var(--accent)] grid size-8 shrink-0 place-items-center rounded-full text-white">
                          <Hash className="size-4" />
                        </span>
                      ) : (
                        <Avatar
                          src={conversation.avatarUrl}
                          name={conversation.name}
                          size="sm"
                        />
                      )}
                      <span className="flex-1 truncate text-[13px] font-medium">
                        {conversation.name}
                      </span>
                      <span
                        className={cn(
                          'grid size-5 shrink-0 place-items-center rounded-md border transition-colors',
                          checked
                            ? 'bg-[var(--accent)] border-transparent text-[var(--on-accent)]'
                            : 'border-[var(--hairline-strong)]',
                        )}
                      >
                        {checked ? <Check className="size-3" /> : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button
            onClick={() => onConfirm(selected.slice(0, 10))}
            disabled={selected.length === 0}
            loading={pending}
          >
            <Forward />
            {t.message.forward}
            {selected.length > 0 ? ` (${selected.length})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
