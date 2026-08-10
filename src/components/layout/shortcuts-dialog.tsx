'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/misc';
import { useIsMac } from '@/hooks/use-keyboard-shortcuts';
import { useUiStore } from '@/stores/ui-store';

const GROUPS = [
  {
    title: 'Everywhere',
    items: [
      { keys: ['mod', 'K'], label: 'Open the command palette' },
      { keys: ['/'], label: 'Jump to search' },
      { keys: ['mod', ','], label: 'Open settings' },
      { keys: ['shift', '?'], label: 'Show this dialog' },
    ],
  },
  {
    title: 'In a conversation',
    items: [
      { keys: ['Enter'], label: 'Send message' },
      { keys: ['shift', 'Enter'], label: 'New line' },
      { keys: ['↑'], label: 'Edit your last message' },
      { keys: ['Esc'], label: 'Cancel reply or edit' },
      { keys: ['mod', 'F'], label: 'Search inside the conversation' },
    ],
  },
] as const;

export function ShortcutsDialog() {
  const { shortcutsOpen, setShortcutsOpen } = useUiStore();
  const isMac = useIsMac();

  const render = (key: string) => {
    if (key === 'mod') return isMac ? '⌘' : 'Ctrl';
    if (key === 'shift') return isMac ? '⇧' : 'Shift';
    return key;
  };

  return (
    <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Everything here works without touching the mouse.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {GROUPS.map((group) => (
            <section key={group.title} className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
                {group.title}
              </h3>
              <ul className="space-y-1">
                {group.items.map((item) => (
                  <li
                    key={item.label}
                    className="flex items-center justify-between gap-4 rounded-[var(--radius-field)] px-3 py-2 text-[13px] odd:bg-[var(--surface-sunken)]"
                  >
                    <span className="text-[var(--text-2)]">{item.label}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {item.keys.map((key) => (
                        <Kbd key={key}>{render(key)}</Kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
