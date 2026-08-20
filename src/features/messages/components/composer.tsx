'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Camera,
  CornerUpLeft,
  BarChart3,
  Image as ImageIcon,
  Mic,
  Paperclip,
  Pencil,
  SendHorizonal,
  Smile,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { MAX_ATTACHMENTS_PER_MESSAGE, MAX_MESSAGE_LENGTH } from '@/lib/constants';
import { cn, randomId } from '@/lib/utils';
import { api } from '@/lib/api-client';
import { uploadFile, type UploadedFile } from '@/features/media/upload';
import { VoiceRecorder } from '@/features/media/components/voice-recorder';
import { AttachmentTray, type PendingAttachment } from '@/features/messages/components/attachment-tray';
import { EmojiPicker } from '@/features/messages/components/emoji-picker';
import { GifPicker } from '@/features/messages/components/gif-picker';
import { PollDialog } from '@/features/messages/components/poll-dialog';
import { MentionSuggestions } from '@/features/messages/components/mention-suggestions';
import { useComposerStore } from '@/stores/composer-store';
import { useT } from '@/i18n/provider';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import type { AttachmentInput } from '@/features/messages/validators';
import type { MemberDTO } from '@/types/dto';

const MAX_ROWS_HEIGHT = 168;

type Props = {
  conversationId: string;
  members: MemberDTO[];
  disabled?: boolean;
  disabledReason?: string;
  onSend: (payload: { content: string; attachments: AttachmentInput[]; replyToId: string | null }) => void;
  onEditSubmit: (messageId: string, content: string) => void;
  onTyping: () => void;
};

export function Composer({
  conversationId,
  members,
  disabled,
  disabledReason,
  onSend,
  onEditSubmit,
  onTyping,
}: Props) {
  const t = useT();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);

  const {
    drafts,
    setDraft,
    clearDraft,
    replyTo,
    setReplyTo,
    editing,
    setEditing,
    setEditingContent,
  } = useComposerStore();

  const draft = drafts[conversationId] ?? '';
  const reply = replyTo[conversationId];
  const edit = editing[conversationId];

  const [attachments, setAttachments] = React.useState<PendingAttachment[]>([]);
  const [dragging, setDragging] = React.useState(false);
  const [recording, setRecording] = React.useState(false);
  const [emojiOpen, setEmojiOpen] = React.useState(false);
  const [gifOpen, setGifOpen] = React.useState(false);
  const [pollOpen, setPollOpen] = React.useState(false);
  const [mentionQuery, setMentionQuery] = React.useState<string | null>(null);

  const value = edit ? edit.content : draft;

  // Grow the textarea with its content, capped so the thread stays visible.
  const resize = React.useCallback(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, MAX_ROWS_HEIGHT)}px`;
  }, []);

  React.useEffect(resize, [value, resize]);

  React.useEffect(() => {
    if (edit || reply) textareaRef.current?.focus();
  }, [edit, reply]);

  // Persist the draft server-side (debounced) so it follows you across devices.
  React.useEffect(() => {
    if (edit) return;
    const timer = setTimeout(() => {
      void api(`/conversations/${conversationId}/preferences`, {
        method: 'PATCH',
        body: { draft: draft.trim() ? draft : null },
      }).catch(() => undefined);
    }, 900);
    return () => clearTimeout(timer);
  }, [draft, conversationId, edit]);

  const setValue = (next: string) => {
    if (edit) setEditingContent(conversationId, next);
    else setDraft(conversationId, next);
  };

  const updateMentionQuery = (text: string, caret: number) => {
    const before = text.slice(0, caret);
    const match = /(?:^|\s)@([a-z0-9_]{0,24})$/i.exec(before);
    setMentionQuery(match ? (match[1] ?? '') : null);
  };

  const insertAtCaret = (insertion: string) => {
    const element = textareaRef.current;
    const start = element?.selectionStart ?? value.length;
    const end = element?.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}${insertion}${value.slice(end)}`;
    setValue(next);
    requestAnimationFrame(() => {
      element?.focus();
      const caret = start + insertion.length;
      element?.setSelectionRange(caret, caret);
    });
  };

  const applyMention = (username: string) => {
    const element = textareaRef.current;
    const caret = element?.selectionStart ?? value.length;
    const before = value.slice(0, caret).replace(/@([a-z0-9_]{0,24})$/i, `@${username} `);
    const next = `${before}${value.slice(caret)}`;
    setValue(next);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(before.length, before.length);
    });
  };

  const addFiles = React.useCallback(
    async (files: File[], options: { isVoiceNote?: boolean; duration?: number; waveform?: number[] } = {}) => {
      const room = MAX_ATTACHMENTS_PER_MESSAGE - attachments.length;
      if (room <= 0) {
        toast.error(t.composer.tooMany(MAX_ATTACHMENTS_PER_MESSAGE));
        return;
      }

      const accepted = files.slice(0, room);

      const entries: PendingAttachment[] = accepted.map((file) => ({
        id: randomId(8),
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
        status: 'uploading',
      }));

      setAttachments((current) => [...current, ...entries]);

      await Promise.all(
        accepted.map(async (file, index) => {
          const entry = entries[index];
          if (!entry) return;
          try {
            const uploaded = await uploadFile(file, options);
            setAttachments((current) =>
              current.map((item) =>
                item.id === entry.id ? { ...item, status: 'ready', uploaded } : item,
              ),
            );
          } catch (error) {
            setAttachments((current) =>
              current.map((item) =>
                item.id === entry.id
                  ? {
                      ...item,
                      status: 'error',
                      error: error instanceof Error ? error.message : t.composer.uploadFailed,
                    }
                  : item,
              ),
            );
          }
        }),
      );
    },
    [attachments.length, t.composer],
  );

  const removeAttachment = (id: string) => {
    setAttachments((current) => {
      const target = current.find((item) => item.id === id);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return current.filter((item) => item.id !== id);
    });
  };

  const ready = attachments.filter((item) => item.status === 'ready');
  const uploading = attachments.some((item) => item.status === 'uploading');
  const canSend = !disabled && !uploading && (value.trim().length > 0 || ready.length > 0);

  const submit = () => {
    if (edit) {
      const content = value.trim();
      if (!content) return;
      onEditSubmit(edit.id, content);
      setEditing(conversationId, null);
      return;
    }

    if (!canSend) return;

    const payloadAttachments: AttachmentInput[] = ready
      .map((item) => item.uploaded)
      .filter((file): file is UploadedFile => Boolean(file))
      .map((file) => ({
        kind: file.kind,
        url: file.url,
        path: file.path,
        name: file.name,
        size: file.size,
        mimeType: file.mimeType,
        width: file.width,
        height: file.height,
        duration: file.duration,
        waveform: file.waveform,
      }));

    onSend({
      content: value.trim(),
      attachments: payloadAttachments,
      replyToId: reply?.id ?? null,
    });

    for (const item of attachments) if (item.preview) URL.revokeObjectURL(item.preview);
    setAttachments([]);
    clearDraft(conversationId);
    setReplyTo(conversationId, null);
    setMentionQuery(null);
    requestAnimationFrame(resize);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && ['ArrowUp', 'ArrowDown', 'Enter', 'Tab'].includes(event.key)) {
      return; // Handled by the suggestion list.
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
      return;
    }
    if (event.key === 'Escape') {
      if (edit) setEditing(conversationId, null);
      else if (reply) setReplyTo(conversationId, null);
      return;
    }
    onTyping();
  };

  const banner = edit ?? reply;

  return (
    <div
      className={cn('relative px-3 pb-3 sm:px-5 sm:pb-4', dragging && 'ring-2 ring-[var(--accent)]')}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return;
        setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const files = Array.from(event.dataTransfer.files);
        if (files.length > 0) void addFiles(files);
      }}
    >
      <AnimatePresence>
        {dragging ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-2 z-10 grid place-items-center rounded-[var(--radius-card)] border-2 border-dashed border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] "
          >
            <p className="text-[13px] font-medium text-[var(--accent)]">{t.composer.dropToAttach}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="panel relative rounded-[var(--radius-card)] p-2 shadow-[var(--shadow-raised)]">
        <AnimatePresence initial={false}>
          {banner ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mb-1 flex items-start gap-2.5 rounded-[var(--radius-field)] border-l-2 border-[var(--accent)] bg-[var(--surface-sunken)] px-3 py-2">
                <span className="mt-0.5 text-[var(--accent)]">
                  {edit ? <Pencil className="size-3.5" /> : <CornerUpLeft className="size-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-[var(--accent)]">
                    {edit ? t.composer.editing : t.composer.replyingTo(reply?.authorName ?? '')}
                  </p>
                  <p className="truncate text-[12px] text-[var(--text-2)]">
                    {edit ? edit.content : reply?.content || t.composer.attachment}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (edit) setEditing(conversationId, null);
                    else setReplyTo(conversationId, null);
                  }}
                  className="grid size-6 shrink-0 place-items-center rounded-lg text-[var(--text-3)] hover:bg-[var(--hairline)] hover:text-[var(--text-1)]"
                  aria-label={t.common.cancel}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {attachments.length > 0 ? (
            <AttachmentTray items={attachments} onRemove={removeAttachment} />
          ) : null}
        </AnimatePresence>

        {recording ? (
          <VoiceRecorder
            onCancel={() => setRecording(false)}
            onComplete={({ blob, duration, waveform }) => {
              setRecording(false);
              const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type });
              void addFiles([file], { isVoiceNote: true, duration, waveform });
            }}
          />
        ) : (
          <div className="flex items-end gap-1.5">
            <div className="flex items-center gap-0.5 pb-1">
              <Tooltip content={t.composer.attach}>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled}
                  aria-label={t.composer.attach}
                >
                  <Paperclip />
                </Button>
              </Tooltip>

              <Tooltip content={t.composer.photo}>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="hidden sm:inline-flex"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={disabled}
                  aria-label={t.composer.photo}
                >
                  <Camera />
                </Button>
              </Tooltip>

              <GifPicker
                open={gifOpen}
                onOpenChange={setGifOpen}
                onSelect={(gif) => {
                  insertAtCaret(`![${gif.description}](${gif.url})`);
                }}
              >
                <Button size="icon-sm" variant="ghost" disabled={disabled} aria-label={t.composer.gif}>
                  <ImageIcon />
                </Button>
              </GifPicker>

              <Button
                size="icon-sm"
                variant="ghost"
                disabled={disabled}
                onClick={() => setPollOpen(true)}
                aria-label={t.composer.poll}
              >
                <BarChart3 />
              </Button>
            </div>

            <div className="relative flex-1">
              {mentionQuery !== null ? (
                <MentionSuggestions
                  members={members}
                  query={mentionQuery}
                  onSelect={applyMention}
                  onDismiss={() => setMentionQuery(null)}
                />
              ) : null}

              <textarea
                ref={textareaRef}
                value={value}
                rows={1}
                maxLength={MAX_MESSAGE_LENGTH}
                disabled={disabled}
                placeholder={disabled ? (disabledReason ?? t.composer.cannotPost) : t.composer.placeholder}
                aria-label={t.composer.messageLabel}
                onChange={(event) => {
                  setValue(event.target.value);
                  updateMentionQuery(event.target.value, event.target.selectionStart);
                }}
                onKeyDown={onKeyDown}
                onPaste={(event) => {
                  const files = Array.from(event.clipboardData.files);
                  if (files.length > 0) {
                    event.preventDefault();
                    void addFiles(files);
                  }
                }}
                className={cn(
                  'scroll-area w-full resize-none bg-transparent px-1 py-2 text-[14px] leading-relaxed',
                  'text-[var(--text-1)] outline-none placeholder:text-[var(--text-3)]',
                  'disabled:cursor-not-allowed disabled:opacity-60',
                )}
                style={{ maxHeight: MAX_ROWS_HEIGHT }}
              />
            </div>

            <div className="flex items-center gap-0.5 pb-1">
              <EmojiPicker
                open={emojiOpen}
                onOpenChange={setEmojiOpen}
                onSelect={(emoji) => insertAtCaret(emoji)}
              >
                <Button size="icon-sm" variant="ghost" disabled={disabled} aria-label={t.composer.emoji}>
                  <Smile />
                </Button>
              </EmojiPicker>

              {canSend || edit ? (
                <Button
                  size="icon-sm"
                  onClick={submit}
                  disabled={!canSend && !edit}
                  loading={uploading}
                  aria-label={edit ? t.composer.saveChanges : t.composer.sendMessage}
                >
                  <SendHorizonal />
                </Button>
              ) : (
                <Tooltip content={t.composer.voice}>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => setRecording(true)}
                    disabled={disabled}
                    aria-label={t.composer.voice}
                  >
                    <Mic />
                  </Button>
                </Tooltip>
              )}
            </div>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="sr-only"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length > 0) void addFiles(files);
          event.target.value = '';
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length > 0) void addFiles(files);
          event.target.value = '';
        }}
      />

      <PollDialog
        conversationId={conversationId}
        open={pollOpen}
        onOpenChange={setPollOpen}
      />
    </div>
  );
}
