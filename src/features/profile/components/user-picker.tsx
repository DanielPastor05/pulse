'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Search, UserRoundSearch, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useUserSearch } from '@/features/search/hooks';
import { Avatar } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import type { PublicUser } from '@/types/dto';
import { useT } from '@/i18n/provider';

type Props = {
  selected: PublicUser[];
  onChange: (users: PublicUser[]) => void;
  excludeIds?: string[];
  placeholder?: string;
  max?: number;
};

/** Search-and-select people. Used for group creation and adding members. */
export function UserPicker({
  selected,
  onChange,
  excludeIds = [],
  placeholder,
  max = 50,
}: Props) {
  const t = useT();
  const [term, setTerm] = React.useState('');
  const { data: users, isFetching } = useUserSearch(term);

  const excluded = React.useMemo(
    () => new Set([...excludeIds, ...selected.map((user) => user.id)]),
    [excludeIds, selected],
  );

  const results = (users ?? []).filter((user) => !excluded.has(user.id));

  const toggle = (user: PublicUser) => {
    const exists = selected.some((item) => item.id === user.id);
    if (exists) {
      onChange(selected.filter((item) => item.id !== user.id));
      return;
    }
    if (selected.length >= max) return;
    onChange([...selected, user]);
    setTerm('');
  };

  return (
    <div className="space-y-3">
      <Input
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder={placeholder ?? t.settings.searchPeople}
        icon={<Search />}
        autoComplete="off"
      />

      <AnimatePresence initial={false}>
        {selected.length > 0 ? (
          <motion.ul
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-wrap gap-1.5 overflow-hidden"
          >
            {selected.map((user) => (
              <motion.li
                key={user.id}
                layout
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
                className="flex items-center gap-1.5 rounded-full bg-[var(--surface-sunken)] py-1 pl-1 pr-2"
              >
                <Avatar src={user.avatarUrl} name={user.displayName} size="xs" />
                <span className="text-[12px] font-medium">{user.displayName}</span>
                <button
                  type="button"
                  onClick={() => toggle(user)}
                  className="grid size-4 place-items-center rounded-full text-[var(--text-3)] transition-colors hover:bg-[var(--hairline-strong)] hover:text-[var(--text-1)]"
                  aria-label={`Remove ${user.displayName}`}
                >
                  <X className="size-3" />
                </button>
              </motion.li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>

      <div className="scroll-area max-h-56 min-h-[7rem] overflow-y-auto rounded-[var(--radius-card)] bg-[var(--surface-sunken)] p-1.5">
        {term.trim().length < 2 ? (
          <EmptyState
            compact
            icon={<UserRoundSearch />}
            title={t.settings.findPeople}
            description={t.settings.twoCharacters}
          />
        ) : isFetching && results.length === 0 ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton className="size-8 rounded-full" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
        ) : results.length === 0 ? (
          <p className="px-3 py-8 text-center text-[13px] text-[var(--text-3)]">
            No one matched “{term}”.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {results.map((user) => (
              <li key={user.id}>
                <button
                  type="button"
                  onClick={() => toggle(user)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-[var(--radius-field)] p-2 text-left',
                    'transition-colors duration-150 hover:bg-[var(--surface)]',
                  )}
                >
                  <Avatar
                    src={user.avatarUrl}
                    name={user.displayName}
                    size="sm"
                    presence={user.presence}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">
                      {user.displayName}
                    </span>
                    <span className="block truncate text-[11px] text-[var(--text-3)]">
                      @{user.username}
                    </span>
                  </span>
                  <Check className="size-4 text-[var(--text-3)] opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
