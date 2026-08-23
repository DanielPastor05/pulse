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
/** `new URL()` acepta `javascript:` — parsear no es validar. */
function httpUrl(valor: string | null): string | null {
  if (!valor) return null;
  try {
    const url = new URL(valor);
    return url.protocol === 'http:' || url.protocol === 'https:' ? valor : null;
  } catch {
    return null;
  }
}

export function LinkPreviewCard({ preview }: { preview: LinkPreviewDTO }) {
  /*
   * El esquema se comprueba aquí **además** de en el servidor.
   *
   * `src/server/link-preview.ts` ya sólo detecta enlaces `https?://` y descarta
   * las imágenes que no lo sean, con sus pruebas. O sea que hoy no llega nada
   * peligroso. Pero el sumidero está en este fichero: el `href` de abajo se
   * ejecuta al pulsarlo, y la única razón de que sea seguro vive tres ficheros
   * más allá. Basta con que alguien añada otra forma de crear un preview
   * —importar, migrar, un endpoint nuevo— para que esa distancia importe.
   *
   * La comprobación cabía dentro del `new URL()` que este componente ya hacía
   * para sacar el host, así que cuesta una condición.
   */
  const href = httpUrl(preview.url);
  const imageUrl = httpUrl(preview.imageUrl);
  if (!href) return null;

  const host = new URL(href).hostname.replace(/^www\./, '');

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className={cn(
        'mt-2 flex max-w-md overflow-hidden rounded-[var(--radius-field)]',
        'border border-[var(--hairline)] bg-[var(--surface-sunken)]',
        'transition-colors hover:border-[var(--accent)]',
      )}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
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
