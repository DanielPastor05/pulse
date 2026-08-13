import { create } from 'zustand';

type RightPanel = 'none' | 'details' | 'pins' | 'search' | 'gallery' | 'thread';

type UiState = {
  commandOpen: boolean;
  mobileNavOpen: boolean;
  rightPanel: RightPanel;
  /** Which message the thread panel is showing; only meaningful with 'thread'. */
  threadRootId: string | null;
  shortcutsOpen: boolean;
  openThread: (messageId: string) => void;
  setCommandOpen: (open: boolean) => void;
  toggleCommand: () => void;
  setMobileNavOpen: (open: boolean) => void;
  setRightPanel: (panel: RightPanel) => void;
  toggleRightPanel: (panel: Exclude<RightPanel, 'none'>) => void;
  setShortcutsOpen: (open: boolean) => void;
};

/** Ephemeral chrome state — nothing here needs to survive a reload. */
export const useUiStore = create<UiState>((set) => ({
  commandOpen: false,
  mobileNavOpen: false,
  // Open by default: on wide screens the third column is part of the layout,
  // not a drawer you go looking for.
  rightPanel: 'details',
  threadRootId: null,
  shortcutsOpen: false,
  openThread: (threadRootId) => set({ threadRootId, rightPanel: 'thread' }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  toggleCommand: () => set((state) => ({ commandOpen: !state.commandOpen })),
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
  setRightPanel: (rightPanel) => set({ rightPanel }),
  toggleRightPanel: (panel) =>
    set((state) => ({ rightPanel: state.rightPanel === panel ? 'none' : panel })),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
}));
