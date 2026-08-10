import { publicEnv, serverEnv } from '@/lib/env';
import { realtimeChannels, type RealtimeEvent } from '@/lib/realtime';

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
      console.error('[realtime] broadcast rejected', response.status, await response.text());
    }
  } catch (error) {
    console.error('[realtime] broadcast failed', error);
  }
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
