'use client';

import { cn } from '@/lib/utils';
import type { LinkPreviewDTO } from '@/types/dto';

/**
 * The card under a shared link.
 *
 * The image is a plain `<img>`: these come from arbitrary origins that cannot
 * be listed in `next.config.ts` ahead of time, so the optimiser is no help
 * here. It is lazy and size-capped instead.
 */
export function LinkPreviewCard({ preview }: { preview: LinkPreviewDTO }) {
  let host: string;
  try {
    host = new URL(preview.url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className={cn(
        'mt-2 flex max-w-md overflow-hidden rounded-[var(--radius-field)]',
        'border border-[var(--hairline)] bg-[var(--surface-sunken)]',
        'transition-colors hover:border-[var(--accent)]',
      )}
    >
      {preview.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview.imageUrl}
          alt=""
          loading="lazy"
          className="size-20 shrink-0 object-cover"
        />
      ) : null}

      <div className="min-w-0 flex-1 p-3">
        <p className="truncate text-[11px] uppercase tracking-wide text-[var(--text-3)]">
          {preview.siteName ?? host}
        </p>
        {preview.title ? (
          <p className="mt-0.5 truncate text-[13px] font-medium text-[var(--text-1)]">
            {preview.title}
          </p>
        ) : null}
        {preview.description ? (
          <p className="mt-0.5 line-clamp-2 text-[12px] text-[var(--text-2)]">
            {preview.description}
          </p>
        ) : null}
      </div>
    </a>
  );
}
