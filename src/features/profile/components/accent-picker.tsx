'use client';

import { ACCENTS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/provider';

type AccentPickerProps = {
  value: string;
  onChange: (accent: string) => void;
};

/** Swatches, not gradient chips. The selection is a ring, not a checkmark. */
export function AccentPicker({ value, onChange }: AccentPickerProps) {
  const t = useT();
  return (
    <div role="radiogroup" aria-label={t.auth.accentColour} className="flex flex-wrap gap-2">
      {ACCENTS.map((accent) => {
        const selected = accent.id === value;
        return (
          <button
            key={accent.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={accent.label}
            onClick={() => onChange(accent.id)}
            className={cn(
              'size-6 rounded-full outline-none',
              'transition-[box-shadow,transform] duration-150 ease-[var(--ease-out)]',
              'active:scale-95',
              selected
                ? 'ring-2 ring-[var(--text-1)] ring-offset-2 ring-offset-[var(--surface)]'
                : 'ring-1 ring-inset ring-black/15 hover:ring-2 hover:ring-[var(--hairline-strong)]',
            )}
            style={{ backgroundColor: accent.swatch }}
          />
        );
      })}
    </div>
  );
}
