'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Compass,
  FileText,
  Hash,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Settings,
  Star,
  UserRound,
} from 'lucide-react';

import { cn, truncate } from '@/lib/utils';
import { useUiStore } from '@/stores/ui-store';
import { useConversations, useOpenDirectConversation } from '@/features/conversations/hooks';
import { useGlobalSearch } from '@/features/search/hooks';
import { Avatar } from '@/components/ui/avatar';
import { Kbd } from '@/components/ui/misc';

const itemClass = cn(
  'flex cursor-pointer items-center gap-3 rounded-[var(--radius-field)] px-3 py-2.5 text-[13px]',
  'text-[var(--text-2)] outline-none transition-colors duration-100',
  'data-[selected=true]:bg-[var(--surface-hover)] data-[selected=true]:text-[var(--text-1)]',
  '[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-[var(--text-3)]',
  'data-[selected=true]:[&_svg]:text-[var(--accent)]',
);

const groupClass = cn(
  '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3',
  '[&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-bold',
  '[&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest',
  '[&_[cmdk-group-heading]]:text-[var(--text-3)]',
);

/**
 * ⌘K. Recent conversations by default; live global search once you type.
 * cmdk owns filtering for the static rows and we feed it server results for
 * the rest, with `shouldFilter={false}` so the server ranking is respected.
 */
export function CommandPalette() {
  const router = useRouter();
  const { commandOpen, setCommandOpen } = useUiStore();
  const [term, setTerm] = React.useState('');

  const { data: conversations = [] } = useConversations();
  const { data: results, isFetching } = useGlobalSearch(term, 'all', commandOpen);
  const openDirect = useOpenDirectConversation();

  const searching = term.trim().length >= 2;

  React.useEffect(() => {
    if (!commandOpen) setTerm('');
  }, [commandOpen]);

  const run = (action: () => void) => {
    setCommandOpen(false);
    action();
  };

  const recent = conversations.slice(0, 6);

  return (
    <DialogPrimitive.Root open={commandOpen} onOpenChange={setCommandOpen}>
      <DialogPrimitive.Portal>
        {/*
          No entrance animation, deliberately. This opens on ⌘K hundreds of
          times a day; any transition is time the user waits before typing.
          Raycast ships it instant for exactly this reason.
        */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70" />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-[14vh] z-50 w-[calc(100vw-2rem)] max-w-[34rem] -translate-x-1/2',
            'overflow-hidden rounded-[var(--radius-panel)] border border-[var(--hairline-strong)]',
            'surface-overlay shadow-[var(--shadow-modal)] outline-none',
          )}
        >
          <DialogPrimitive.Title className="sr-only">Search Pulse</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Find people, conversations, messages and files.
          </DialogPrimitive.Description>

          <Command shouldFilter={false} loop className="w-full">
            <div className="flex items-center gap-3 border-b border-[var(--hairline)] px-4">
              {isFetching && searching ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-[var(--accent)]" />
              ) : (
                <Search className="size-4 shrink-0 text-[var(--text-3)]" />
              )}
              <Command.Input
                value={term}
                onValueChange={setTerm}
                autoFocus
                placeholder="Search people, groups, messages and files…"
                className="h-14 flex-1 bg-transparent text-[15px] text-[var(--text-1)] outline-none placeholder:text-[var(--text-3)]"
              />
              <Kbd>Esc</Kbd>
            </div>

            <Command.List className="scroll-area max-h-[52vh] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-10 text-center text-[13px] text-[var(--text-3)]">
                {searching ? 'Nothing matched that search.' : 'Start typing to search.'}
              </Command.Empty>

              {!searching ? (
                <>
                  <Command.Group heading="Recent" className={groupClass}>
                    {recent.map((conversation) => (
                      <Command.Item
                        key={conversation.id}
                        value={`recent-${conversation.id}`}
                        className={itemClass}
                        onSelect={() => run(() => router.push(`/chat/${conversation.id}`))}
                      >
                        <Avatar
                          src={conversation.avatarUrl}
                          name={conversation.name}
                          size="xs"
                          presence={conversation.peer?.presence}
                        />
                        <span className="flex-1 truncate">{conversation.name}</span>
                        {conversation.unreadCount > 0 ? (
                          <span
                            data-numeric
                            className="rounded-full bg-[var(--accent)] px-1.5 text-[10px] font-bold text-[var(--on-accent)]"
                          >
                            {conversation.unreadCount}
                          </span>
                        ) : null}
                      </Command.Item>
                    ))}
                  </Command.Group>

                  <Command.Group heading="Actions" className={groupClass}>
                    <Command.Item
                      value="action-new-group"
                      className={itemClass}
                      onSelect={() => run(() => router.push('/chat?new=group'))}
                    >
                      <Plus />
                      Create a group
                    </Command.Item>
                    <Command.Item
                      value="action-discover"
                      className={itemClass}
                      onSelect={() => run(() => router.push('/discover'))}
                    >
                      <Compass />
                      Discover public groups
                    </Command.Item>
                    <Command.Item
                      value="action-starred"
                      className={itemClass}
                      onSelect={() => run(() => router.push('/starred'))}
                    >
                      <Star />
                      Starred messages
                    </Command.Item>
                    <Command.Item
                      value="action-settings"
                      className={itemClass}
                      onSelect={() => run(() => router.push('/settings'))}
                    >
                      <Settings />
                      Open settings
                    </Command.Item>
                  </Command.Group>
                </>
              ) : (
                <>
                  {results?.users.length ? (
                    <Command.Group heading="People" className={groupClass}>
                      {results.users.map((user) => (
                        <Command.Item
                          key={user.id}
                          value={`user-${user.id}`}
                          className={itemClass}
                          onSelect={() => run(() => openDirect.mutate(user.id))}
                        >
                          <Avatar
                            src={user.avatarUrl}
                            name={user.displayName}
                            size="xs"
                            presence={user.presence}
                          />
                          <span className="flex-1 truncate">{user.displayName}</span>
                          <span className="text-[11px] text-[var(--text-3)]">@{user.username}</span>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  ) : null}

                  {results?.conversations.length ? (
                    <Command.Group heading="Conversations" className={groupClass}>
                      {results.conversations.map((conversation) => (
                        <Command.Item
                          key={conversation.id}
                          value={`conversation-${conversation.id}`}
                          className={itemClass}
                          onSelect={() => run(() => router.push(`/chat/${conversation.id}`))}
                        >
                          {conversation.type === 'GROUP' ? <Hash /> : <UserRound />}
                          <span className="flex-1 truncate">{conversation.name}</span>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  ) : null}

                  {results?.messages.length ? (
                    <Command.Group heading="Messages" className={groupClass}>
                      {results.messages.map(({ message, conversation }) => (
                        <Command.Item
                          key={message.id}
                          value={`message-${message.id}`}
                          className={itemClass}
                          onSelect={() =>
                            run(() => router.push(`/chat/${conversation.id}?m=${message.id}`))
                          }
                        >
                          <MessageSquare />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[var(--text-1)]">
                              {truncate(message.content, 70)}
                            </span>
                            <span className="block truncate text-[11px] text-[var(--text-3)]">
                              {message.author?.displayName} in {conversation.name}
                            </span>
                          </span>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  ) : null}

                  {results?.files.length ? (
                    <Command.Group heading="Files" className={groupClass}>
                      {results.files.map((file) => (
                        <Command.Item
                          key={file.attachment.id}
                          value={`file-${file.attachment.id}`}
                          className={itemClass}
                          onSelect={() =>
                            run(() =>
                              router.push(`/chat/${file.conversationId}?m=${file.messageId}`),
                            )
                          }
                        >
                          <FileText />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[var(--text-1)]">
                              {file.attachment.name}
                            </span>
                            <span className="block truncate text-[11px] text-[var(--text-3)]">
                              {file.conversationName}
                            </span>
                          </span>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  ) : null}
                </>
              )}
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
