'use client';

import { AnimatePresence, motion } from 'framer-motion';

function describe(names: string[]): string {
  if (names.length === 1) return `${names[0]} is typing`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing`;
  return `${names[0]} and ${names.length - 1} others are typing`;
}

export function TypingIndicator({ names }: { names: string[] }) {
  return (
    <AnimatePresence>
      {names.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden px-5"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 pb-1.5 pt-0.5">
            <span className="flex items-center gap-1 rounded-full bg-[var(--bubble-in)] px-2.5 py-1.5 ring-1 ring-[var(--hairline)]">
              {[0, 1, 2].map((dot) => (
                <motion.span
                  key={dot}
                  className="size-1.5 rounded-full bg-[var(--text-3)]"
                  animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
                  transition={{
                    duration: 0.9,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: dot * 0.15,
                  }}
                />
              ))}
            </span>
            <span className="text-[11.5px] text-[var(--text-3)]">{describe(names)}</span>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
