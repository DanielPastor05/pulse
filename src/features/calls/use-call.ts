'use client';

import * as React from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { toast } from 'sonner';

import { api } from '@/lib/api-client';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  CALL_LIMITS,
  realtimeChannels,
  realtimeEvents,
  type CallMode,
  type CallPresencePayload,
  type CallSignalPayload,
} from '@/lib/realtime';
import { hasTurn } from '@/features/calls/ice';
import { Peer, isPolite } from '@/features/calls/peer';
import { useCallStore } from '@/stores/call-store';

/**
 * Drives a call from start to hang-up.
 *
 * Mesh, not a media server: every participant holds one connection per other
 * participant. That keeps all the infrastructure at zero — the signalling rides
 * the conversation's private Realtime channel, which RLS already restricts to
 * members — at the cost of upload bandwidth, since each person sends their own
 * camera N-1 times. Hence the caps in `CALL_LIMITS`.
 *
 * Mounted once, high in the tree, so a call survives navigating between
 * conversations.
 */
export function useCall(meId: string) {
  const store = useCallStore();
  const peers = React.useRef(new Map<string, Peer>());
  const channel = React.useRef<RealtimeChannel | null>(null);
  const localStream = React.useRef<MediaStream | null>(null);

  const { status, callId, conversationId, mode } = store;

  /** Stops the camera light. Closing the connection alone does not. */
  const stopLocalMedia = React.useCallback(() => {
    localStream.current?.getTracks().forEach((track) => track.stop());
    localStream.current = null;
  }, []);

  const teardown = React.useCallback(() => {
    peers.current.forEach((peer) => peer.close());
    peers.current.clear();
    stopLocalMedia();
    if (channel.current) {
      void getSupabaseBrowserClient().removeChannel(channel.current);
      channel.current = null;
    }
    useCallStore.getState().reset();
  }, [stopLocalMedia]);

  const send = React.useCallback((event: string, payload: unknown) => {
    void channel.current?.send({ type: 'broadcast', event, payload });
  }, []);

  /** Opens (or reuses) the connection to one participant. */
  const peerFor = React.useCallback(
    (otherId: string, currentCallId: string) => {
      const existing = peers.current.get(otherId);
      if (existing) return existing;

      const peer = new Peer({
        polite: isPolite(meId, otherId),
        send: (data) =>
          send(realtimeEvents.callSignal, {
            callId: currentCallId,
            from: meId,
            to: otherId,
            data,
          } satisfies CallSignalPayload),
        onTrack: (stream) =>
          useCallStore.getState().upsertRemote({ userId: otherId, stream, state: 'connected' }),
        onStateChange: (state) => {
          const store = useCallStore.getState();
          store.upsertRemote({
            userId: otherId,
            stream: store.remotes[otherId]?.stream ?? null,
            state,
          });
          // A participant whose browser was closed never sends `leave`, so the
          // connection state is the only signal that they are gone.
          if (state === 'closed' || state === 'failed') {
            peers.current.get(otherId)?.close();
            peers.current.delete(otherId);
            store.dropRemote(otherId);
          }
        },
      });

      if (localStream.current) peer.addLocalTracks(localStream.current);
      peers.current.set(otherId, peer);
      return peer;
    },
    [meId, send],
  );

  /** Subscribes to the conversation channel and wires the call events. */
  const joinSignalling = React.useCallback(
    async (targetConversationId: string, currentCallId: string) => {
      const supabase = getSupabaseBrowserClient();
      await supabase.realtime.setAuth();

      const ch = supabase.channel(realtimeChannels.conversation(targetConversationId), {
        config: { private: true },
      });

      ch.on('broadcast', { event: realtimeEvents.callSignal }, ({ payload }) => {
        const signal = payload as CallSignalPayload;
        if (signal.callId !== currentCallId || signal.to !== meId) return;
        void peerFor(signal.from, currentCallId).accept(signal.data);
      });

      ch.on('broadcast', { event: realtimeEvents.callAccept }, ({ payload }) => {
        const { callId: id, userId } = payload as CallPresencePayload;
        if (id !== currentCallId || userId === meId) return;

        const store = useCallStore.getState();
        const seats = CALL_LIMITS[store.mode];
        if (Object.keys(store.remotes).length + 2 > seats) {
          toast.error(`This call is full (${seats} people)`, {
            description: 'Everyone sends their own video to everyone else, so it stops holding up.',
          });
          return;
        }

        store.setStatus('active');
        // Only one side opens the connection, or both offer at once. The peer
        // with the lower id does it; the other waits for the offer.
        if (meId < userId) peerFor(userId, currentCallId);
        else store.upsertRemote({ userId, stream: null, state: 'new' });
      });

      ch.on('broadcast', { event: realtimeEvents.callLeave }, ({ payload }) => {
        const { callId: id, userId } = payload as CallPresencePayload;
        if (id !== currentCallId) return;

        peers.current.get(userId)?.close();
        peers.current.delete(userId);
        useCallStore.getState().dropRemote(userId);

        // Last one out closes the call rather than leaving an empty window.
        if (peers.current.size === 0) teardown();
      });

      await new Promise<void>((resolve) => {
        ch.subscribe((state) => {
          if (state === 'SUBSCRIBED' || state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
            resolve();
          }
        });
      });

      channel.current = ch;
      return ch;
    },
    [meId, peerFor, teardown],
  );

  const captureLocal = React.useCallback(async (wanted: CallMode) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: wanted === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
    });
    localStream.current = stream;
    useCallStore.getState().setLocalStream(stream);
    return stream;
  }, []);

  /** Rings everyone else in the conversation. */
  const startCall = React.useCallback(
    async (targetConversationId: string, name: string | null, wanted: CallMode) => {
      if (useCallStore.getState().status !== 'idle') return;

      const newCallId = crypto.randomUUID();
      useCallStore
        .getState()
        .start({ callId: newCallId, conversationId: targetConversationId, conversationName: name, mode: wanted });

      try {
        await captureLocal(wanted);
      } catch {
        toast.error('Could not use your microphone or camera', {
          description: 'Check the permission in your browser and try again.',
        });
        teardown();
        return;
      }

      await joinSignalling(targetConversationId, newCallId);

      // Through the server: a client cannot publish to other people's user
      // channels, and the invite has to reach members who are not looking at
      // this conversation.
      try {
        await api(`/conversations/${targetConversationId}/calls`, {
          method: 'POST',
          body: { callId: newCallId, mode: wanted },
        });
      } catch (error) {
        toast.error('Could not start the call', {
          description: error instanceof Error ? error.message : undefined,
        });
        teardown();
        return;
      }

      if (!hasTurn()) {
        console.warn('[call] no TURN configured — calls will fail on many mobile networks');
      }
    },
    [captureLocal, joinSignalling, teardown],
  );

  /** Picks up a ringing call. */
  const acceptCall = React.useCallback(async () => {
    const store = useCallStore.getState();
    if (store.status !== 'ringing' || !store.callId || !store.conversationId) return;

    store.setStatus('joining');

    try {
      await captureLocal(store.mode);
    } catch {
      toast.error('Could not use your microphone or camera');
      teardown();
      return;
    }

    await joinSignalling(store.conversationId, store.callId);
    send(realtimeEvents.callAccept, { callId: store.callId, userId: meId } satisfies CallPresencePayload);
    useCallStore.getState().setStatus('active');
  }, [captureLocal, joinSignalling, meId, send, teardown]);

  const rejectCall = React.useCallback(() => {
    const store = useCallStore.getState();
    if (store.callId) {
      // Sent over the user channel of whoever rang, via the server, because we
      // never joined the conversation channel.
      void api(`/conversations/${store.conversationId}/calls/${store.callId}/reject`, {
        method: 'POST',
      }).catch(() => {});
    }
    teardown();
  }, [teardown]);

  const leaveCall = React.useCallback(() => {
    const store = useCallStore.getState();
    if (store.callId) {
      send(realtimeEvents.callLeave, { callId: store.callId, userId: meId } satisfies CallPresencePayload);
    }
    teardown();
  }, [meId, send, teardown]);

  const toggleMic = React.useCallback(() => {
    const next = !useCallStore.getState().micOn;
    localStream.current?.getAudioTracks().forEach((track) => (track.enabled = next));
    useCallStore.getState().setMic(next);
  }, []);

  const toggleCamera = React.useCallback(() => {
    const next = !useCallStore.getState().cameraOn;
    localStream.current?.getVideoTracks().forEach((track) => (track.enabled = next));
    useCallStore.getState().setCamera(next);
  }, []);

  // Leaving the tab open on a dead call is worse than dropping it: the other
  // side keeps seeing a participant who is not there.
  React.useEffect(() => {
    if (status === 'idle') return;
    const onUnload = () => {
      if (callId) {
        send(realtimeEvents.callLeave, { callId, userId: meId } satisfies CallPresencePayload);
      }
    };
    window.addEventListener('pagehide', onUnload);
    return () => window.removeEventListener('pagehide', onUnload);
  }, [status, callId, meId, send]);

  React.useEffect(() => teardown, [teardown]);

  return {
    status,
    callId,
    conversationId,
    mode,
    startCall,
    acceptCall,
    rejectCall,
    leaveCall,
    toggleMic,
    toggleCamera,
  };
}
