import { create } from 'zustand';

import type { CallMode } from '@/lib/realtime';
import type { PublicUser } from '@/types/dto';

export type CallStatus = 'idle' | 'ringing' | 'joining' | 'active';

export type RemoteParticipant = {
  userId: string;
  stream: MediaStream | null;
  state: RTCPeerConnectionState;
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
  dropRemote: (userId: string) => void;
  setMic: (on: boolean) => void;
  setCamera: (on: boolean) => void;
  reset: () => void;
};

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
};

/**
 * A call is app-wide state, not conversation state: it has to survive
 * navigating away from the chat it started in, and an incoming call has to
 * appear wherever you happen to be.
 */
export const useCallStore = create<CallState>((set) => ({
  ...EMPTY,

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

  setStatus: (status) => set({ status }),
  setLocalStream: (localStream) => set({ localStream }),

  upsertRemote: (participant) =>
    set((state) => ({ remotes: { ...state.remotes, [participant.userId]: participant } })),

  dropRemote: (userId) =>
    set((state) => {
      const remotes = { ...state.remotes };
      delete remotes[userId];
      return { remotes };
    }),

  setMic: (micOn) => set({ micOn }),
  setCamera: (cameraOn) => set({ cameraOn }),
  reset: () => set(EMPTY),
}));
