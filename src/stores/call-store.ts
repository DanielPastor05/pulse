import { create } from 'zustand';

import type { CallMode } from '@/lib/realtime';
import type { PublicUser } from '@/types/dto';

export type CallStatus = 'idle' | 'ringing' | 'joining' | 'active';

export type RemoteParticipant = {
  userId: string;
  stream: MediaStream | null;
  state: RTCPeerConnectionState;
  /**
   * Lo que el otro lado dice tener encendido. Se asume abierto hasta que
   * llegue su `call.state`: pintar a todo el mundo silenciado de entrada haría
   * que el icono de mute dejase de significar nada.
   */
  micOn: boolean;
  cameraOn: boolean;
  sharing: boolean;
  /** Derivado del nivel de audio, no de nada que mande el otro. */
  speaking: boolean;
};

type CallState = {
  status: CallStatus;
  callId: string | null;
  conversationId: string | null;
  conversationName: string | null;
  mode: CallMode;
  /** Who rang, when the call is incoming. */
  from: Pick<PublicUser, 'id' | 'displayName' | 'avatarUrl'> | null;

  localStream: MediaStream | null;
  remotes: Record<string, RemoteParticipant>;

  micOn: boolean;
  cameraOn: boolean;
  sharing: boolean;
  speaking: boolean;
  /** Cuándo empezó, para el contador. Null mientras nadie ha descolgado. */
  startedAt: number | null;

  /**
   * Quién se fue de una llamada que sigue abierta, y hasta cuándo se le espera.
   *
   * Es lo que distingue «me he quedado solo porque el otro colgó» de «todavía
   * no lo ha cogido nadie»: las dos son una llamada sin nadie enfrente, y no
   * significan lo mismo para quien la mira.
   */
  waitingFor: { userId: string; until: number } | null;

  /**
   * La llamada de la que uno acaba de salir y a la que puede volver.
   *
   * Sobrevive al `reset`, a diferencia de todo lo demás: colgar tiene que
   * dejar la llamada limpia y a la vez dejar la puerta abierta.
   */
  rejoinable: {
    callId: string;
    conversationId: string;
    conversationName: string | null;
    mode: CallMode;
    expiresAt: number;
  } | null;

  incoming: (input: {
    callId: string;
    conversationId: string;
    conversationName: string | null;
    mode: CallMode;
    from: Pick<PublicUser, 'id' | 'displayName' | 'avatarUrl'>;
  }) => void;
  start: (input: {
    callId: string;
    conversationId: string;
    conversationName: string | null;
    mode: CallMode;
  }) => void;
  setStatus: (status: CallStatus) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  upsertRemote: (participant: RemoteParticipant) => void;
  /** Sólo los campos que cambian, sin tocar el stream ni el estado de conexión. */
  patchRemote: (userId: string, patch: Partial<RemoteParticipant>) => void;
  dropRemote: (userId: string) => void;
  setMic: (on: boolean) => void;
  setCamera: (on: boolean) => void;
  setSharing: (on: boolean) => void;
  setSpeaking: (on: boolean) => void;
  setWaitingFor: (waiting: CallState['waitingFor']) => void;
  offerRejoin: (offer: NonNullable<CallState['rejoinable']>) => void;
  clearRejoin: () => void;
  reset: () => void;
};

/** Valores por defecto de alguien de quien todavía no sabemos nada. */
export const remoteDefaults = { micOn: true, cameraOn: true, sharing: false, speaking: false };

const EMPTY = {
  status: 'idle' as CallStatus,
  callId: null,
  conversationId: null,
  conversationName: null,
  mode: 'audio' as CallMode,
  from: null,
  localStream: null,
  remotes: {},
  micOn: true,
  cameraOn: false,
  sharing: false,
  speaking: false,
  startedAt: null,
  waitingFor: null,
};

/**
 * A call is app-wide state, not conversation state: it has to survive
 * navigating away from the chat it started in, and an incoming call has to
 * appear wherever you happen to be.
 */
export const useCallStore = create<CallState>((set) => ({
  ...EMPTY,
  rejoinable: null,

  incoming: ({ callId, conversationId, conversationName, mode, from }) =>
    set({ ...EMPTY, status: 'ringing', callId, conversationId, conversationName, mode, from }),

  start: ({ callId, conversationId, conversationName, mode }) =>
    set({
      ...EMPTY,
      status: 'joining',
      callId,
      conversationId,
      conversationName,
      mode,
      cameraOn: mode === 'video',
    }),

  // El contador arranca cuando la llamada pasa a activa, no cuando se marca:
  // los segundos que pasan sonando no son tiempo de llamada.
  setStatus: (status) =>
    set((state) => ({
      status,
      startedAt: status === 'active' ? (state.startedAt ?? Date.now()) : state.startedAt,
    })),
  setLocalStream: (localStream) => set({ localStream }),

  upsertRemote: (participant) =>
    set((state) => ({
      remotes: {
        ...state.remotes,
        [participant.userId]: { ...remoteDefaults, ...state.remotes[participant.userId], ...participant },
      },
    })),

  patchRemote: (userId, patch) =>
    set((state) => {
      const current = state.remotes[userId];
      if (!current) return {};
      return { remotes: { ...state.remotes, [userId]: { ...current, ...patch } } };
    }),

  dropRemote: (userId) =>
    set((state) => {
      const remotes = { ...state.remotes };
      delete remotes[userId];
      return { remotes };
    }),

  setMic: (micOn) => set({ micOn }),
  setCamera: (cameraOn) => set({ cameraOn }),
  setSharing: (sharing) => set({ sharing }),
  setSpeaking: (speaking) => set({ speaking }),
  setWaitingFor: (waitingFor) => set({ waitingFor }),

  offerRejoin: (rejoinable) => set({ rejoinable }),
  clearRejoin: () => set({ rejoinable: null }),

  // `rejoinable` sobrevive al reset a propósito: colgar tiene que dejar la
  // llamada limpia —micrófono, cámara, conexiones— y a la vez recordar dónde
  // estabas para poder volver.
  reset: () => set((state) => ({ ...EMPTY, rejoinable: state.rejoinable })),
}));
