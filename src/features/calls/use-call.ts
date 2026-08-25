'use client';

import * as React from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { toast } from 'sonner';

import { api } from '@/lib/api-client';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  CALL_LIMITS,
  CALL_REJOIN_WINDOW_MS,
  realtimeChannels,
  realtimeEvents,
  type CallHerePayload,
  type CallMode,
  type CallPresencePayload,
  type CallSignalPayload,
  type CallStatePayload,
} from '@/lib/realtime';
import { fetchIceConfig, type IceConfig } from '@/features/calls/ice';
import { Peer, isPolite } from '@/features/calls/peer';
import { watchAudioLevel } from '@/features/calls/audio-level';
import { remoteDefaults, useCallStore } from '@/stores/call-store';
import { useT } from '@/i18n/provider';

/**
 * Drives a call from start to hang-up.
 *
 * Mesh, not a media server: every participant holds one connection per other
 * participant. That keeps all the infrastructure at zero — the signalling rides
 * the conversation's private Realtime channel, which RLS already restricts to
 * members — at the cost of upload bandwidth, since each person sends their own
 * camera N-1 times. Hence the caps in `CALL_LIMITS`.
 *
 * **Se monta una sola vez**, en `CallProvider`, y todo lo demás lo consume por
 * contexto. No es una preferencia de estilo: el canal, los peers y la cámara
 * viven en `useRef`, así que dos llamadas a este hook son dos llamadas
 * distintas que no se ven entre sí — y al desmontarse cualquiera de ellas, su
 * `teardown` resetea el store de todos. Llamarlo directamente desde un
 * componente vuelve a romper contestar una llamada.
 */
export function useCall(meId: string) {
  const t = useT();
  const store = useCallStore();
  const peers = React.useRef(new Map<string, Peer>());
  const channel = React.useRef<RealtimeChannel | null>(null);
  const localStream = React.useRef<MediaStream | null>(null);
  // Fetched once per call and reused by every peer in the mesh: minting a set
  // per connection would spend quota for nothing.
  const ice = React.useRef<IceConfig>({ iceServers: [], relay: false });
  /** La pista de cámara, guardada aparte para poder volver a ella tras compartir. */
  const cameraTrack = React.useRef<MediaStreamTrack | null>(null);
  const screenStream = React.useRef<MediaStream | null>(null);
  /** Un vigilante de nivel por participante, para poder pararlos todos. */
  const levelStops = React.useRef(new Map<string, () => void>());

  const { status, callId, conversationId, mode, waitingFor } = store;

  /** Stops the camera light. Closing the connection alone does not. */
  const stopLocalMedia = React.useCallback(() => {
    localStream.current?.getTracks().forEach((track) => track.stop());
    // La cámara y la pantalla se paran aparte: al compartir salen del stream
    // local, así que recorrerlo ya no las alcanza y el piloto se quedaría dado.
    cameraTrack.current?.stop();
    screenStream.current?.getTracks().forEach((track) => track.stop());
    localStream.current = null;
    cameraTrack.current = null;
    screenStream.current = null;
  }, []);

  const teardown = React.useCallback(() => {
    levelStops.current.forEach((stop) => stop());
    levelStops.current.clear();
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

  /** Empieza a vigilar el nivel de voz de alguien; `self` para uno mismo. */
  const watchLevel = React.useCallback((who: string, stream: MediaStream) => {
    levelStops.current.get(who)?.();
    const stop = watchAudioLevel(stream, (speaking) => {
      const store = useCallStore.getState();
      if (who === 'self') store.setSpeaking(speaking);
      else store.patchRemote(who, { speaking });
    });
    levelStops.current.set(who, stop);
  }, []);

  /** Anuncia qué tenemos encendido. Se manda al cambiar y al entrar alguien. */
  const broadcastState = React.useCallback(() => {
    const store = useCallStore.getState();
    if (!store.callId) return;
    send(realtimeEvents.callState, {
      callId: store.callId,
      userId: meId,
      micOn: store.micOn,
      cameraOn: store.cameraOn,
      sharing: store.sharing,
    } satisfies CallStatePayload);
  }, [meId, send]);

  /** Opens (or reuses) the connection to one participant. */
  const peerFor = React.useCallback(
    (otherId: string, currentCallId: string) => {
      const existing = peers.current.get(otherId);
      if (existing) return existing;

      const peer = new Peer({
        polite: isPolite(meId, otherId),
        iceServers: ice.current.iceServers,
        send: (data) =>
          send(realtimeEvents.callSignal, {
            callId: currentCallId,
            from: meId,
            to: otherId,
            data,
          } satisfies CallSignalPayload),
        onTrack: (stream) => {
          useCallStore
            .getState()
            .upsertRemote({ ...remoteDefaults, userId: otherId, stream, state: 'connected' });
          watchLevel(otherId, stream);
        },
        onStateChange: (state) => {
          const store = useCallStore.getState();
          store.upsertRemote({
            ...remoteDefaults,
            ...store.remotes[otherId],
            userId: otherId,
            stream: store.remotes[otherId]?.stream ?? null,
            state,
          });
          // A participant whose browser was closed never sends `leave`, so the
          // connection state is the only signal that they are gone.
          if (state === 'closed' || state === 'failed') {
            peers.current.get(otherId)?.close();
            peers.current.delete(otherId);
            levelStops.current.get(otherId)?.();
            levelStops.current.delete(otherId);
            store.dropRemote(otherId);
          }
        },
      });

      if (localStream.current) peer.addLocalTracks(localStream.current);
      peers.current.set(otherId, peer);
      return peer;
    },
    [meId, send, watchLevel],
  );

  /** Subscribes to the conversation channel and wires the call events. */
  const joinSignalling = React.useCallback(
    async (targetConversationId: string, currentCallId: string) => {
      const supabase = getSupabaseBrowserClient();
      await supabase.realtime.setAuth();

      // Topic propio, no el de la conversación: ver el comentario en
      // `realtimeChannels.call`. Compartirlo hacía que colgar dejase la
      // conversación sin tiempo real.
      const ch = supabase.channel(realtimeChannels.call(targetConversationId), {
        config: { private: true },
      });

      ch.on('broadcast', { event: realtimeEvents.callSignal }, ({ payload }) => {
        const signal = payload as CallSignalPayload;
        if (signal.callId !== currentCallId || signal.to !== meId) return;
        void peerFor(signal.from, currentCallId).accept(signal.data);
      });

      /**
       * Opens the connection to one participant, or waits for their offer.
       *
       * Only the lower id offers. Without that rule both ends would offer at
       * once on every pairing — perfect negotiation would survive it, but it is
       * cheaper not to collide in the first place.
       */
      const connectTo = (otherId: string) => {
        const store = useCallStore.getState();
        const seats = CALL_LIMITS[store.mode];

        if (Object.keys(store.remotes).length + 2 > seats) {
          toast.error(t.toast.callFull(seats), {
            description:
              'Everyone sends their own camera to everyone else, so it stops holding up beyond that.',
          });
          return;
        }

        store.setStatus('active');
        // Alguien ha entrado: ya no se espera a nadie.
        if (store.waitingFor) store.setWaitingFor(null);
        if (meId < otherId) peerFor(otherId, currentCallId);
        else store.upsertRemote({ ...remoteDefaults, userId: otherId, stream: null, state: 'new' });
      };

      ch.on('broadcast', { event: realtimeEvents.callAccept }, ({ payload }) => {
        const { callId: id, userId } = payload as CallPresencePayload;
        if (id !== currentCallId || userId === meId) return;

        // Announce ourselves back. The channel keeps no history, so somebody
        // joining third would otherwise never learn that the second person is
        // here — they accepted before this newcomer was even subscribed.
        send(realtimeEvents.callHere, {
          callId: currentCallId,
          userId: meId,
          to: userId,
        } satisfies CallHerePayload);

        connectTo(userId);
        // Quien acaba de entrar no sabe si tenemos el micro cerrado o estamos
        // compartiendo pantalla: nada de eso viaja en la negociación.
        broadcastState();
      });

      ch.on('broadcast', { event: realtimeEvents.callHere }, ({ payload }) => {
        const { callId: id, userId, to } = payload as CallHerePayload;
        if (id !== currentCallId || to !== meId || userId === meId) return;
        connectTo(userId);
        broadcastState();
      });

      ch.on('broadcast', { event: realtimeEvents.callState }, ({ payload }) => {
        const state = payload as CallStatePayload;
        if (state.callId !== currentCallId || state.userId === meId) return;
        useCallStore.getState().patchRemote(state.userId, {
          micOn: state.micOn,
          cameraOn: state.cameraOn,
          sharing: state.sharing,
        });
      });

      ch.on('broadcast', { event: realtimeEvents.callLeave }, ({ payload }) => {
        const { callId: id, userId } = payload as CallPresencePayload;
        if (id !== currentCallId) return;

        peers.current.get(userId)?.close();
        peers.current.delete(userId);
        levelStops.current.get(userId)?.();
        levelStops.current.delete(userId);
        useCallStore.getState().dropRemote(userId);

        // Quedarse solo ya no cierra la llamada.
        //
        // Colgar sin querer, quedarse sin batería o meterse en un túnel se ven
        // exactamente igual desde el otro lado, y en los tres casos volver a
        // llamar es fricción que no hacía falta. La llamada se queda esperando
        // y quien se fue puede reengancharse donde estaba. A los quince
        // minutos se acaba sola: pasado ese rato lo que hay no es una llamada
        // en pausa, es una ventana olvidada con el micrófono abierto.
        if (peers.current.size === 0) {
          useCallStore
            .getState()
            .setWaitingFor({ userId, until: Date.now() + CALL_REJOIN_WINDOW_MS });
        }
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
    // Ya no depende de `teardown`: quedarse solo dejó de cerrar la llamada.
    [meId, peerFor, send, broadcastState, t],
  );

  const captureLocal = React.useCallback(
    async (wanted: CallMode) => {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: wanted === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      });
      localStream.current = stream;
      cameraTrack.current = stream.getVideoTracks()[0] ?? null;
      useCallStore.getState().setLocalStream(stream);
      useCallStore.getState().setCamera(wanted === 'video');
      watchLevel('self', stream);
      return stream;
    },
    [watchLevel],
  );

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
        toast.error(t.toast.mediaFailed, {
          description: 'Check the permission in your browser and try again.',
        });
        teardown();
        return;
      }

      // Before any peer exists: a connection created without relay servers
      // cannot be given them afterwards.
      ice.current = await fetchIceConfig();

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
        toast.error(t.toast.callStartFailed, {
          description: error instanceof Error ? error.message : undefined,
        });
        teardown();
        return;
      }

      if (!ice.current.relay) {
        console.warn('[call] no TURN relay — calls will fail on many mobile networks');
      }
    },
    [captureLocal, joinSignalling, teardown, t],
  );

  /**
   * Entra en una llamada que ya existe: cogerla, o volver a ella.
   *
   * Los dos casos son el mismo camino —capturar, unirse a la señalización y
   * anunciarse— y la única diferencia es de dónde sale el `callId`. Tenerlos
   * separados sería tener dos sitios donde arreglar el mismo fallo.
   */
  const joinExisting = React.useCallback(
    async (callId: string, targetConversationId: string, wanted: CallMode) => {
      try {
        await captureLocal(wanted);
      } catch {
        toast.error(t.toast.mediaFailed);
        teardown();
        return;
      }

      ice.current = await fetchIceConfig();
      await joinSignalling(targetConversationId, callId);
      send(realtimeEvents.callAccept, { callId, userId: meId } satisfies CallPresencePayload);

      // El estado se queda en `joining` a propósito: pasa a `active` cuando
      // alguien conteste, en `connectTo`. Para quien vuelve a una llamada eso
      // es la diferencia entre entrar y comprobar que sigue habiendo alguien —
      // si no queda nadie, el temporizador de «no contestan» la cierra sola en
      // vez de dejar una ventana abierta contra una sala vacía.
    },
    [captureLocal, joinSignalling, meId, send, teardown, t],
  );

  /** Picks up a ringing call. */
  const acceptCall = React.useCallback(async () => {
    const store = useCallStore.getState();
    if (store.status !== 'ringing' || !store.callId || !store.conversationId) return;

    store.setStatus('joining');
    store.clearRejoin();
    await joinExisting(store.callId, store.conversationId, store.mode);
    // Coger una llamada que está sonando sí implica que hay alguien al otro
    // lado: quien llama está esperando. Volver a una, no.
    useCallStore.getState().setStatus('active');
  }, [joinExisting]);

  /** Vuelve a la llamada de la que uno se acaba de salir. */
  const rejoinCall = React.useCallback(async () => {
    const store = useCallStore.getState();
    const offer = store.rejoinable;
    if (!offer || store.status !== 'idle') return;

    if (Date.now() > offer.expiresAt) {
      store.clearRejoin();
      toast.message('That call has ended');
      return;
    }

    store.clearRejoin();
    store.start({
      callId: offer.callId,
      conversationId: offer.conversationId,
      conversationName: offer.conversationName,
      mode: offer.mode,
    });

    await joinExisting(offer.callId, offer.conversationId, offer.mode);
  }, [joinExisting]);

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

  /**
   * Salir de la llamada, ofreciendo volver o no.
   *
   * El parámetro vive aquí y no en `leaveCall` porque ésa se pasa tal cual a un
   * `onClick`: con un booleano en la firma, el navegador le colaría el evento
   * del ratón, que es siempre verdadero, y «colgar del todo» pasaría a ofrecer
   * volver sin que nadie lo pidiera.
   */
  const exitCall = React.useCallback(
    (offerReturn: boolean) => {
      const store = useCallStore.getState();

      // Si no queda nadie dentro, la llamada se acaba aqui: una llamada
      // necesita al menos una persona para seguir existiendo. Sin esta
      // condición, el último en salir se llevaría una oferta de volver a una
      // sala vacía — y el primero en salir tendría la suya, así que los dos
      // podrían «reengancharse» por separado a una llamada que ya no existe.
      const alone = Object.keys(store.remotes).length === 0;

      if (store.callId && store.conversationId) {
        send(realtimeEvents.callLeave, {
          callId: store.callId,
          userId: meId,
        } satisfies CallPresencePayload);

        if (offerReturn && !alone) {
          // Salir no cierra la puerta: los demás dejan la llamada abierta un
          // rato, así que se guarda lo justo para poder volver a ella.
          store.offerRejoin({
            callId: store.callId,
            conversationId: store.conversationId,
            conversationName: store.conversationName,
            mode: store.mode,
            expiresAt: Date.now() + CALL_REJOIN_WINDOW_MS,
          });
        } else {
          store.clearRejoin();
        }
      }

      teardown();
    },
    [meId, send, teardown],
  );

  const leaveCall = React.useCallback(() => exitCall(true), [exitCall]);

  /** Colgar del todo: ni se espera a nadie ni se ofrece volver. */
  const endCall = React.useCallback(() => exitCall(false), [exitCall]);

  const toggleMic = React.useCallback(() => {
    const next = !useCallStore.getState().micOn;
    localStream.current?.getAudioTracks().forEach((track) => (track.enabled = next));
    useCallStore.getState().setMic(next);
    broadcastState();
  }, [broadcastState]);

  const toggleCamera = React.useCallback(() => {
    const next = !useCallStore.getState().cameraOn;
    localStream.current?.getVideoTracks().forEach((track) => (track.enabled = next));
    useCallStore.getState().setCamera(next);
    broadcastState();
  }, [broadcastState]);

  /**
   * Cambia el vídeo que sale hacia todos y el que se ve en el propio recuadro.
   *
   * `replaceTrack` no renegocia, así que cambiar de cámara a pantalla no corta
   * nada. Sólo hace falta `addTrack` —y con él una renegociación— cuando la
   * llamada empezó en modo audio y no había vídeo que sustituir.
   */
  const swapOutgoingVideo = React.useCallback(async (track: MediaStreamTrack | null) => {
    for (const peer of peers.current.values()) {
      const sender = peer.connection.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) {
        await sender.replaceTrack(track).catch(() => {});
      } else if (track && localStream.current) {
        peer.connection.addTrack(track, localStream.current);
      }
    }

    const audio = localStream.current?.getAudioTracks() ?? [];
    const next = new MediaStream([...audio, ...(track ? [track] : [])]);
    localStream.current = next;
    useCallStore.getState().setLocalStream(next);
  }, []);

  const stopScreenShare = React.useCallback(async () => {
    if (!useCallStore.getState().sharing) return;

    screenStream.current?.getTracks().forEach((t) => t.stop());
    screenStream.current = null;

    // Vuelve a la cámara si la había; si la llamada era de audio, se queda sin
    // vídeo, que es como estaba antes de compartir.
    await swapOutgoingVideo(cameraTrack.current);
    useCallStore.getState().setSharing(false);
    broadcastState();
  }, [swapOutgoingVideo, broadcastState]);

  const shareScreen = React.useCallback(async () => {
    if (useCallStore.getState().sharing) {
      await stopScreenShare();
      return;
    }

    let display: MediaStream;
    try {
      display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    } catch {
      // Cancelar el selector del navegador no es un error que merezca aviso.
      return;
    }

    const track = display.getVideoTracks()[0];
    if (!track) return;

    screenStream.current = display;
    // El navegador pone su propio botón de «dejar de compartir», y si no se
    // escucha aquí la aplicación se queda creyendo que sigue compartiendo.
    track.addEventListener('ended', () => void stopScreenShare());

    await swapOutgoingVideo(track);
    useCallStore.getState().setSharing(true);
    broadcastState();
  }, [stopScreenShare, swapOutgoingVideo, broadcastState]);

  // Nobody picked up. Without this the caller sits on "Calling…" indefinitely,
  // holding the microphone open, because a call that is never answered
  // produces no event at all.
  React.useEffect(() => {
    if (status !== 'joining') return;

    const timer = setTimeout(() => {
      if (Object.keys(useCallStore.getState().remotes).length === 0) {
        toast.message('No answer');
        leaveCall();
      }
    }, 45_000);

    return () => clearTimeout(timer);
  }, [status, leaveCall]);

  /**
   * La llamada que espera a alguien no espera para siempre.
   *
   * El temporizador se arma con el instante de vencimiento y no con una
   * duración, para que volver de segundo plano —donde el navegador estrangula
   * los temporizadores— no regale minutos que ya habían pasado.
   */
  React.useEffect(() => {
    if (!waitingFor) return;

    const remaining = waitingFor.until - Date.now();
    if (remaining <= 0) {
      endCall();
      return;
    }

    const timer = setTimeout(() => {
      // Se comprueba otra vez en vez de fiarse: en el rato puede haber vuelto
      // alguien, y colgarle encima sería peor que no haber esperado.
      if (Object.keys(useCallStore.getState().remotes).length === 0) endCall();
    }, remaining);

    return () => clearTimeout(timer);
  }, [waitingFor, endCall]);

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
    rejoinCall,
    leaveCall,
    endCall,
    toggleMic,
    toggleCamera,
    shareScreen,
    /** False means no relay: worth saying, because the failure is silent. */
    hasRelay: ice.current.relay,
  };
}
