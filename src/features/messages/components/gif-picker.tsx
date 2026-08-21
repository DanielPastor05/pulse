'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ImageOff, Search } from 'lucide-react';

import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import type { GifResult } from '@/app/api/gifs/route';
import { useT } from '@/i18n/provider';

type Props = {
  onSelect: (gif: GifResult) => void;
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function GifPicker({ onSelect, children, open, onOpenChange }: Props) {
  const t = useT();
  const [term, setTerm] = React.useState('');
  const query = useDebouncedValue(term.trim(), 280);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.gifs(query),
    queryFn: () => api<{ configured: boolean; gifs: GifResult[] }>('/gifs', { query: { q: query } }),
    enabled: open !== false,
    staleTime: 5 * 60_000,
  });

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-[21rem] p-2">
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={t.message.searchGifs}
          icon={<Search />}
          className="h-10 text-[13px]"
          autoFocus
        />

        <div className="scroll-area mt-2 h-72 overflow-y-auto">
          {data && !data.configured ? (
            <EmptyState
              compact
              icon={<ImageOff />}
              title={t.message.gifsOff}
              description={t.message.gifsOffHint}
            />
          ) : isLoading ? (
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="aspect-video rounded-[var(--radius-field)]" />
              ))}
            </div>
          ) : (data?.gifs.length ?? 0) === 0 ? (
            <EmptyState compact icon={<ImageOff />} title={t.message.noGifs} />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {data?.gifs.map((gif) => (
                <button
                  key={gif.id}
                  type="button"
                  onClick={() => {
                    onSelect(gif);
                    onOpenChange?.(false);
                  }}
                  className="overflow-hidden rounded-[var(--radius-field)] bg-[var(--surface-sunken)] transition-transform hover:scale-[1.03] active:scale-95"
                >
                  {/* Remote GIFs vary wildly in size; the raw tag keeps them animated. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={gif.previewUrl}
                    alt={gif.description}
                    loading="lazy"
                    className="aspect-video w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
