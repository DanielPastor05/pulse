'use client';

import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useT } from '@/i18n/provider';

const EmojiPickerReact = dynamic(() => import('emoji-picker-react'), {
  ssr: false,
  loading: () => <Skeleton className="h-[400px] w-full rounded-[var(--radius-card)]" />,
});

/**
 * Full emoji set for reactions. A dialog rather than a popover so the picker
 * never fights the message list for space on small screens.
 */
export function ReactionPickerDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (emoji: string) => void;
}) {
  const t = useT();
  const { resolvedTheme } = useTheme();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" className="p-4">
        <DialogHeader className="mb-3">
          <DialogTitle>{t.message.pickReaction}</DialogTitle>
        </DialogHeader>
        <div className="flex justify-center">
          <EmojiPickerReact
            theme={(resolvedTheme === 'dark' ? 'dark' : 'light') as never}
            lazyLoadEmojis
            skinTonesDisabled
            width="100%"
            height={400}
            previewConfig={{ showPreview: false }}
            onEmojiClick={(emoji) => {
              onSelect(emoji.emoji);
              onOpenChange(false);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
