'use client';

import * as React from 'react';
import { PencilLine } from 'lucide-react';

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
import { Tooltip } from '@/components/ui/tooltip';
import { useT } from '@/i18n/provider';

/** El mismo tope que `updateMemberSchema`, para avisar antes de mandar. */
const MAX = 40;

/**
 * Poner apodo a alguien dentro de una conversación.
 *
 * El apodo existía de punta a punta —columna, validador, permisos, y la lista de
 * miembros ya pintaba `nickname ?? displayName`— y no había manera de escribir
 * uno. Es la clase de función que parece no existir porque no tiene botón.
 *
 * Un diálogo y no un `prompt()`: el apodo tiene un máximo de 40 caracteres y
 * conviene decirlo mientras se escribe, no rechazarlo después. Y un `prompt` no
 * deja borrar el apodo distinguiendo «vacío» de «he cancelado».
 */
export function BotonDeApodo({
  nombre,
  apodo,
  onGuardar,
}: {
  nombre: string;
  apodo: string | null;
  onGuardar: (apodo: string | null) => void;
}) {
  const t = useT();
  const [abierto, setAbierto] = React.useState(false);
  const [valor, setValor] = React.useState(apodo ?? '');

  // Al reabrir se parte de lo que hay guardado, no de lo que se dejó a medias
  // la vez anterior.
  React.useEffect(() => {
    if (abierto) setValor(apodo ?? '');
  }, [abierto, apodo]);

  const guardar = () => {
    const limpio = valor.trim();
    onGuardar(limpio === '' ? null : limpio);
    setAbierto(false);
  };

  return (
    <>
      <Tooltip content={t.conversation.setNickname}>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`${t.conversation.setNickname} — ${nombre}`}
          onClick={() => setAbierto(true)}
        >
          <PencilLine />
        </Button>
      </Tooltip>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.conversation.setNickname}</DialogTitle>
            <DialogDescription>{t.conversation.nicknameHint(nombre)}</DialogDescription>
          </DialogHeader>

          <Field
            label={t.conversation.nickname}
            htmlFor="member-nickname"
            hint={`${valor.length}/${MAX}`}
          >
            <Input
              id="member-nickname"
              value={valor}
              maxLength={MAX}
              placeholder={nombre}
              autoFocus
              onChange={(event) => setValor(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && guardar()}
            />
          </Field>

          <DialogFooter>
            {/*
              Quitar el apodo es su propio botón y no «guardar vacío»: borrar
              algo debe poder hacerse sin tener que adivinar que el hueco en
              blanco significa borrar.
            */}
            {apodo ? (
              <Button
                variant="ghost"
                onClick={() => {
                  onGuardar(null);
                  setAbierto(false);
                }}
              >
                {t.conversation.clearNickname}
              </Button>
            ) : null}
            <Button onClick={guardar}>{t.common.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
