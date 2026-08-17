import { publicEnv, serverEnv } from '@/lib/env';
import { realtimeChannels, type RealtimeEvent } from '@/lib/realtime';
import { describeError, log } from '@/server/logger';
import * as Sentry from '@sentry/nextjs';

/**
 * Server → client realtime fan-out.
 *
 * Uses Supabase Realtime's HTTP broadcast endpoint rather than
 * `postgres_changes` so the payload we push is the same enriched DTO the REST
 * endpoints return (author, reactions, attachments) instead of a raw table row.
 *
 * Channels are private: subscribers are authorised by the RLS policies on
 * `realtime.messages`, so knowing a conversation id is not enough to listen in.
 * Publishing therefore needs the service role — it is the one caller that has
 * to write into other people's inbox topics when fanning out notifications.
 *
 * Failures never break the request that triggered them; the client refetches on
 * focus and reconnect anyway.
 */
async function send(messages: Array<{ topic: string; event: string; payload: unknown }>) {
  if (messages.length === 0) return;

  try {
    const response = await fetch(`${publicEnv.supabaseUrl}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: serverEnv.serviceRoleKey,
        authorization: `Bearer ${serverEnv.serviceRoleKey}`,
      },
      body: JSON.stringify({ messages: messages.map((m) => ({ ...m, private: true })) }),
      cache: 'no-store',
    });

    // A silent 4xx here means every client stops receiving live updates while
    // the REST API keeps working — the confusing failure mode worth logging.
    if (!response.ok) {
      log.error('realtime.broadcast_rejected', {
        status: response.status,
        body: await response.text(),
      });
      alertSilentFailure('realtime.broadcast_rejected', { status: response.status });
    }
  } catch (error) {
    log.error('realtime.broadcast_failed', describeError(error));
    alertSilentFailure('realtime.broadcast_failed', describeError(error));
  }
}

/**
 * Sube el fallo a donde ya se miran los errores.
 *
 * Este es el más engañoso de la aplicación: la petición del usuario termina en
 * 201, el mensaje queda guardado, la API responde perfectamente — y nadie lo
 * recibe en vivo. No hay excepción que capturar ni petición que falle, así que
 * el registro por sí solo no basta: hay que estar leyéndolo justo cuando pasa.
 *
 * Se manda como aviso y no como excepción porque no lo es: es una degradación,
 * y mezclarla con los fallos duros haría que ninguna de las dos se mirase.
 */
function alertSilentFailure(event: string, fields: Record<string, unknown>) {
  Sentry.captureMessage(event, {
    level: 'warning',
    tags: { subsystem: 'realtime' },
    extra: fields,
  });
}

export function broadcastToConversation(
  conversationId: string,
  event: RealtimeEvent,
  payload: unknown,
) {
  return send([{ topic: realtimeChannels.conversation(conversationId), event, payload }]);
}

export function broadcastToUsers(userIds: string[], event: RealtimeEvent, payload: unknown) {
  const unique = [...new Set(userIds)];
  return send(unique.map((id) => ({ topic: realtimeChannels.user(id), event, payload })));
}

/**
 * Same fan-out, but each recipient gets their own payload — notifications carry
 * the row that belongs to that user, so they cannot share one.
 *
 * Exists so callers do not loop over `broadcastToUsers`: `send` already batches
 * a whole array into a single HTTP request, and a loop turns one request into
 * one per recipient.
 */
export function broadcastPerUser(
  entries: Array<{ userId: string; payload: unknown }>,
  event: RealtimeEvent,
) {
  return send(
    entries.map(({ userId, payload }) => ({
      topic: realtimeChannels.user(userId),
      event,
      payload,
    })),
  );
}
