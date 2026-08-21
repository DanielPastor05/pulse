'use client';

import * as React from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { FileText, Images, Loader2 } from 'lucide-react';

import { api } from '@/lib/api-client';
import { cn, formatBytes } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';
import type { GalleryItem, Paginated } from '@/types/dto';
import { useT } from '@/i18n/provider';

type Tab = 'media' | 'files';

function useGallery(conversationId: string, tab: Tab) {
  return useInfiniteQuery({
    queryKey: ['gallery', conversationId, tab],
    queryFn: ({ pageParam }) =>
      api<Paginated<GalleryItem>>(`/conversations/${conversationId}/gallery`, {
        query: { tab, cursor: pageParam },
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/**
 * Everything shared in a conversation, as a grid.
 *
 * Search already finds a file if you can name it. This is for the other case,
 * which is most of them: you know you saw a photo and you would recognise it.
 */
export function GalleryPanel({
  conversationId,
  onJumpTo,
}: {
  conversationId: string;
  onJumpTo: (messageId: string) => void;
}) {
  const t = useT();
  const [tab, setTab] = React.useState<Tab>('media');
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useGallery(
    conversationId,
    tab,
  );

  const items = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-1 border-b border-[var(--hairline)] px-3 py-2">
        {(['media', 'files'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              'rounded-[var(--radius-control)] px-2.5 py-1 text-[12px] transition-colors',
              tab === value
                ? 'bg-[var(--surface-sunken)] text-[var(--text-1)]'
                : 'text-[var(--text-3)] hover:text-[var(--text-1)]',
            )}
            aria-pressed={tab === value}
          >
            {value === 'media' ? 'Photos & video' : 'Files'}
          </button>
        ))}
      </div>

      <div className="scroll-area min-h-0 flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="grid place-items-center py-8">
            <Loader2 className="size-4 animate-spin text-[var(--text-3)]" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={tab === 'media' ? <Images /> : <FileText />}
            title={tab === 'media' ? t.message.noPhotos : t.message.noFiles}
            description={t.message.noFilesHint}
          />
        ) : tab === 'media' ? (
          <div className="grid grid-cols-3 gap-1.5">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onJumpTo(item.messageId)}
                className="group relative aspect-square overflow-hidden rounded-[var(--radius-field)] bg-[var(--surface-sunken)]"
                aria-label={`Go to ${item.name}`}
              >
                {item.kind === 'IMAGE' ? (
                  // Arbitrary storage origins and a thumbnail grid: the raw tag
                  // with lazy loading beats routing every one through the
                  // optimiser.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.url}
                    alt={item.name}
                    loading="lazy"
                    className="size-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <video src={item.url} muted playsInline className="size-full object-cover" />
                )}
              </button>
            ))}
          </div>
        ) : (
          <ul className="space-y-1">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onJumpTo(item.messageId)}
                  className="flex w-full items-center gap-2.5 rounded-[var(--radius-field)] p-2 text-left hover:bg-[var(--surface-sunken)]"
                >
                  <FileText className="size-4 shrink-0 text-[var(--text-3)]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px]">{item.name}</span>
                    <span className="block truncate text-[11px] text-[var(--text-3)]">
                      {formatBytes(item.size)}
                      {item.author ? ` · ${item.author.displayName}` : ''}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {hasNextPage ? (
          <button
            type="button"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
            className="mt-3 w-full rounded-[var(--radius-field)] py-2 text-[12px] text-[var(--text-3)] hover:bg-[var(--surface-sunken)]"
          >
            {isFetchingNextPage ? t.common.loading : t.search.loadMore}
          </button>
        ) : null}
      </div>
    </div>
  );
}
