'use client';

import * as React from 'react';
import Image from 'next/image';
import { Download, FileArchive, FileText, FileType, Film, Music, X } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';

import { cn, formatBytes } from '@/lib/utils';
import { VoicePlayer } from '@/features/media/components/voice-player';
import { Button } from '@/components/ui/button';
import type { AttachmentDTO } from '@/types/dto';
import { useT } from '@/i18n/provider';

function documentIcon(mimeType: string) {
  if (mimeType.includes('pdf')) return FileType;
  if (mimeType.includes('zip') || mimeType.includes('compressed')) return FileArchive;
  if (mimeType.startsWith('audio/')) return Music;
  if (mimeType.startsWith('video/')) return Film;
  return FileText;
}

function Lightbox({
  attachments,
  index,
  onClose,
}: {
  attachments: AttachmentDTO[];
  index: number;
  onClose: () => void;
}) {
  const t = useT();
  const attachment = attachments[index];
  if (!attachment) return null;

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="anim-overlay fixed inset-0 z-50 bg-black/85 backdrop-blur-md" />
        <DialogPrimitive.Content className="anim-modal fixed left-1/2 top-1/2 z-50 max-h-[92dvh] max-w-[92vw] outline-none">
          <DialogPrimitive.Title className="sr-only">{attachment.name}</DialogPrimitive.Title>

          {attachment.kind === 'VIDEO' ? (
            <video
              src={attachment.url}
              controls
              autoPlay
              className="max-h-[86dvh] max-w-[92vw] rounded-[var(--radius-card)]"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={attachment.url}
              alt={attachment.name}
              className="max-h-[86dvh] max-w-[92vw] rounded-[var(--radius-card)] object-contain"
            />
          )}

          <div className="mt-3 flex items-center justify-between gap-4 text-white">
            <p className="truncate text-[13px]">
              {attachment.name} · {formatBytes(attachment.size)}
            </p>
            <div className="flex items-center gap-2">
              <Button asChild size="sm" variant="secondary">
                <a href={attachment.url} download={attachment.name} target="_blank" rel="noreferrer">
                  <Download />
                  {t.message.download}
                </a>
              </Button>
              <DialogPrimitive.Close asChild>
                <Button size="icon-sm" variant="secondary" aria-label={t.common.close}>
                  <X />
                </Button>
              </DialogPrimitive.Close>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function AttachmentGrid({
  attachments,
  mine,
}: {
  attachments: AttachmentDTO[];
  mine: boolean;
}) {
  const [lightbox, setLightbox] = React.useState<number | null>(null);

  const visual = attachments.filter((item) => item.kind === 'IMAGE' || item.kind === 'VIDEO');
  const voice = attachments.filter((item) => item.kind === 'VOICE');
  const others = attachments.filter(
    (item) => item.kind === 'DOCUMENT' || item.kind === 'AUDIO',
  );

  return (
    <div className="space-y-2">
      {visual.length > 0 ? (
        <div
          className={cn(
            'grid gap-1.5 overflow-hidden rounded-[var(--radius-card)]',
            visual.length === 1 ? 'grid-cols-1' : 'grid-cols-2',
          )}
        >
          {visual.map((attachment, index) => {
            const ratio =
              attachment.width && attachment.height ? attachment.width / attachment.height : 4 / 3;

            return (
              <button
                key={attachment.id}
                type="button"
                onClick={() => setLightbox(index)}
                className={cn(
                  'group relative overflow-hidden bg-[var(--surface-sunken)]',
                  visual.length === 1 ? 'rounded-[var(--radius-card)]' : 'aspect-square rounded-[var(--radius-field)]',
                  visual.length === 3 && index === 0 && 'col-span-2',
                )}
                style={
                  visual.length === 1
                    ? { aspectRatio: Math.max(0.6, Math.min(ratio, 1.9)) }
                    : undefined
                }
              >
                {attachment.kind === 'VIDEO' ? (
                  <>
                    <video
                      src={attachment.url}
                      preload="metadata"
                      className="size-full object-cover"
                      muted
                    />
                    <span className="absolute inset-0 grid place-items-center bg-black/25">
                      <Film className="size-7 text-white drop-shadow" />
                    </span>
                  </>
                ) : (
                  <Image
                    src={attachment.url}
                    alt={attachment.name}
                    fill
                    sizes="(max-width: 768px) 80vw, 380px"
                    className="object-cover transition-transform duration-500 ease-[var(--ease-out)] group-hover:scale-[1.04]"
                  />
                )}
              </button>
            );
          })}
        </div>
      ) : null}

      {voice.map((attachment) => (
        <VoicePlayer key={attachment.id} attachment={attachment} mine={mine} />
      ))}

      {others.map((attachment) => {
        const Icon = documentIcon(attachment.mimeType);
        return (
          <a
            key={attachment.id}
            href={attachment.url}
            download={attachment.name}
            target="_blank"
            rel="noreferrer"
            className={cn(
              'flex items-center gap-3 rounded-[var(--radius-card)] p-2.5 transition-colors duration-150',
              mine
                ? 'bg-white/15 hover:bg-white/25'
                : 'bg-[var(--surface-sunken)] hover:bg-[var(--hairline)]',
            )}
          >
            <span
              className={cn(
                'grid size-10 shrink-0 place-items-center rounded-[var(--radius-field)]',
                mine ? 'bg-white/20 text-white' : 'bg-[var(--surface)] text-[var(--accent)]',
              )}
            >
              <Icon className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">{attachment.name}</span>
              <span className={cn('block text-[11px]', mine ? 'text-white/70' : 'text-[var(--text-3)]')}>
                {formatBytes(attachment.size)}
              </span>
            </span>
            <Download className={cn('size-4 shrink-0', mine ? 'text-white/70' : 'text-[var(--text-3)]')} />
          </a>
        );
      })}

      {lightbox !== null ? (
        <Lightbox attachments={visual} index={lightbox} onClose={() => setLightbox(null)} />
      ) : null}
    </div>
  );
}
