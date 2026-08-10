'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Ban, Info, Pin, Search, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useUiStore } from '@/stores/ui-store';
import { useComposerStore } from '@/stores/composer-store';
import { useSession } from '@/components/providers/session-provider';
import { useConversation } from '@/features/conversations/hooks';
import { DetailsPanel } from '@/features/conversations/components/details-panel';
import { PinnedPanel } from '@/features/conversations/components/pinned-panel';
import { ConversationSearchPanel } from '@/features/search/components/conversation-search-panel';
import { useConversationChannel } from '@/features/realtime/use-conversation-channel';
import {
  flattenMessages,
  newClientId,
  useMarkRead,
  useMessageActions,
  useMessages,
  useSendMessage,
} from '@/features/messages/hooks';
import { ChatHeader } from '@/features/messages/components/chat-header';
import { Composer } from '@/features/messages/components/composer';
import { ForwardDialog } from '@/features/messages/components/forward-dialog';
import { MessageList } from '@/features/messages/components/message-list';
import { ReactionPickerDialog } from '@/features/messages/components/reaction-picker-dialog';
import { TypingIndicator } from '@/features/messages/components/typing-indicator';
import { playChime } from '@/features/notifications/sound';
import { can } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { MessageSkeleton } from '@/components/ui/skeleton';
import type { MessageDTO } from '@/types/dto';

const PANEL_TITLES = { details: 'Details', pins: 'Pinned', search: 'Search' } as const;

export function ConversationView({ conversationId }: { conversationId: string }) {
  const me = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { rightPanel, setRightPanel, toggleRightPanel } = useUiStore();
  const { setReplyTo, setEditing } = useComposerStore();

  const [highlightId, setHighlightId] = React.useState<string | null>(searchParams.get('m'));
  const [forwardTarget, setForwardTarget] = React.useState<MessageDTO | null>(null);
  const [reactionTarget, setReactionTarget] = React.useState<MessageDTO | null>(null);

  const conversationQuery = useConversation(conversationId);
  const messagesQuery = useMessages(conversationId);
  const send = useSendMessage(conversationId, me);
  const actions = useMessageActions(conversationId);
  const markRead = useMarkRead(conversationId);

  const { typingNames, sendTyping } = useConversationChannel(conversationId, me.id);

  const messages = React.useMemo(
    () => flattenMessages(messagesQuery.data),
    [messagesQuery.data],
  );

  const conversation = conversationQuery.data;
  const lastMessage = messages.at(-1);

  // Mark read whenever the newest message changes and the tab is visible.
  React.useEffect(() => {
    if (!lastMessage || lastMessage.pending || document.visibilityState !== 'visible') return;
    if (conversation && conversation.unreadCount === 0 && lastMessage.author?.id === me.id) return;
    markRead.mutate(lastMessage.id);
    // `markRead` is a stable mutation object; re-running on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessage?.id, conversationId]);

  // Clear the `?m=` deep link once it has been consumed.
  React.useEffect(() => {
    if (!searchParams.get('m')) return;
    const timer = setTimeout(() => {
      router.replace(`/chat/${conversationId}`);
      setHighlightId(null);
    }, 2400);
    return () => clearTimeout(timer);
  }, [searchParams, conversationId, router]);

  useKeyboardShortcuts([
    { key: 'f', meta: true, allowInInput: true, handler: () => toggleRightPanel('search') },
    { key: 'escape', allowInInput: true, handler: () => setRightPanel('none') },
  ]);

  const jumpTo = React.useCallback((messageId: string) => {
    setHighlightId(messageId);
    const element = document.getElementById(`message-${messageId}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => setHighlightId(null), 2400);
  }, []);

  const messageActions = React.useMemo(
    () => ({
      onReply: (message: MessageDTO) => setReplyTo(conversationId, message),
      onEdit: (message: MessageDTO) => setEditing(conversationId, message),
      onDelete: (message: MessageDTO) => actions.destroy.mutate(message.id),
      onReact: (message: MessageDTO, emoji: string) =>
        actions.react.mutate({ id: message.id, emoji }),
      onPin: (message: MessageDTO, pinned: boolean) =>
        actions.pin.mutate({ id: message.id, pinned }),
      onStar: (message: MessageDTO, starred: boolean) =>
        actions.star.mutate({ id: message.id, starred }),
      onForward: (message: MessageDTO) => setForwardTarget(message),
      onOpenEmoji: (message: MessageDTO) => setReactionTarget(message),
      onJumpTo: jumpTo,
    }),
    [conversationId, actions, setReplyTo, setEditing, jumpTo],
  );

  if (conversationQuery.isLoading) {
    return (
      <div className="panel flex h-full flex-col overflow-hidden rounded-[var(--radius-panel)]">
        <div className="h-[57px] border-b border-[var(--hairline)]" />
        <MessageSkeleton />
      </div>
    );
  }

  if (conversationQuery.isError || !conversation) {
    return (
      <div className="panel grid h-full place-items-center rounded-[var(--radius-panel)]">
        <EmptyState
          icon={<Ban />}
          title="You cannot open this conversation"
          description="It may have been deleted, or you are no longer a member."
          action={
            <Button variant="secondary" onClick={() => router.push('/chat')}>
              Back to your chats
            </Button>
          }
        />
      </div>
    );
  }

  const blocked = conversation.blockedByMe || conversation.blockedMe;

  return (
    <div className="relative flex h-full gap-4 lg:gap-6">
      {/*
        The main stage. `pb-28` on the message list reserves the space the
        floating console occupies, so the last message is never hidden behind it.
      */}
      <div className="panel neon-border relative flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-panel)] shadow-[var(--shadow-overlay)]">
        <ChatHeader conversation={conversation} meId={me.id} typingCount={typingNames.length} />

        <MessageList
          floatingComposer
          messages={messages}
          meId={me.id}
          members={conversation.members}
          canModerate={can.moderateMessages(conversation.role)}
          isLoading={messagesQuery.isLoading}
          isFetchingOlder={messagesQuery.isFetchingNextPage}
          hasOlder={Boolean(messagesQuery.hasNextPage)}
          onLoadOlder={() => void messagesQuery.fetchNextPage()}
          actions={messageActions}
          highlightId={highlightId}
          emptyTitle={
            conversation.type === 'DIRECT'
              ? `Say hello to ${conversation.peer?.displayName ?? 'them'}`
              : `${conversation.name} is ready`
          }
          emptyDescription="Messages you send here are delivered instantly to everyone in the conversation."
        />

        {/* Floating console, docked over the thread rather than below it. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-4 pb-4 sm:px-6 sm:pb-5">
          <div className="pointer-events-auto mx-auto w-full max-w-4xl">
            <TypingIndicator names={typingNames} />
            <Composer
              conversationId={conversationId}
              members={conversation.members}
              disabled={blocked}
              disabledReason={
                conversation.blockedByMe
                  ? 'You blocked this person. Unblock them to write again.'
                  : 'You cannot reply to this conversation.'
              }
              onTyping={() => sendTyping(me.displayName)}
              onSend={(payload) => {
                send.mutate({ ...payload, clientId: newClientId() });
                if (me.notifications.sounds) playChime('outgoing');
              }}
              onEditSubmit={(messageId, content) => actions.edit.mutate({ id: messageId, content })}
            />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {rightPanel !== 'none' ? (
          <>
            {/* Below xl there is no room for a third column, so the panel
                becomes an overlay sheet with a dismissable scrim. */}
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRightPanel('none')}
              aria-label="Close panel"
              className="absolute inset-0 z-10 bg-black/40  xl:hidden"
            />
            <motion.aside
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
              className={cn(
                'panel absolute inset-y-0 right-0 z-20 flex w-[min(340px,calc(100%-2rem))] flex-col',
                'overflow-hidden rounded-[var(--radius-panel)] shadow-[var(--shadow-overlay)]',
                'xl:relative xl:w-[340px] xl:shrink-0 xl:shadow-[var(--shadow-raised)]',
              )}
            >
            <header className="flex items-center justify-between border-b border-[var(--hairline)] px-4 py-3">
              <h2 className="flex items-center gap-2 text-[13px] font-semibold">
                {rightPanel === 'details' ? <Info className="size-4" /> : null}
                {rightPanel === 'pins' ? <Pin className="size-4" /> : null}
                {rightPanel === 'search' ? <Search className="size-4" /> : null}
                {PANEL_TITLES[rightPanel]}
              </h2>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => setRightPanel('none')}
                aria-label="Close panel"
              >
                <X />
              </Button>
            </header>

            <div className="scroll-area min-h-0 flex-1 overflow-y-auto">
              {rightPanel === 'details' ? (
                <DetailsPanel conversation={conversation} meId={me.id} />
              ) : null}
              {rightPanel === 'pins' ? (
                <PinnedPanel
                  conversationId={conversationId}
                  onJumpTo={jumpTo}
                  onUnpin={(message) => actions.pin.mutate({ id: message.id, pinned: false })}
                />
              ) : null}
              {rightPanel === 'search' ? (
                <ConversationSearchPanel conversationId={conversationId} onJumpTo={jumpTo} />
              ) : null}
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <ForwardDialog
        message={forwardTarget}
        pending={actions.forward.isPending}
        onClose={() => setForwardTarget(null)}
        onConfirm={(conversationIds) => {
          if (!forwardTarget) return;
          actions.forward.mutate(
            { id: forwardTarget.id, conversationIds },
            { onSuccess: () => setForwardTarget(null) },
          );
        }}
      />

      <ReactionPickerDialog
        open={Boolean(reactionTarget)}
        onOpenChange={(open) => !open && setReactionTarget(null)}
        onSelect={(emoji) => {
          if (reactionTarget) actions.react.mutate({ id: reactionTarget.id, emoji });
          setReactionTarget(null);
        }}
      />
    </div>
  );
}
