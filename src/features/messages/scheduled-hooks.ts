'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import type { ScheduledMessageDTO } from '@/types/dto';
import { useT } from '@/i18n/provider';

/**
 * Lo que a esta persona le queda por salir aquí.
 *
 * `refetchInterval` no: la lista sólo cambia cuando la cambias tú, o cuando el
 * despachador envía algo — y eso llega al hilo por el canal en vivo, que ya
 * provoca un refresco de los mensajes. Sondear cada pocos segundos una lista
 * que casi siempre está vacía es tráfico a cambio de nada.
 *
 * Se refresca al enfocar la ventana, que es cuando alguien vuelve a mirar.
 */
export function useProgramados(conversationId: string) {
  return useQuery({
    queryKey: queryKeys.scheduled(conversationId),
    queryFn: () =>
      api<{ scheduled: ScheduledMessageDTO[] }>(
        `/conversations/${conversationId}/scheduled`,
      ).then((data) => data.scheduled),
    staleTime: 30_000,
  });
}

export function useProgramarMensaje(conversationId: string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (input: { content: string; scheduledFor: string; replyToId?: string | null }) =>
      api<{ scheduled: ScheduledMessageDTO }>(`/conversations/${conversationId}/scheduled`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.scheduled(conversationId) });
      toast.success(t.composer.scheduled);
    },
    onError: (error) => toast.error(t.composer.scheduleFailed, { description: error.message }),
  });
}

export function useCancelarProgramado(conversationId: string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (id: string) =>
      api(`/conversations/${conversationId}/scheduled/${id}`, { method: 'DELETE' }),
    // Sin parcheo optimista: cancelar tiene que poder fallar de forma visible.
    // Si la fila ya se envió mientras el diálogo estaba abierto, el servidor
    // responde que no existe, y quitarla de la lista antes de saberlo le diría
    // a alguien que ha cancelado un mensaje que en realidad salió.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.scheduled(conversationId) });
      toast.success(t.composer.scheduleCancelled);
    },
    onError: (error) => toast.error(t.composer.scheduleCancelFailed, { description: error.message }),
  });
}
