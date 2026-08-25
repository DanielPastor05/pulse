'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Plus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { api } from '@/lib/api-client';

import { useSession } from '@/components/providers/session-provider';
import { useUiStore } from '@/stores/ui-store';
import { NewConversationDialog } from '@/features/conversations/components/new-conversation-dialog';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/misc';
import { useT } from '@/i18n/provider';
import type { SoloTexto } from '@/i18n/en';

const SHORTCUTS = [
  { keys: ['⌘', 'K'], label: 'searchEverything' },
  { keys: ['?'], label: 'allShortcuts' },
] as const satisfies ReadonlyArray<{
  keys: readonly string[];
  label: SoloTexto<'nav'>;
}>;

/**
 * The panel when nothing is open. It says one thing and offers one action —
 * the icon-in-a-glowing-tile plus three feature cards was decoration standing
 * in for content.
 */
export function ChatWelcome() {
  const t = useT();
  const me = useSession();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const setCommandOpen = useUiStore((state) => state.setCommandOpen);
  const router = useRouter();

  /*
   * El asistente vive aqui y no en un menu.
   *
   * Esta es la pantalla de "no se que hacer con esto", que es exactamente
   * cuando alguien agradece tener con quien probar. Y despues del primer
   * mensaje ya no hace falta: el hilo se queda en la lista como cualquier
   * otro, porque el asistente es una cuenta normal con una marca encima.
   */
  const abrirAsistente = useMutation({
    mutationFn: () => api<{ id: string }>('/assistant', { method: 'POST' }),
    onSuccess: (conversacion) => router.push(`/chat/${conversacion.id}`),
    onError: (error) => toast.error(t.nav.assistantFailed, { description: error.message }),
  });
  // `split` puede devolver un hueco vacío si el nombre son sólo espacios, y
  // antes daba igual porque se interpolaba tal cual. Ahora entra en una función
  // que promete recibir un texto.
  const firstName = me.displayName.split(' ')[0] || me.displayName;

  return (
    <div className="panel grid h-full place-items-center overflow-hidden rounded-[var(--radius-panel)] p-6">
      <div className="max-w-[27rem]">
        <p className="label-caps mb-4 text-[var(--accent)]">{t.nav.signalEstablished}</p>
        <h1 className="text-[2.4rem] font-bold leading-[1.1] tracking-tight glow-text">
          {t.nav.goodToSee(firstName)}
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-[var(--text-2)]">
          {t.nav.pickConversation}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Button onClick={() => setDialogOpen(true)}>
            <Plus />
            {t.sidebar.newConversationShort}
          </Button>
          <Button variant="secondary" onClick={() => setCommandOpen(true)}>
            {t.common.search}
          </Button>
          {me.assistantAvailable ? (
            <Button
              variant="secondary"
              loading={abrirAsistente.isPending}
              onClick={() => abrirAsistente.mutate()}
            >
              <Sparkles />
              {t.nav.askAssistant}
            </Button>
          ) : null}
        </div>

        <dl className="mt-10 space-y-2 border-t border-[var(--hairline)] pt-5">
          {SHORTCUTS.map((shortcut) => (
            <div key={t.nav[shortcut.label]} className="flex items-center justify-between gap-4">
              <dt className="text-[12.5px] text-[var(--text-2)]">{t.nav[shortcut.label]}</dt>
              <dd className="flex shrink-0 gap-1">
                {shortcut.keys.map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <NewConversationDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
