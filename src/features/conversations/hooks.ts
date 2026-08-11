'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
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

export function useConversationPreferences(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Preferences) =>
      api(`/conversations/${conversationId}/preferences`, { method: 'PATCH', body: input }),
    onMutate: async (input) => {
      // Toggling a favourite should reorder the sidebar instantly.
      const key = queryKeys.conversations(false);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ConversationSummary[]>(key);

      queryClient.setQueryData<ConversationSummary[]>(key, (list) =>
        list?.map((item) => (item.id === conversationId ? { ...item, ...input } : item)),
      );

      return { previous, key };
    },
    onError: (_error, _input, context) => {
      if (context) queryClient.setQueryData(context.key, context.previous);
      toast.error('Could not update that conversation');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations(false) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations(true) });
    },
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (input: CreateGroupInput) =>
      api<ConversationDetail>('/conversations', { method: 'POST', body: input }),
    onSuccess: (conversation) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations(false) });
      toast.success(`${conversation.name} is live`);
      router.push(`/chat/${conversation.id}`);
    },
    onError: (error) => toast.error('Could not create the group', { description: error.message }),
  });
}

export function useUpdateConversation(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateConversationInput) =>
      api<ConversationDetail>(`/conversations/${conversationId}`, { method: 'PATCH', body: input }),
    onSuccess: (conversation) => {
      queryClient.setQueryData(queryKeys.conversation(conversationId), conversation);
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations(false) });
      toast.success('Group updated');
    },
    onError: (error) => toast.error('Could not save changes', { description: error.message }),
  });
}

export function useOpenDirectConversation() {
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
    onError: (error) => toast.error('Could not open that chat', { description: error.message }),
  });
}

export function useMemberMutations(conversationId: string) {
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
      toast.success('Members added');
    },
    onError: (error) => toast.error('Could not add members', { description: error.message }),
  });

  const updateMember = useMutation({
    mutationFn: (input: { userId: string; role?: 'ADMIN' | 'MODERATOR' | 'MEMBER'; nickname?: string | null }) =>
      api<ConversationDetail>(`/conversations/${conversationId}/members/${input.userId}`, {
        method: 'PATCH',
        body: { role: input.role, nickname: input.nickname },
      }),
    onSuccess: () => {
      invalidate();
      toast.success('Member updated');
    },
    onError: (error) => toast.error('Could not update member', { description: error.message }),
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) =>
      api(`/conversations/${conversationId}/members/${userId}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate();
      toast.success('Member removed');
    },
    onError: (error) => toast.error('Could not remove member', { description: error.message }),
  });

  const transferOwnership = useMutation({
    mutationFn: (userId: string) =>
      api<ConversationDetail>(`/conversations/${conversationId}/owner`, {
        method: 'POST',
        body: { userId },
      }),
    onSuccess: () => {
      invalidate();
      toast.success('Ownership transferred');
    },
    onError: (error) => toast.error('Could not transfer ownership', { description: error.message }),
  });

  const leave = useMutation({
    mutationFn: (userId: string) =>
      api(`/conversations/${conversationId}/members/${userId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations(false) });
      router.push('/chat');
      toast.success('You left the conversation');
    },
    onError: (error) => toast.error('Could not leave', { description: error.message }),
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
    onError: (error) => toast.error('Could not review the request', { description: error.message }),
  });

  return { addMembers, updateMember, removeMember, transferOwnership, leave, reviewJoinRequest };
}
