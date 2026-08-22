'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/misc';
import { useIsMac } from '@/hooks/use-keyboard-shortcuts';
import { useUiStore } from '@/stores/ui-store';
import { useT } from '@/i18n/provider';
import type { SoloTexto } from '@/i18n/en';

const GROUPS = [
  {
    title: 'everywhere',
    items: [
      { keys: ['mod', 'K'], label: 'openPalette' },
      { keys: ['/'], label: 'jumpToSearch' },
      { keys: ['mod', ','], label: 'openSettings' },
      { keys: ['shift', '?'], label: 'showThisDialog' },
    ],
  },
  {
    title: 'inAConversation',
    items: [
      { keys: ['Enter'], label: 'sendMessage' },
      { keys: ['shift', 'Enter'], label: 'newLine' },
      { keys: ['↑'], label: 'editLast' },
      { keys: ['Esc'], label: 'cancelReply' },
      { keys: ['mod', 'F'], label: 'searchInside' },
    ],
  },
] as const satisfies ReadonlyArray<{
  title: SoloTexto<'nav'>;
  items: ReadonlyArray<{ keys: readonly string[]; label: SoloTexto<'nav'> }>;
}>;

export function ShortcutsDialog() {
  const t = useT();
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
          <DialogTitle>{t.nav.shortcuts}</DialogTitle>
          <DialogDescription>{t.nav.shortcutsHint}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {GROUPS.map((group) => (
            <section key={group.title} className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
                {t.nav[group.title]}
              </h3>
              <ul className="space-y-1">
                {group.items.map((item) => (
                  <li
                    key={item.label}
                    className="flex items-center justify-between gap-4 rounded-[var(--radius-field)] px-3 py-2 text-[13px] odd:bg-[var(--surface-sunken)]"
                  >
                    <span className="text-[var(--text-2)]">{t.nav[item.label]}</span>
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
