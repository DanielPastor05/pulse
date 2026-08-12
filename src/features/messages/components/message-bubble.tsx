'use client';

import * as React from 'react';
import {
  AlertCircle,
  CloudOff,
  Check,
  CheckCheck,
  CornerUpLeft,
  Flag,
  Forward,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Smile,
  Star,
  Trash2,
} from 'lucide-react';

import { QUICK_REACTIONS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { formatBubbleTime, formatFullTimestamp } from '@/lib/date';
import { AttachmentGrid } from '@/features/media/components/attachment-grid';
import { LinkPreviewCard } from '@/features/messages/components/link-preview-card';
import { MessageContent } from '@/features/messages/components/message-content';
import { MessageReactions } from '@/features/messages/components/message-reactions';
import { Avatar } from '@/components/ui/avatar';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from '@/components/ui/menu';
import { Tooltip } from '@/components/ui/tooltip';
import type { MessageDTO } from '@/types/dto';

export type MessageActions = {
  onReply: (message: MessageDTO) => void;
  onEdit: (message: MessageDTO) => void;
  onDelete: (message: MessageDTO) => void;
  onReact: (message: MessageDTO, emoji: string) => void;
  onPin: (message: MessageDTO, pinned: boolean) => void;
  onStar: (message: MessageDTO, starred: boolean) => void;
  onForward: (message: MessageDTO) => void;
  onOpenEmoji: (message: MessageDTO) => void;
  onJumpTo: (messageId: string) => void;
  onRetry: (message: MessageDTO) => void;
  onReport: (message: MessageDTO) => void;
};

type Props = {
  message: MessageDTO;
  mine: boolean;
  /** First bubble of a run by the same author — gets the avatar and header. */
  startsGroup: boolean;
  /** Last bubble of the run — takes the trailing gap. */
  endsGroup: boolean;
  canModerate: boolean;
  readByOthers: boolean;
  highlighted: boolean;
  actions: MessageActions;
};

/**
 * Only ever rendered inside the sender's own bubble. Read is full strength,
 * delivered is faded — tinting "read" with the accent made it invisible.
 */
function StatusTicks({
  message,
  read,
  onRetry,
}: {
  message: MessageDTO;
  read: boolean;
  onRetry: () => void;
}) {
  if (message.failed) {
    // Clickable on purpose: the alternative is retyping the message, and the
    // send is idempotent by clientId so pressing twice cannot double-post.
    return (
      <Tooltip content="Not delivered — tap to retry">
        <button
          type="button"
          onClick={onRetry}
          aria-label="Retry sending this message"
          className="grid place-items-center rounded-full text-[var(--danger)] transition-transform active:scale-95"
        >
          <AlertCircle className="size-3" />
        </button>
      </Tooltip>
    );
  }

  // Distinct from failed: nothing is wrong and there is nothing to press. It
  // goes out on its own when the connection returns.
  if (message.queued) {
    return (
      <Tooltip content="Waiting for a connection — it will send itself">
        <CloudOff className="size-3 opacity-60" />
      </Tooltip>
    );
  }
  if (message.pending) return <Check className="size-3 opacity-45" />;
  return <CheckCheck className={cn('size-3', read ? 'opacity-100' : 'opacity-50')} />;
}

export const MessageBubble = React.memo(function MessageBubble({
  message,
  mine,
  startsGroup,
  endsGroup,
  canModerate,
  readByOthers,
  highlighted,
  actions,
}: Props) {
  const deleted = Boolean(message.deletedAt);

  if (message.kind === 'SYSTEM') {
    return (
      <li className="virtual-row flex justify-center py-1.5">
        <span className="rounded-full bg-[var(--surface-sunken)] px-3 py-1 text-[11.5px] text-[var(--text-3)]">
          {message.content}
        </span>
      </li>
    );
  }

  /**
   * Asymmetric by design: your own messages sit in a glass slab with the top
   * corner cut toward you, while everyone else's run as loose text. It reads as
   * a log you are contributing to rather than two people trading pills.
   */
  const bubbleShape = cn(
    'relative max-w-full text-[14px] leading-relaxed',
    mine
      ? cn(
          'rounded-[var(--radius-card)] border border-[var(--hairline)] bg-[var(--surface-raised)] px-4 py-3 text-left',
          startsGroup && 'rounded-tr-none',
        )
      : 'text-[var(--bubble-in-text)]',
    message.pending && 'opacity-60',
    message.failed && 'border border-[var(--danger)]',
  );

  const metaTone = 'text-[var(--text-3)]';

  // Author names are lit: the accent for you, mint for everyone else.
  const nameTone = mine
    ? 'text-[var(--accent)] glow-text'
    : 'text-[var(--accent-mint)] glow-text-mint';

  const actionItems = (
    <>
      <MenuItem onSelect={() => actions.onReply(message)}>
        <CornerUpLeft />
        Reply
      </MenuItem>
      <MenuItem onSelect={() => actions.onForward(message)}>
        <Forward />
        Forward
      </MenuItem>
      <MenuItem onSelect={() => actions.onStar(message, !message.starred)}>
        <Star />
        {message.starred ? 'Remove star' : 'Star message'}
      </MenuItem>
      <MenuItem onSelect={() => actions.onPin(message, !message.pinnedAt)}>
        {message.pinnedAt ? <PinOff /> : <Pin />}
        {message.pinnedAt ? 'Unpin' : 'Pin to conversation'}
      </MenuItem>
      {mine ? (
        <MenuItem onSelect={() => actions.onEdit(message)}>
          <Pencil />
          Edit
        </MenuItem>
      ) : null}
      {!mine ? (
        <>
          <MenuSeparator />
          <MenuItem onSelect={() => actions.onReport(message)}>
            <Flag />
            Report
          </MenuItem>
        </>
      ) : null}
      {mine || canModerate ? (
        <>
          <MenuSeparator />
          <MenuItem danger onSelect={() => actions.onDelete(message)}>
            <Trash2 />
            Delete
          </MenuItem>
        </>
      ) : null}
    </>
  );

  return (
    <ContextMenu>
      {/*
        A plain <li>. Messages arrive dozens of times an hour, and a spring
        layout animation on every one turns reading a thread into watching the
        list settle. The only motion left is the highlight fade when you jump to
        a message, which explains where you landed.
      */}
      <ContextMenuTrigger asChild>
        <li
          id={`message-${message.id}`}
          className={cn(
            'virtual-row group/message flex gap-4 rounded-[var(--radius-card)] px-3 py-2',
            mine ? 'flex-row-reverse self-end' : 'flex-row',
            startsGroup ? 'mt-5' : 'mt-0.5',
            // Breathing room after the last message of a run, so consecutive
            // speakers read as separate blocks.
            endsGroup && 'mb-1.5',
            'transition-colors duration-300 ease-[var(--ease-out)]',
            'hover:bg-[var(--surface-hover)]',
            highlighted && 'bg-[var(--accent-quiet)]',
          )}
        >
          <div className="w-12 shrink-0">
            {startsGroup ? (
              <Avatar
                src={message.author?.avatarUrl}
                name={message.author?.displayName ?? '?'}
                size="lg"
                ring={mine}
              />
            ) : null}
          </div>

          <div
            className={cn(
              'flex min-w-0 max-w-[min(78%,42rem)] flex-col gap-1.5',
              mine && 'items-end',
            )}
          >
            {startsGroup ? (
              <div className={cn('flex items-baseline gap-3', mine && 'flex-row-reverse')}>
                <span
                  className={cn('cursor-pointer text-[15px] font-bold hover:underline', nameTone)}
                >
                  {message.author?.displayName ?? 'Unknown'}
                </span>
                <Tooltip content={formatFullTimestamp(message.createdAt)}>
                  <time
                    dateTime={message.createdAt}
                    className="font-mono text-[11px] text-[var(--text-3)]"
                  >
                    {formatBubbleTime(message.createdAt)}
                  </time>
                </Tooltip>
              </div>
            ) : null}

            <div className={cn('relative flex items-end gap-1.5', mine && 'flex-row-reverse')}>
              <div className={bubbleShape}>
                {message.forwardedFrom ? (
                  <p className={cn('mb-1 flex items-center gap-1 text-[11px] font-medium', metaTone)}>
                    <Forward className="size-3" />
                    Forwarded from {message.forwardedFrom.authorName}
                  </p>
                ) : null}

                {message.replyTo ? (
                  <button
                    type="button"
                    onClick={() => message.replyTo && actions.onJumpTo(message.replyTo.id)}
                    className={cn(
                      'mb-1.5 flex w-full flex-col items-start gap-0.5 rounded-lg border-l-2 px-2 py-1 text-left',
                      'border-[var(--accent)] bg-[var(--accent-quiet)]',
                    )}
                  >
                    <span className="text-[11px] font-semibold text-[var(--accent)]">
                      {message.replyTo.authorName}
                    </span>
                    <span className="line-clamp-2 text-[12px] text-[var(--text-2)]">
                      {message.replyTo.deleted
                        ? 'Message deleted'
                        : message.replyTo.content ||
                          `${message.replyTo.attachmentCount} attachment${message.replyTo.attachmentCount === 1 ? '' : 's'}`}
                    </span>
                  </button>
                ) : null}

                {deleted ? (
                  <p className="italic text-[var(--text-3)]">This message was deleted</p>
                ) : (
                  <>
                    {message.attachments.length > 0 ? (
                      <div className={cn(message.content && 'mb-2')}>
                        <AttachmentGrid attachments={message.attachments} mine={mine} />
                      </div>
                    ) : null}
                    {message.content ? (
                      <MessageContent content={message.content} className="text-[14px]" />
                    ) : null}
                    {message.linkPreview ? (
                      <LinkPreviewCard preview={message.linkPreview} />
                    ) : null}
                  </>
                )}

                <span
                  className={cn(
                    'mt-0.5 flex items-center justify-end gap-1 text-[10.5px]',
                    metaTone,
                  )}
                >
                  {message.pinnedAt ? <Pin className="size-3" /> : null}
                  {message.starred ? <Star className="size-3 fill-current" /> : null}
                  {message.editedAt ? <span>edited</span> : null}
                  {mine && !deleted ? (
                    <StatusTicks
                      message={message}
                      read={readByOthers}
                      onRetry={() => actions.onRetry(message)}
                    />
                  ) : null}
                </span>
              </div>

              {/* Hover toolbar — hidden until the row is hovered or focused. */}
              {!deleted && !message.pending ? (
                <div
                  className={cn(
                    'flex items-center gap-0.5 rounded-full p-0.5',
                    'surface-overlay border border-[var(--hairline)] shadow-[var(--shadow-raised)]',
                    'opacity-0 transition-opacity duration-150',
                    'group-hover/message:opacity-100 focus-within:opacity-100',
                  )}
                >
                  {QUICK_REACTIONS.slice(0, 3).map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => actions.onReact(message, emoji)}
                      className="grid size-7 place-items-center rounded-full text-[14px] transition-transform hover:scale-125 active:scale-95"
                      aria-label={`React with ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => actions.onOpenEmoji(message)}
                    className="grid size-7 place-items-center rounded-full text-[var(--text-3)] transition-colors hover:text-[var(--text-1)]"
                    aria-label="More reactions"
                  >
                    <Smile className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => actions.onReply(message)}
                    className="grid size-7 place-items-center rounded-full text-[var(--text-3)] transition-colors hover:text-[var(--text-1)]"
                    aria-label="Reply"
                  >
                    <CornerUpLeft className="size-4" />
                  </button>
                  <Menu>
                    <MenuTrigger asChild>
                      <button
                        type="button"
                        className="grid size-7 place-items-center rounded-full text-[var(--text-3)] transition-colors hover:text-[var(--text-1)]"
                        aria-label="More actions"
                      >
                        <MoreHorizontal className="size-4" />
                      </button>
                    </MenuTrigger>
                    <MenuContent align={mine ? 'end' : 'start'}>{actionItems}</MenuContent>
                  </Menu>
                </div>
              ) : null}
            </div>

            {!deleted ? (
              <MessageReactions
                reactions={message.reactions}
                align={mine ? 'end' : 'start'}
                onToggle={(emoji) => actions.onReact(message, emoji)}
              />
            ) : null}
          </div>
        </li>
      </ContextMenuTrigger>

      <ContextMenuContent>
        <div className="flex gap-0.5 p-1">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => actions.onReact(message, emoji)}
              className="grid size-8 place-items-center rounded-lg text-[16px] transition-transform hover:scale-125 hover:bg-[var(--surface-hover)]"
            >
              {emoji}
            </button>
          ))}
        </div>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => actions.onReply(message)}>
          <CornerUpLeft />
          Reply
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => actions.onForward(message)}>
          <Forward />
          Forward
        </ContextMenuItem>
        {!mine ? (
          <ContextMenuItem onSelect={() => actions.onReport(message)}>
            <Flag />
            Report
          </ContextMenuItem>
        ) : null}
        <ContextMenuItem onSelect={() => actions.onStar(message, !message.starred)}>
          <Star />
          {message.starred ? 'Remove star' : 'Star message'}
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => actions.onPin(message, !message.pinnedAt)}>
          {message.pinnedAt ? <PinOff /> : <Pin />}
          {message.pinnedAt ? 'Unpin' : 'Pin to conversation'}
        </ContextMenuItem>
        {mine ? (
          <ContextMenuItem onSelect={() => actions.onEdit(message)}>
            <Pencil />
            Edit
          </ContextMenuItem>
        ) : null}
        {mine || canModerate ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem danger onSelect={() => actions.onDelete(message)}>
              <Trash2 />
              Delete
            </ContextMenuItem>
          </>
        ) : null}
      </ContextMenuContent>
    </ContextMenu>
  );
});
