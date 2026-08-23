'use client';

import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, FileText, Film, Loader2, Mic, Music, X } from 'lucide-react';

import { cn, formatBytes } from '@/lib/utils';
import type { UploadedFile } from '@/features/media/upload';
import { useT } from '@/i18n/provider';

export type PendingAttachment = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  /** Object URL for local preview; revoked when the entry is removed. */
  preview: string | null;
  status: 'uploading' | 'ready' | 'error';
  uploaded?: UploadedFile;
  error?: string;
};

function iconFor(mimeType: string, isVoice: boolean) {
  if (isVoice) return Mic;
  if (mimeType.startsWith('video/')) return Film;
  if (mimeType.startsWith('audio/')) return Music;
  return FileText;
}

export function AttachmentTray({
  items,
  onRemove,
}: {
  items: PendingAttachment[];
  onRemove: (id: string) => void;
}) {
  const t = useT();
  if (items.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <ul className="scroll-area flex gap-2 overflow-x-auto pb-2 pt-1">
        <AnimatePresence initial={false}>
          {items.map((item) => {
            const isImage = item.mimeType.startsWith('image/');
            const isVoice =
              item.uploaded?.kind === 'VOICE' || item.mimeType.startsWith('audio/webm');
            const Icon = iconFor(item.mimeType, isVoice);

            return (
              <motion.li
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 460, damping: 32 }}
                className={cn(
                  'group relative flex shrink-0 items-center gap-2 rounded-[var(--radius-card)] p-2',
                  'border border-[var(--hairline)] bg-[var(--surface-sunken)]',
                  item.status === 'error' && 'border-[var(--danger)]',
                )}
              >
                <div className="relative size-11 shrink-0 overflow-hidden rounded-[var(--radius-field)] bg-[var(--surface-sunken)]">
                  {isImage && item.preview ? (
                    <Image
                      src={item.preview}
                      alt=""
                      fill
                      sizes="44px"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="grid size-full place-items-center text-[var(--accent)]">
                      <Icon className="size-5" />
                    </span>
                  )}

                  {item.status === 'uploading' ? (
                    <span className="absolute inset-0 grid place-items-center bg-black/45">
                      <Loader2 className="size-4 animate-spin text-white" />
                    </span>
                  ) : null}
                  {item.status === 'error' ? (
                    <span className="absolute inset-0 grid place-items-center bg-black/45">
                      <AlertCircle className="size-4 text-white" />
                    </span>
                  ) : null}
                </div>

                <div className="min-w-0 max-w-[9rem] pr-4">
                  <p className="truncate text-[12px] font-medium">{item.name}</p>
                  <p className="text-[11px] text-[var(--text-3)]">
                    {item.status === 'error' ? (item.error ?? t.composer.uploadFailed) : formatBytes(item.size)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  className={cn(
                    'absolute right-1 top-1 grid size-5 place-items-center rounded-full',
                    'bg-[var(--surface-solid)] text-[var(--text-3)] shadow-sm',
                    'transition-colors hover:text-[var(--danger)]',
                  )}
                  aria-label={t.common.removeNamed(item.name)}
                >
                  <X className="size-3" />
                </button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </motion.div>
  );
}
