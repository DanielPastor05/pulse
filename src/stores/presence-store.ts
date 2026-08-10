import { create } from 'zustand';
import type { Presence } from '@prisma/client';

type PresenceState = {
  /** userId → live presence, populated from the global presence channel. */
  online: Record<string, Presence>;
  setAll: (next: Record<string, Presence>) => void;
};

export const usePresenceStore = create<PresenceState>((set) => ({
  online: {},
  setAll: (online) => set({ online }),
}));

/**
 * Live presence wins over the value stored on the row, which can be stale by
 * up to a heartbeat interval.
 */
export function usePresenceOf(userId: string | undefined, fallback: Presence): Presence {
  return usePresenceStore((state) => (userId ? (state.online[userId] ?? fallback) : fallback));
}
