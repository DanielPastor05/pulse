'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import type { MemberDTO } from '@/types/dto';
import { useT } from '@/i18n/provider';

type Props = {
  members: MemberDTO[];
  query: string;
  onSelect: (username: string) => void;
  onDismiss: () => void;
};

/**
 * @-autocomplete anchored above the composer. Arrow keys and Enter are handled
 * here (the composer defers to this list while it is open).
 */
export function MentionSuggestions({ members, query, onSelect, onDismiss }: Props) {
  const t = useT();
  const [index, setIndex] = React.useState(0);

  const matches = React.useMemo(() => {
    const term = query.toLowerCase();
    return members
      .filter(
        (member) =>
          member.user.username.toLowerCase().includes(term) ||
          member.user.displayName.toLowerCase().includes(term),
      )
      .slice(0, 6);
  }, [members, query]);

  React.useEffect(() => setIndex(0), [query]);

  React.useEffect(() => {
    if (matches.length === 0) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setIndex((current) => (current + 1) % matches.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setIndex((current) => (current - 1 + matches.length) % matches.length);
      } else if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        const chosen = matches[index];
        if (chosen) onSelect(chosen.user.username);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        onDismiss();
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [matches, index, onSelect, onDismiss]);

  if (matches.length === 0) return null;

  return (
    <ul
      role="listbox"
      aria-label={t.message.mentionSomeone}
      className={cn(
        'absolute bottom-full left-0 z-30 mb-2 w-64 overflow-hidden rounded-[var(--radius-card)] p-1.5',
        'surface-overlay border border-[var(--hairline)] shadow-[var(--shadow-overlay)]',
      )}
    >
      {matches.map((member, position) => (
        <li key={member.id}>
          <button
            type="button"
            role="option"
            aria-selected={position === index}
            onMouseEnter={() => setIndex(position)}
            onClick={() => onSelect(member.user.username)}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-[var(--radius-field)] px-2 py-1.5 text-left transition-colors',
              position === index ? 'bg-[var(--surface-hover)]' : 'hover:bg-[var(--surface-hover)]',
            )}
          >
            <Avatar src={member.user.avatarUrl} name={member.user.displayName} size="xs" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">
                {member.user.displayName}
              </span>
              <span className="block truncate text-[11px] text-[var(--text-3)]">
                @{member.user.username}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
