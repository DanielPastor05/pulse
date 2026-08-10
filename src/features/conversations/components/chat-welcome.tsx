'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';

import { useSession } from '@/components/providers/session-provider';
import { useUiStore } from '@/stores/ui-store';
import { NewConversationDialog } from '@/features/conversations/components/new-conversation-dialog';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/misc';

const SHORTCUTS = [
  { keys: ['⌘', 'K'], label: 'Search everything' },
  { keys: ['?'], label: 'All shortcuts' },
] as const;

/**
 * The panel when nothing is open. It says one thing and offers one action —
 * the icon-in-a-glowing-tile plus three feature cards was decoration standing
 * in for content.
 */
export function ChatWelcome() {
  const me = useSession();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const setCommandOpen = useUiStore((state) => state.setCommandOpen);
  const firstName = me.displayName.split(' ')[0];

  return (
    <div className="panel grid h-full place-items-center overflow-hidden rounded-[var(--radius-panel)] p-6">
      <div className="max-w-[27rem]">
        <p className="label-caps mb-4 text-[var(--accent)]">Signal established</p>
        <h1 className="text-[2.4rem] font-bold leading-[1.1] tracking-tight glow-text">
          Good to see you, {firstName}.
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-[var(--text-2)]">
          Pick a conversation on the left, or start a new one.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Button onClick={() => setDialogOpen(true)}>
            <Plus />
            New conversation
          </Button>
          <Button variant="secondary" onClick={() => setCommandOpen(true)}>
            Search
          </Button>
        </div>

        <dl className="mt-10 space-y-2 border-t border-[var(--hairline)] pt-5">
          {SHORTCUTS.map((shortcut) => (
            <div key={shortcut.label} className="flex items-center justify-between gap-4">
              <dt className="text-[12.5px] text-[var(--text-2)]">{shortcut.label}</dt>
              <dd className="flex shrink-0 gap-1">
                {shortcut.keys.map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <NewConversationDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
