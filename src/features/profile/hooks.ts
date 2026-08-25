'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useUpdateSessionCache } from '@/components/providers/session-provider';
import type { UpdateProfileInput } from '@/features/profile/validators';
import type { CurrentUser, PublicUser, RelationshipDTO } from '@/types/dto';
import { useT } from '@/i18n/provider';

export function useUpdateProfile() {
  const t = useT();
  const queryClient = useQueryClient();
  const patchSession = useUpdateSessionCache();

  return useMutation({
    mutationFn: (input: UpdateProfileInput) =>
      api<CurrentUser>('/me', { method: 'PATCH', body: input }),
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.me, user);
      patchSession(user);
      toast.success(t.toast.saved);
    },
    onError: (error) => toast.error(t.toast.saveFailed, { description: error.message }),
  });
}

export function useRelationships() {
  return useQuery({
    queryKey: queryKeys.relationships,
    queryFn: () =>
      api<{ relationships: RelationshipDTO[] }>('/relationships').then(
        (data) => data.relationships,
      ),
  });
}

export function useRelationshipActions() {
  const t = useT();
  const queryClient = useQueryClient();
  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: queryKeys.relationships });

  const send = useMutation({
    mutationFn: (userId: string) =>
      api('/relationships', { method: 'POST', body: { userId } }),
    onSuccess: () => {
      invalidate();
      toast.success(t.toast.friendRequestSent);
    },
    onError: (error) => toast.error(t.toast.sendFailed, { description: error.message }),
  });

  const respond = useMutation({
    mutationFn: (input: { id: string; accept: boolean }) =>
      api(`/relationships/${input.id}`, { method: 'PATCH', body: { accept: input.accept } }),
    onSuccess: invalidate,
    onError: (error) => toast.error(t.toast.respondFailed, { description: error.message }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/relationships/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });

  return { send, respond, remove };
}

export function useBlockedUsers() {
  return useQuery({
    queryKey: queryKeys.blocked,
    queryFn: () => api<{ users: PublicUser[] }>('/blocks').then((data) => data.users),
  });
}

export function useSetBlocked() {
  const t = useT();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { userId: string; blocked: boolean }) =>
      api('/blocks', { method: 'POST', body: input }),
    onSuccess: (_data, input) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.blocked });
      void queryClient.invalidateQueries({ queryKey: queryKeys.relationships });

      /*
       * Y la conversación, que es donde se nota.
       *
       * `blockedByMe` y `blockedMe` viven en el detalle, y de ahí sale tanto el
       * estado del perfil como el aviso del redactor —«aquí no puedes
       * escribir»—. Sin invalidarlo, bloquear a alguien dejaba el chat
       * exactamente igual hasta recargar. Reportado como «al bloquear no se
       * actualiza el mensaje y el estado automáticamente».
       *
       * Se invalidan **todas** las conversaciones y no una: desde aquí no se
       * sabe cuál es la del bloqueado, y un bloqueo es lo bastante raro como
       * para no merecer llevar la cuenta de eso.
       */
      void queryClient.invalidateQueries({ queryKey: ['conversation'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations(false) });

      toast.success(input.blocked ? t.toast.blocked : t.toast.unblocked);
    },
    onError: (error) => toast.error(t.toast.updateFailed, { description: error.message }),
  });
}
