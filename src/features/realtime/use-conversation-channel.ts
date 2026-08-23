'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';

import {
  authorizeRealtime,
  getSupabaseBrowserClient,
  subscribeWithRetry,
} from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query-keys';
import { realtimeChannels, realtimeEvents, type TypingPayload } from '@/lib/realtime';
import {
  BARRIDO_ESCRITURA_MS,
  debeEnviarEscritura,
  haCaducado,
  mereceLaPenaReenviar,
} from '@/lib/typing-throttle';
import { useMessageCache } from '@/features/messages/hooks';
import type { ConversationDetail, MessageDTO, ReactionGroup } from '@/types/dto';


function groupReactions(rows: Array<{ emoji: string; userId: string }>, viewerId: string): ReactionGroup[] {
  const groups = new Map<string, ReactionGroup>();
  for (const row of rows) {
    const group = groups.get(row.emoji) ?? { emoji: row.emoji, count: 0, userIds: [], reactedByMe: false };
    group.count += 1;
    group.userIds.push(row.userId);
    if (row.userId === viewerId) group.reactedByMe = true;
    groups.set(row.emoji, group);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));
}

/**
 * Everything live inside one conversation: new/edited/deleted messages,
 * reactions, read receipts, member changes and typing indicators.
 *
 * The server broadcasts enriched DTOs over Supabase Realtime rather than raw
 * `postgres_changes`, so the payload matches exactly what the REST endpoints
 * return and no extra round trip is needed to render it.
 */
export function useConversationChannel(conversationId: string, viewerId: string) {
  const queryClient = useQueryClient();
  const { upsert, remove, patch } = useMessageCache(conversationId);

  const [typing, setTyping] = React.useState<Record<string, { name: string; at: number }>>({});
  const channelRef = React.useRef<RealtimeChannel | null>(null);
  const lastTypingSentAt = React.useRef(0);

  /**
   * La pulsación que se quedó sin canal, esperando a que lo haya.
   *
   * Sin esto, abrir una conversación, escribir una palabra y parar no manda
   * nada en absoluto: el único intento cayó dentro de los ~350 ms que tarda la
   * suscripción, y al otro lado no aparece el aviso nunca.
   */
  const escrituraPendiente = React.useRef<{ nombre: string; desde: number } | null>(null);

  React.useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase.channel(realtimeChannels.conversation(conversationId), {
      config: { private: true },
    });
    channelRef.current = channel;

    channel
      .on('broadcast', { event: realtimeEvents.messageCreated }, ({ payload }) => {
        const { message, clientId } = payload as { message: MessageDTO; clientId: string | null };
        if (message.author?.id === viewerId && !clientId) return;
        upsert(message, clientId);
        setTyping((current) => {
          if (!message.author || !(message.author.id in current)) return current;
          const next = { ...current };
          delete next[message.author.id];
          return next;
        });
      })
      .on('broadcast', { event: realtimeEvents.messageUpdated }, ({ payload }) => {
        const { message } = payload as { message: MessageDTO };
        // `starred` and `reactedByMe` are computed for the *sender*, so the
        // viewer's own flags are kept rather than overwritten.
        patch(message.id, (current) => ({
          ...message,
          starred: current.starred,
          reactions: current.reactions,
        }));
      })
      .on('broadcast', { event: realtimeEvents.messageDeleted }, ({ payload }) => {
        remove((payload as { messageId: string }).messageId);
      })
      .on('broadcast', { event: realtimeEvents.reactionChanged }, ({ payload }) => {
        const { messageId, reactions } = payload as {
          messageId: string;
          reactions: Array<{ emoji: string; userId: string }>;
        };
        patch(messageId, (message) => ({ ...message, reactions: groupReactions(reactions, viewerId) }));
      })
      .on('broadcast', { event: realtimeEvents.readReceipt }, ({ payload }) => {
        const receipt = payload as { userId: string; lastReadMessageId: string; readAt: string };
        queryClient.setQueryData<ConversationDetail>(
          queryKeys.conversation(conversationId),
          (detail) =>
            detail
              ? {
                  ...detail,
                  members: detail.members.map((member) =>
                    member.user.id === receipt.userId
                      ? {
                          ...member,
                          lastReadAt: receipt.readAt,
                          lastReadMessageId: receipt.lastReadMessageId,
                        }
                      : member,
                  ),
                }
              : detail,
        );
      })
      .on('broadcast', { event: realtimeEvents.memberChanged }, () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.conversation(conversationId) });
      })
      .on('broadcast', { event: realtimeEvents.conversationUpdated }, () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.conversation(conversationId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.messages(conversationId) });
      })
      .on('broadcast', { event: realtimeEvents.typing }, ({ payload }) => {
        const typingPayload = payload as TypingPayload;
        if (typingPayload.userId === viewerId) return;
        setTyping((current) => ({
          ...current,
          [typingPayload.userId]: { name: typingPayload.displayName, at: Date.now() },
        }));
      });

    // The channel is private, so Realtime must have the access token before the
    // join is attempted — otherwise RLS sees an anonymous caller and rejects it.
    // Misma carrera que en el canal de usuario: sin esta bandera, un efecto que
    // se limpia mientras se autoriza acaba suscribiendo un canal ya retirado.
    let cancelled = false;
    void authorizeRealtime().then(() => {
      if (!cancelled) subscribeWithRetry(channel, 'conversation');
    });

    return () => {
      cancelled = true;
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [conversationId, viewerId, queryClient, upsert, remove, patch]);

  /**
   * Manda un paquete de escritura, sin condiciones.
   *
   * Separado de `sendTyping` porque lo llaman dos sitios: la pulsación normal y
   * el reenvío de la que se quedó sin canal.
   */
  const emitirEscritura = React.useCallback(
    (canal: RealtimeChannel, displayName: string, cuando: number) => {
      lastTypingSentAt.current = cuando;
      escrituraPendiente.current = null;
      void canal.send({
        type: 'broadcast',
        event: realtimeEvents.typing,
        payload: { userId: viewerId, displayName, conversationId } satisfies TypingPayload,
      });
    },
    [conversationId, viewerId],
  );

  /**
   * Un solo barrido con dos tareas, porque las dos van al mismo ritmo.
   *
   * **Caducar** las entradas en vez de fiarse de un evento de «he dejado de
   * escribir»: ese evento se pierde con la misma facilidad que cualquier otro, y
   * perderlo deja el aviso encendido para siempre.
   *
   * **Soltar** la pulsación que se quedó sin canal. Sin esto, abrir una
   * conversación, escribir una palabra y parar no manda nada en absoluto: el
   * único intento cayó dentro de los ~350 ms que tarda la suscripción.
   */
  React.useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();

      setTyping((current) => {
        const next = Object.fromEntries(
          Object.entries(current).filter(([, value]) => !haCaducado(now, value.at)),
        );
        return Object.keys(next).length === Object.keys(current).length ? current : next;
      });

      const pendiente = escrituraPendiente.current;
      const canal = channelRef.current;
      if (!pendiente || !canal) return;

      // Caducada: reenviarla mostraría «está escribiendo» por alguien que paró.
      if (!mereceLaPenaReenviar(now, pendiente.desde)) {
        escrituraPendiente.current = null;
        return;
      }
      if (!debeEnviarEscritura(now, lastTypingSentAt.current, true)) return;
      emitirEscritura(canal, pendiente.nombre, now);
    }, BARRIDO_ESCRITURA_MS);
    return () => clearInterval(interval);
  }, [emitirEscritura]);

  // Acelerado: un paquete por segundo basta para mantener vivo el aviso, y deja
  // el tráfico muy por debajo de cualquier límite de Realtime.
  //
  // La decisión vive en `typing-throttle` y no aquí porque el orden de sus dos
  // condiciones ya se equivocó una vez: el reloj se sellaba antes de mirar si
  // había canal, así que escribir durante los ~350 ms que tarda la suscripción
  // perdía el paquete y encima gastaba la espera entera.
  const sendTyping = React.useCallback(
    (displayName: string) => {
      const canal = channelRef.current;
      const now = Date.now();

      // Sin canal se apunta y se espera: el barrido de arriba lo suelta en
      // cuanto haya. Se guarda el intento más reciente, no el primero — describe
      // mejor el presente cuando por fin sale.
      if (!canal) {
        escrituraPendiente.current = { nombre: displayName, desde: now };
        return;
      }

      if (!debeEnviarEscritura(now, lastTypingSentAt.current, true)) return;
      emitirEscritura(canal, displayName, now);
    },
    [emitirEscritura],
  );


  const typingNames = React.useMemo(
    () => Object.values(typing).map((entry) => entry.name),
    [typing],
  );

  return { typingNames, sendTyping };
}
