'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import type { NotificationDTO } from '@/types/dto';

type NotificationsResponse = { notifications: NotificationDTO[]; unread: number };

export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => api<NotificationsResponse>('/notifications'),
    staleTime: 20_000,
  });
}

export function useNotificationActions() {
  const queryClient = useQueryClient();

  const markAllRead = useMutation({
    mutationFn: () => api('/notifications', { method: 'POST' }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications });
      const previous = queryClient.getQueryData<NotificationsResponse>(queryKeys.notifications);
      const now = new Date().toISOString();

      queryClient.setQueryData<NotificationsResponse>(queryKeys.notifications, (data) =>
        data
          ? {
              unread: 0,
              notifications: data.notifications.map((item) => ({
                ...item,
                readAt: item.readAt ?? now,
              })),
            }
          : data,
      );

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.notifications, context.previous);
      }
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api(`/notifications/${id}`, { method: 'PATCH' }),
    onMutate: async (id) => {
      const now = new Date().toISOString();
      queryClient.setQueryData<NotificationsResponse>(queryKeys.notifications, (data) =>
        data
          ? {
              unread: Math.max(0, data.unread - 1),
              notifications: data.notifications.map((item) =>
                item.id === id ? { ...item, readAt: item.readAt ?? now } : item,
              ),
            }
          : data,
      );
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  });

  return { markAllRead, markRead };
}
