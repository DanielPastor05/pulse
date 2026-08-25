'use client';

import { FONDOS, type FondoId } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/provider';

/**
 * El fondo del hilo, elegido por cada persona.
 *
 * Las muestras llevan el mismo `data-fondo` que el hilo, así que las pinta la
 * misma regla de `globals.css` y lo que se elige es exactamente lo que se ve.
 * No hay imágenes en miniatura que mantener al día ni una segunda definición
 * del dibujo que se pueda quedar desfasada.
 *
 * Tres de los siete están hechos con el color de acento, de modo que cambiar el
 * acento del grupo también cambia el fondo. Es deliberado: son la misma idea de
 * personalización y conviene que se muevan juntas.
 */
export function SelectorDeFondo({
  valor,
  onChange,
}: {
  valor: string | null;
  onChange: (fondo: FondoId) => void;
}) {
  const t = useT();
  const actual = valor ?? 'ninguno';

  return (
    <div role="radiogroup" aria-label={t.conversation.background} className="flex flex-wrap gap-2">
      {FONDOS.map((fondo) => {
        const elegido = fondo === actual;
        return (
          <button
            key={fondo}
            type="button"
            role="radio"
            aria-checked={elegido}
            aria-label={t.conversation.backgroundNames[fondo]}
            title={t.conversation.backgroundNames[fondo]}
            data-fondo={fondo === 'ninguno' ? undefined : fondo}
            onClick={() => onChange(fondo)}
            className={cn(
              'size-11 rounded-[var(--radius-card)] bg-[var(--surface-sunken)] outline-none',
              'transition-[box-shadow,transform] duration-150 ease-[var(--ease-out)]',
              'active:scale-95',
              elegido
                ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--surface-solid)]'
                : 'ring-1 ring-inset ring-[var(--hairline)] hover:ring-2 hover:ring-[var(--hairline-strong)]',
            )}
          />
        );
      })}
    </div>
  );
}
