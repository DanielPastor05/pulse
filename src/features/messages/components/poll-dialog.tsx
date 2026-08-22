'use client';

import * as React from 'react';
import { useMutation } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';

import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { MessageDTO } from '@/types/dto';
import { useT } from '@/i18n/provider';

const MAX_OPTIONS = 10;

export function PollDialog({
  conversationId,
  open,
  onOpenChange,
}: {
  conversationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const [question, setQuestion] = React.useState('');
  // Two blanks up front: a poll needs at least two answers, so starting with
  // one and making people find the add button gets the shape wrong.
  const [options, setOptions] = React.useState(['', '']);
  const [multiple, setMultiple] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setQuestion('');
      setOptions(['', '']);
      setMultiple(false);
    }
  }, [open]);

  const create = useMutation({
    mutationFn: () =>
      api<MessageDTO>(`/conversations/${conversationId}/polls`, {
        method: 'POST',
        body: { question: question.trim(), options: options.map((o) => o.trim()), multiple },
      }),
    onSuccess: () => onOpenChange(false),
    onError: (error) => toast.error(t.message.pollFailed, { description: error.message }),
  });

  const filled = options.map((o) => o.trim()).filter(Boolean);
  const ready = question.trim().length > 0 && filled.length >= 2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>{t.message.poll}</DialogTitle>
        <DialogDescription>{t.message.pollHint}</DialogDescription>

        <Field label={t.message.pollQuestion} className="mt-4">
          <Input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={t.message.pollPlaceholder}
            maxLength={300}
            autoFocus
          />
        </Field>

        <div className="mt-3 space-y-1.5">
          {options.map((option, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <Input
                value={option}
                onChange={(event) =>
                  setOptions((current) =>
                    current.map((item, i) => (i === index ? event.target.value : item)),
                  )
                }
                placeholder={t.message.pollOption(index + 1)}
                maxLength={150}
              />
              {options.length > 2 ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t.message.removePollOption(index + 1)}
                  onClick={() => setOptions((current) => current.filter((_, i) => i !== index))}
                >
                  <X />
                </Button>
              ) : null}
            </div>
          ))}
        </div>

        {options.length < MAX_OPTIONS ? (
          <Button
            variant="ghost"
            size="sm"
            className="mt-1.5"
            onClick={() => setOptions((current) => [...current, ''])}
          >
            <Plus />
            {t.message.pollAddOption}
          </Button>
        ) : null}

        <label className="mt-3 flex items-center gap-2 text-[13px] text-[var(--text-2)]">
          <input
            type="checkbox"
            checked={multiple}
            onChange={(event) => setMultiple(event.target.checked)}
          />
          {t.message.pollMulti}
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t.common.cancel}
          </Button>
          <Button onClick={() => create.mutate()} disabled={!ready || create.isPending}>
            {create.isPending ? t.message.pollCreating : t.message.pollCreate}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
