'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { Avatar, type AvatarProps } from '@/components/ui/avatar';
import { useT } from '@/i18n/provider';

/**
 * Un avatar que se puede mirar de cerca.
 *
 * Se pidió «una manera de ver una foto de perfil», y era literal: la foto se
 * pintaba a 80 píxeles y no había forma de verla entera. Cualquier aplicación de
 * mensajería deja tocarla y ampliarla, y aquí no.
 *
 * Sólo cuando hay foto. Sin ella el avatar son iniciales sobre un color, y
 * ampliar unas iniciales no enseña nada — un botón que abre algo vacío es peor
 * que no tenerlo.
 */
export function AvatarConVisor({ src, name, ...props }: AvatarProps) {
  const t = useT();
  const [abierto, setAbierto] = React.useState(false);

  if (!src) return <Avatar src={src} name={name} {...props} />;

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label={t.settings.viewPicture(name)}
        className="rounded-[var(--radius-panel)] transition-transform hover:scale-[1.02] active:scale-95"
      >
        <Avatar src={src} name={name} {...props} />
      </button>

      <AnimatePresence>
        {abierto ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            // Cierra al pulsar fuera y con Escape: las dos salidas que la gente
            // prueba, y ninguna necesita encontrar una equis.
            onClick={() => setAbierto(false)}
            onKeyDown={(event) => event.key === 'Escape' && setAbierto(false)}
            role="dialog"
            aria-modal
            aria-label={t.settings.viewPicture(name)}
            tabIndex={-1}
            ref={(nodo) => nodo?.focus()}
            className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-6 backdrop-blur-sm"
          >
            <motion.img
              initial={{ scale: 0.92 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.92 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              src={src}
              alt={name}
              className="max-h-full max-w-full rounded-[var(--radius-panel)] object-contain shadow-[var(--shadow-overlay)]"
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
