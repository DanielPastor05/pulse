'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useT } from '@/i18n/provider';
import type { CreateGroupInput, UpdateConversationInput } from '@/features/conversations/validators';
import type { ConversationDetail, ConversationSummary, JoinRequestDTO, MessageDTO } from '@/types/dto';

export function useConversations(archived = false) {
  return useQuery({
    queryKey: queryKeys.conversations(archived),
    queryFn: () =>
      api<{ conversations: ConversationSummary[] }>('/conversations', {
        query: { archived: archived ? 'true' : 'false' },
      }).then((data) => data.conversations),
  });
}

export function useConversation(conversationId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.conversation(conversationId ?? 'none'),
    queryFn: () => api<ConversationDetail>(`/conversations/${conversationId}`),
    enabled: Boolean(conversationId),
  });
}

export function usePinnedMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.pins(conversationId ?? 'none'),
    queryFn: () =>
      api<{ messages: MessageDTO[] }>(`/conversations/${conversationId}/pins`).then(
        (data) => data.messages,
      ),
    enabled: Boolean(conversationId),
  });
}

export function useJoinRequests(conversationId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.joinRequests(conversationId ?? 'none'),
    queryFn: () =>
      api<{ requests: JoinRequestDTO[] }>(`/conversations/${conversationId}/join-requests`).then(
        (data) => data.requests,
      ),
    enabled: Boolean(conversationId) && enabled,
  });
}

type Preferences = { favorite?: boolean; archived?: boolean; muted?: boolean; draft?: string | null };

/**
 * Favorito, silenciado y archivado.
 *
 * **Se actualizan dos cachés, y antes sólo se actualizaba una.** La lista
 * lateral vive en `conversations`; la cabecera del chat lee el detalle, que vive
 * en `conversation(id)`. Al parchear sólo la lista, el mismo botón respondía al
 * instante desde el clic derecho de la barra lateral —que pinta desde la lista—
 * y se quedaba congelado desde los tres puntos del chat, que pinta desde el
 * detalle. Reportado justo así: «con click derecho sí que funciona bien».
 *
 * No era un fallo del menú: era que dos vistas de la misma cosa leen de sitios
 * distintos y sólo uno se enteraba.
 */
export function useConversationPreferences(conversationId: string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (input: Preferences) =>
      api(`/conversations/${conversationId}/preferences`, { method: 'PATCH', body: input }),
    onMutate: async (input) => {
      const claveLista = queryKeys.conversations(false);
      const claveDetalle = queryKeys.conversation(conversationId);

      await Promise.all([
        queryClient.cancelQueries({ queryKey: claveLista }),
        queryClient.cancelQueries({ queryKey: claveDetalle }),
      ]);

      const lista = queryClient.getQueryData<ConversationSummary[]>(claveLista);
      const detalle = queryClient.getQueryData<ConversationDetail>(claveDetalle);

      // Toggling a favourite should reorder the sidebar instantly.
      queryClient.setQueryData<ConversationSummary[]>(claveLista, (actual) =>
        actual?.map((item) => (item.id === conversationId ? { ...item, ...input } : item)),
      );
      queryClient.setQueryData<ConversationDetail>(claveDetalle, (actual) =>
        actual ? { ...actual, ...input } : actual,
      );

      return { lista, detalle, claveLista, claveDetalle };
    },
    onError: (_error, _input, context) => {
      if (!context) return;
      queryClient.setQueryData(context.claveLista, context.lista);
      queryClient.setQueryData(context.claveDetalle, context.detalle);
      toast.error(t.conversation.updateFailed);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations(false) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations(true) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversation(conversationId) });
    },
  });
}

export function useCreateGroup() {
  const t = useT();
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (input: CreateGroupInput) =>
      api<ConversationDetail>('/conversations', { method: 'POST', body: input }),
    onSuccess: (conversation) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations(false) });
      toast.success(t.toast.groupLive(conversation.name));
      router.push(`/chat/${conversation.id}`);
    },
    onError: (error) => toast.error(t.toast.groupCreateFailed, { description: error.message }),
  });
}

export function useUpdateConversation(conversationId: string) {
  const t = useT();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateConversationInput) =>
      api<ConversationDetail>(`/conversations/${conversationId}`, { method: 'PATCH', body: input }),
    onSuccess: (conversation) => {
      queryClient.setQueryData(queryKeys.conversation(conversationId), conversation);
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations(false) });
      toast.success(t.toast.groupUpdated);
    },
    onError: (error) => toast.error(t.toast.changesFailed, { description: error.message }),
  });
}

export function useOpenDirectConversation() {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) =>
      api<ConversationDetail>('/conversations/direct', { method: 'POST', body: { userId } }),
    onSuccess: (conversation) => {
      queryClient.setQueryData(queryKeys.conversation(conversation.id), conversation);
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations(false) });
      router.push(`/chat/${conversation.id}`);
    },
    onError: (error) => toast.error(t.toast.openChatFailed, { description: error.message }),
  });
}

export function useMemberMutations(conversationId: string) {
  const t = useT();
  const queryClient = useQueryClient();
  const router = useRouter();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.conversation(conversationId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.conversations(false) });
  };

  const addMembers = useMutation({
    mutationFn: (userIds: string[]) =>
      api<ConversationDetail>(`/conversations/${conversationId}/members`, {
        method: 'POST',
        body: { userIds },
      }),
    onSuccess: () => {
      invalidate();
      toast.success(t.toast.membersAdded);
    },
    onError: (error) => toast.error(t.toast.addMembersFailed, { description: error.message }),
  });

  const updateMember = useMutation({
    mutationFn: (input: { userId: string; role?: 'ADMIN' | 'MODERATOR' | 'MEMBER'; nickname?: string | null }) =>
      api<ConversationDetail>(`/conversations/${conversationId}/members/${input.userId}`, {
        method: 'PATCH',
        body: { role: input.role, nickname: input.nickname },
      }),
    onSuccess: () => {
      invalidate();
      toast.success(t.toast.memberUpdated);
    },
    onError: (error) => toast.error(t.toast.updateMemberFailed, { description: error.message }),
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) =>
      api(`/conversations/${conversationId}/members/${userId}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate();
      toast.success(t.toast.memberRemoved);
    },
    onError: (error) => toast.error(t.toast.removeMemberFailed, { description: error.message }),
  });

  const transferOwnership = useMutation({
    mutationFn: (userId: string) =>
      api<ConversationDetail>(`/conversations/${conversationId}/owner`, {
        method: 'POST',
        body: { userId },
      }),
    onSuccess: () => {
      invalidate();
      toast.success(t.toast.ownershipTransferred);
    },
    onError: (error) => toast.error(t.toast.transferFailed, { description: error.message }),
  });

  const leave = useMutation({
    mutationFn: (userId: string) =>
      api(`/conversations/${conversationId}/members/${userId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations(false) });
      router.push('/chat');
      toast.success(t.toast.left);
    },
    onError: (error) => toast.error(t.toast.leaveFailed, { description: error.message }),
  });

  const reviewJoinRequest = useMutation({
    mutationFn: (input: { requestId: string; status: 'APPROVED' | 'REJECTED' }) =>
      api(`/conversations/${conversationId}/join-requests/${input.requestId}`, {
        method: 'PATCH',
        body: { status: input.status },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.joinRequests(conversationId) });
      invalidate();
    },
    onError: (error) => toast.error(t.toast.reviewFailed, { description: error.message }),
  });

  return { addMembers, updateMember, removeMember, transferOwnership, leave, reviewJoinRequest };
}
