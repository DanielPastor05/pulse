'use client';

import { AnimatePresence, motion } from 'framer-motion';

import { cn } from '@/lib/utils';
import type { ReactionGroup } from '@/types/dto';

export function MessageReactions({
  reactions,
  onToggle,
  align,
}: {
  reactions: ReactionGroup[];
  onToggle: (emoji: string) => void;
  align: 'start' | 'end';
}) {
  if (reactions.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-1', align === 'end' ? 'justify-end' : 'justify-start')}>
      <AnimatePresence initial={false}>
        {reactions.map((reaction) => (
          <motion.button
            key={reaction.emoji}
            layout
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 520, damping: 26 }}
            type="button"
            onClick={() => onToggle(reaction.emoji)}
            aria-pressed={reaction.reactedByMe}
            className={cn(
              'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] leading-5',
              'transition-colors duration-150 active:scale-95',
              reaction.reactedByMe
                ? 'border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] text-[var(--accent)]'
                : 'border-[var(--hairline)] bg-[var(--surface)] text-[var(--text-2)] hover:border-[var(--hairline-strong)]',
            )}
          >
            <span>{reaction.emoji}</span>
            <span className="font-semibold tabular-nums">{reaction.count}</span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
