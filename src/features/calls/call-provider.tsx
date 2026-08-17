'use client';

import * as React from 'react';

import { useSession } from '@/components/providers/session-provider';
import { useCall } from '@/features/calls/use-call';

type CallApi = ReturnType<typeof useCall>;

const CallContext = React.createContext<CallApi | null>(null);

/**
 * Una sola llamada viva por sesión, montada aquí arriba.
 *
 * Existe porque no basta con decirlo en un comentario. `useCall` guarda el
 * canal de señalización, los peers y la cámara en `useRef`, así que **cada
 * componente que lo llamaba tenía los suyos**: había tres instancias —cabecera,
 * aviso de llamada entrante y llamada activa— creyendo cada una que era la
 * única.
 *
 * Lo que eso rompía: al aceptar, el estado pasa de `ringing` a `active`, el
 * overlay cambia de componente, y el desmontaje del primero ejecutaba su
 * `teardown` — cerrando el canal recién unido, apagando la cámara y dejando el
 * store en `idle`. Quien contestaba se cortaba la llamada a sí mismo en el
 * mismo gesto de contestarla, sin un solo error por ningún lado.
 */
export function CallProvider({ children }: { children: React.ReactNode }) {
  const call = useCall(useSession().id);
  return <CallContext.Provider value={call}>{children}</CallContext.Provider>;
}

export function useCallApi(): CallApi {
  const call = React.useContext(CallContext);
  if (!call) throw new Error('useCallApi necesita estar dentro de <CallProvider>');
  return call;
}
