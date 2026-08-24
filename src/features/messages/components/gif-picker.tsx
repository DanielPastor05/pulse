'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ImageOff, Search } from 'lucide-react';

import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/lib/query-keys';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import type { GifKind, GifResult } from '@/app/api/gifs/route';
import { useLocale, useT } from '@/i18n/provider';

type Props = {
  onSelect: (gif: GifResult, kind: GifKind) => void;
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/**
 * GIF y stickers, en el mismo sitio y con pestañas.
 *
 * Dos catálogos y un solo componente porque de un catálogo al otro sólo cambian
 * la consulta y la forma de la celda: los GIF son apaisados y se recortan, los
 * stickers son cuadrados, transparentes y **no** se recortan —un sticker
 * recortado deja de ser el dibujo que alguien eligió—.
 *
 * El término de búsqueda se conserva al cambiar de pestaña. Buscar «gato» en
 * GIF y querer verlo en stickers es lo normal, y obligar a reescribirlo sería
 * castigar justo el caso corriente.
 */
export function GifPicker({ onSelect, children, open, onOpenChange }: Props) {
  const t = useT();
  const locale = useLocale();
  const [kind, setKind] = React.useState<GifKind>('gif');
  const [term, setTerm] = React.useState('');
  const query = useDebouncedValue(term.trim(), 280);

  // El idioma viaja con la búsqueda: quien escribe «cumpleaños» quiere lo que
  // GIPHY tiene etiquetado en español, no la traducción aproximada de su propio
  // término. Es gratis —un parámetro— y es justo la clase de detalle que se
  // olvida en una aplicación bilingüe.
  const lang = locale === 'ES' ? 'es' : 'en';

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.gifs(query, `${kind}:${lang}`),
    queryFn: () =>
      api<{ configured: boolean; gifs: GifResult[] }>('/gifs', { query: { q: query, kind, lang } }),
    enabled: open !== false,
    staleTime: 5 * 60_000,
  });

  const esSticker = kind === 'sticker';
  const PESTAÑAS: Array<[GifKind, string]> = [
    ['gif', t.message.gifsTab],
    ['sticker', t.message.stickersTab],
  ];

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-[21rem] p-2">
        <div className="mb-2 flex gap-1" role="tablist">
          {PESTAÑAS.map(([valor, etiqueta]) => (
            <button
              key={valor}
              type="button"
              role="tab"
              aria-selected={kind === valor}
              onClick={() => setKind(valor)}
              className={cn(
                'flex-1 rounded-[var(--radius-field)] px-3 py-1.5 text-[12.5px] font-medium transition-colors',
                kind === valor
                  ? 'bg-[var(--surface-active)] text-[var(--text-1)]'
                  : 'text-[var(--text-2)] hover:bg-[var(--surface-hover)]',
              )}
            >
              {etiqueta}
            </button>
          ))}
        </div>

        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={esSticker ? t.message.searchStickers : t.message.searchGifs}
          icon={<Search />}
          className="h-10 text-[13px]"
          autoFocus
        />

        <div className="scroll-area mt-2 h-72 overflow-y-auto">
          {data && !data.configured ? (
            <EmptyState
              compact
              icon={<ImageOff />}
              title={esSticker ? t.message.stickersOff : t.message.gifsOff}
              description={t.message.gifsOffHint}
            />
          ) : isLoading ? (
            <div className={cn('grid gap-2', esSticker ? 'grid-cols-3' : 'grid-cols-2')}>
              {Array.from({ length: esSticker ? 9 : 6 }).map((_, index) => (
                <Skeleton
                  key={index}
                  className={cn(
                    'rounded-[var(--radius-field)]',
                    esSticker ? 'aspect-square' : 'aspect-video',
                  )}
                />
              ))}
            </div>
          ) : (data?.gifs.length ?? 0) === 0 ? (
            <EmptyState
              compact
              icon={<ImageOff />}
              title={esSticker ? t.message.noStickers : t.message.noGifs}
            />
          ) : (
            <div className={cn('grid gap-2', esSticker ? 'grid-cols-3' : 'grid-cols-2')}>
              {data?.gifs.map((gif) => (
                <button
                  key={gif.id}
                  type="button"
                  onClick={() => {
                    onSelect(gif, kind);
                    onOpenChange?.(false);
                  }}
                  className={cn(
                    'overflow-hidden rounded-[var(--radius-field)] transition-transform hover:scale-[1.03] active:scale-95',
                    // Los stickers van sin fondo: ponérselo anularía la
                    // transparencia que es justo lo que los distingue.
                    esSticker ? 'p-1' : 'bg-[var(--surface-sunken)]',
                  )}
                >
                  {/* Remote GIFs vary wildly in size; the raw tag keeps them animated. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={gif.previewUrl}
                    alt={gif.description}
                    loading="lazy"
                    className={cn(
                      'w-full',
                      esSticker ? 'aspect-square object-contain' : 'aspect-video object-cover',
                    )}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/*
          La atribución no es decorativa: las condiciones de GIPHY la exigen a
          cambio de la clave gratuita. Se pinta sólo cuando el catálogo está
          configurado, porque atribuir un servicio que no se está usando sería
          raro además de falso.
        */}
        {data?.configured ? (
          <p className="mt-1.5 text-center text-[10.5px] uppercase tracking-wide text-[var(--text-3)]">
            {t.message.poweredByGiphy}
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
