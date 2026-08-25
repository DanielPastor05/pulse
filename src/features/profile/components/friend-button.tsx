'use client';

import * as React from 'react';
import { Check, Clock, UserRoundPlus } from 'lucide-react';

import { useRelationships, useRelationshipActions } from '@/features/profile/hooks';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import type { PublicUser } from '@/types/dto';
import { useT } from '@/i18n/provider';

/**
 * Añadir a alguien a amigos desde donde se le ve.
 *
 * Antes sólo se podía desde su perfil, y llegar hasta ahí exigía saber que el
 * nombre era pulsable. Se reportó como «el añadir amigos es lioso, poner un
 * botón al lado del nombre» — y el sitio donde uno ve a alguien y decide
 * agregarlo es la lista de miembros de una conversación, no una pantalla aparte.
 *
 * El botón **cambia según la relación** en vez de mandar siempre la solicitud:
 * pedir amistad a quien ya la aceptó, o repetir una petición pendiente, es
 * exactamente el tipo de acción que hace dudar de si la aplicación se ha
 * enterado.
 */
export function BotonDeAmistad({ user }: { user: PublicUser }) {
  const t = useT();
  const { data: relaciones } = useRelationships();
  const { send } = useRelationshipActions();

  const relacion = relaciones?.find(
    (item) => item.user.id === user.id && item.status !== 'DECLINED',
  );

  if (relacion?.status === 'ACCEPTED') {
    return (
      <Tooltip content={t.nav.friends}>
        <span className="grid size-7 shrink-0 place-items-center text-[var(--accent)]">
          <Check className="size-3.5" />
          <span className="sr-only">{t.nav.friends}</span>
        </span>
      </Tooltip>
    );
  }

  if (relacion?.status === 'PENDING') {
    return (
      <Tooltip content={t.nav.requestSent}>
        <span className="grid size-7 shrink-0 place-items-center text-[var(--text-3)]">
          <Clock className="size-3.5" />
          <span className="sr-only">{t.nav.requestSent}</span>
        </span>
      </Tooltip>
    );
  }

  return (
    <Tooltip content={t.nav.addFriend}>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={`${t.nav.addFriend} — ${user.displayName}`}
        loading={send.isPending}
        onClick={() => send.mutate(user.id)}
      >
        <UserRoundPlus />
      </Button>
    </Tooltip>
  );
}
