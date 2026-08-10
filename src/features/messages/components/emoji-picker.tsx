'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';

// ~200 KB of emoji data — loaded only when someone actually opens the picker.
const EmojiPickerReact = dynamic(() => import('emoji-picker-react'), {
  ssr: false,
  loading: () => (
    <div className="grid w-[20rem] gap-2 p-3">
      <Skeleton className="h-9 w-full" />
      <div className="grid grid-cols-8 gap-1.5">
        {Array.from({ length: 32 }).map((_, index) => (
          <Skeleton key={index} className="aspect-square rounded-lg" />
        ))}
      </div>
    </div>
  ),
});

type Props = {
  onSelect: (emoji: string) => void;
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'bottom';
};

export function EmojiPicker({
  onSelect,
  children,
  open,
  onOpenChange,
  align = 'end',
  side = 'top',
}: Props) {
  const { resolvedTheme } = useTheme();

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align={align} side={side} className="w-auto overflow-hidden p-0">
        <EmojiPickerReact
          theme={(resolvedTheme === 'dark' ? 'dark' : 'light') as never}
          lazyLoadEmojis
          skinTonesDisabled
          width={330}
          height={400}
          previewConfig={{ showPreview: false }}
          onEmojiClick={(emoji) => {
            onSelect(emoji.emoji);
            onOpenChange?.(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
