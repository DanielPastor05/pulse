'use client';

import * as React from 'react';
import { Flag } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useReportMessage } from '@/features/moderation/hooks';
import { REPORT_REASONS } from '@/features/moderation/validators';
import type { MessageDTO } from '@/types/dto';

type Reason = (typeof REPORT_REASONS)[number]['value'];

export function ReportDialog({
  message,
  onOpenChange,
}: {
  message: MessageDTO | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [reason, setReason] = React.useState<Reason>('SPAM');
  const [note, setNote] = React.useState('');
  const report = useReportMessage();

  // A fresh report each time, so a previous choice is never sent by accident.
  React.useEffect(() => {
    if (message) {
      setReason('SPAM');
      setNote('');
    }
  }, [message]);

  const submit = () => {
    if (!message) return;
    report.mutate(
      { messageId: message.id, reason, note: note.trim() || null },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={Boolean(message)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle className="flex items-center gap-2">
          <Flag className="size-4 text-[var(--danger)]" />
          Report message
        </DialogTitle>
        <DialogDescription>
          Only moderators of this conversation see reports. The author is not told who reported them.
        </DialogDescription>

        <div className="mt-4 space-y-1.5">
          {REPORT_REASONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setReason(option.value)}
              className={cn(
                'flex w-full items-center gap-2 rounded-[var(--radius-field)] px-3 py-2 text-left text-[13px]',
                'border transition-colors',
                reason === option.value
                  ? 'border-[var(--accent)] bg-[var(--surface-sunken)] text-[var(--text-1)]'
                  : 'border-transparent text-[var(--text-2)] hover:bg-[var(--surface-sunken)]',
              )}
              aria-pressed={reason === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>

        <Field label="Anything to add?" className="mt-4">
          <Input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional context for the moderator"
            maxLength={500}
          />
        </Field>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={report.isPending}>
            {report.isPending ? 'Sending…' : 'Send report'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
