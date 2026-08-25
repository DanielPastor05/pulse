'use client';

import * as React from 'react';
import { CalendarClock, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { useDates } from '@/i18n/dates';
import { useT } from '@/i18n/provider';
import {
  useCancelarProgramado,
  useProgramados,
  useProgramarMensaje,
} from '@/features/messages/scheduled-hooks';
import { ATAJOS, aValorLocal, calcularAtajo } from '@/features/messages/schedule-times';

/**
 * Programar un mensaje, y ver los que ya están esperando.
 *
 * Las dos cosas en un sitio a propósito: lo que alguien quiere saber justo
 * después de programar algo es qué tiene programado, y separarlo en dos
 * pantallas obliga a buscar la segunda.
 */
export function DialogoDeProgramacion({
  conversationId,
  contenido,
  replyToId,
  abierto,
  onOpenChange,
  onProgramado,
}: {
  conversationId: string;
  contenido: string;
  replyToId: string | null;
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  /** Para que la consola se vacíe, igual que al enviar. */
  onProgramado: () => void;
}) {
  const t = useT();
  const { formatFullTimestamp } = useDates();
  const pendientes = useProgramados(conversationId);
  const programar = useProgramarMensaje(conversationId);
  const cancelar = useCancelarProgramado(conversationId);

  const [cuando, setCuando] = React.useState('');

  // Al abrir se propone dentro de una hora, que es el atajo más usado, y se
  // vuelve a calcular cada vez: un valor guardado de hace media hora ya sería
  // pasado.
  React.useEffect(() => {
    if (abierto) setCuando(aValorLocal(calcularAtajo('inOneHour')));
  }, [abierto]);

  const texto = contenido.trim();
  const minimo = aValorLocal(new Date(Date.now() + 60_000));

  const enviar = () => {
    if (!texto || !cuando) return;
    programar.mutate(
      { content: texto, scheduledFor: new Date(cuando).toISOString(), replyToId },
      {
        onSuccess: () => {
          onProgramado();
          onOpenChange(false);
        },
      },
    );
  };

  const lista = pendientes.data ?? [];

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.composer.schedule}</DialogTitle>
          <DialogDescription>{t.composer.scheduleHint}</DialogDescription>
        </DialogHeader>

        {texto ? (
          <div className="space-y-3">
            <p className="line-clamp-3 rounded-[var(--radius-card)] bg-[var(--surface-sunken)] p-3 text-[13px] text-[var(--text-2)]">
              {texto}
            </p>

            <div className="flex flex-wrap gap-1.5">
              {ATAJOS.map((clave) => (
                <Button
                  key={clave}
                  size="sm"
                  variant="ghost"
                  onClick={() => setCuando(aValorLocal(calcularAtajo(clave)))}
                >
                  {t.composer[clave]}
                </Button>
              ))}
            </div>

            <Field label={t.composer.scheduleWhen} htmlFor="schedule-when">
              <Input
                id="schedule-when"
                type="datetime-local"
                value={cuando}
                min={minimo}
                onChange={(event) => setCuando(event.target.value)}
              />
            </Field>
          </div>
        ) : null}

        {lista.length > 0 ? (
          <div className="space-y-1.5">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
              {t.composer.scheduledPending(lista.length)}
            </h3>
            <ul className="space-y-1">
              {lista.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start gap-2 rounded-[var(--radius-card)] bg-[var(--surface-sunken)] p-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px]">{item.content}</p>
                    <p className="text-[11px] text-[var(--text-3)]">
                      {formatFullTimestamp(item.scheduledFor)}
                    </p>
                  </div>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={t.composer.cancelSchedule}
                    loading={cancelar.isPending && cancelar.variables === item.id}
                    onClick={() => cancelar.mutate(item.id)}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : texto ? null : (
          <EmptyState
            icon={<CalendarClock />}
            title={t.composer.nothingScheduled}
            description={t.composer.nothingScheduledHint}
          />
        )}

        {texto ? (
          <DialogFooter>
            <Button onClick={enviar} loading={programar.isPending} disabled={!cuando}>
              {t.composer.schedule}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
