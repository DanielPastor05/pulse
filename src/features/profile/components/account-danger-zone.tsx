'use client';

import * as React from 'react';
import { Download, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';

import { ApiError, api } from '@/lib/api-client';
import { hardNavigate } from '@/lib/navigate';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useSession } from '@/components/providers/session-provider';
import { useT } from '@/i18n/provider';

type OwnedGroup = { id: string; name: string | null; memberCount: number };

/**
 * Descargar tus datos y borrar la cuenta.
 *
 * Van juntos a propósito: quien está a punto de borrar es exactamente quien
 * puede querer su copia, y separarlos en dos pantallas garantiza que alguien se
 * marche sin ella.
 */
export function AccountDangerZone() {
  const t = useT();
  const me = useSession();
  const [open, setOpen] = React.useState(false);
  const [confirmation, setConfirmation] = React.useState('');
  const [working, setWorking] = React.useState(false);
  const [blockedBy, setBlockedBy] = React.useState<OwnedGroup[] | null>(null);

  const download = () => {
    // Una navegación normal, no un fetch: la respuesta llega con
    // `content-disposition: attachment`, así que el navegador la guarda solo.
    window.location.href = '/api/me/export';
  };

  const remove = async () => {
    setWorking(true);
    setBlockedBy(null);

    try {
      await api('/me', { method: 'DELETE', body: { confirmation } });
      toast.success(t.settings.accountGone);
      // Sin sesión ya no hay nada que renderizar aquí, y una navegación real
      // vuelve a pasar por el middleware con la cookie ya invalidada.
      hardNavigate('/login');
    } catch (error) {
      if (error instanceof ApiError && error.code === 'conflict') {
        const groups = (error.details as { groups?: OwnedGroup[] } | undefined)?.groups;
        setBlockedBy(groups ?? []);
      } else {
        toast.error(t.settings.deleteFailed, {
          description: error instanceof Error ? error.message : undefined,
        });
      }
    } finally {
      setWorking(false);
    }
  };

  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--danger)]/35 bg-[var(--surface)] p-5">
      <div className="mb-4 space-y-1">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <TriangleAlert className="size-4 text-[var(--danger)]" aria-hidden />
          {t.settings.yourData}
        </h2>
        <p className="text-[13px] text-[var(--text-2)]">
          {t.settings.yourDataHint}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={download}>
          <Download />
          {t.settings.downloadData}
        </Button>

        <Button
          variant="ghost"
          className="text-[var(--danger)] hover:bg-[var(--danger)]/10"
          onClick={() => setOpen(true)}
        >
          {t.settings.deleteMyAccount}
        </Button>
      </div>

      <p className="mt-3 text-[12px] text-[var(--text-3)]">
        {t.settings.exportNote}
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.settings.deleteTitle}</DialogTitle>
            <DialogDescription>
              {t.settings.deleteHint} {t.settings.deleteHintExport}
            </DialogDescription>
          </DialogHeader>

          {blockedBy && blockedBy.length > 0 ? (
            <div className="rounded-[var(--radius-field)] border border-[var(--warning)]/40 bg-[var(--warning)]/10 p-3 text-[13px]">
              <p className="font-medium">{t.settings.handOver}</p>
              <p className="mt-1 text-[var(--text-2)]">
                {t.settings.handOverHint(blockedBy.length)}
              </p>
              <ul className="mt-2 space-y-1">
                {blockedBy.map((group) => (
                  <li key={group.id} className="text-[var(--text-2)]">
                    · {group.name ?? t.settings.untitledGroup} —{' '}
                    {t.conversation.memberCount(group.memberCount)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Field
            label={t.settings.typeToConfirm(me.username)}
            htmlFor="delete-confirmation"
            hint={t.settings.exactlyAsWritten}
          >
            <Input
              id="delete-confirmation"
              value={confirmation}
              autoComplete="off"
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={me.username}
            />
          </Field>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">{t.settings.keepAccount}</Button>
            </DialogClose>
            <Button
              className="bg-[var(--danger)] text-white hover:bg-[var(--danger)]"
              disabled={confirmation !== me.username || working}
              loading={working}
              onClick={() => void remove()}
            >
              {t.settings.deleteForGood}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
