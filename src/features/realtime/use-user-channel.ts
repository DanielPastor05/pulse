'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

import { authorizeRealtime, getSupabaseBrowserClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query-keys';
import { realtimeChannels, realtimeEvents } from '@/lib/realtime';
import { playChime, showDesktopNotification } from '@/features/notifications/sound';
import { useSession } from '@/components/providers/session-provider';
import type { NotificationDTO } from '@/types/dto';

/**
 * The signed-in user's private channel: notifications and inbox invalidations
 * for conversations that are not currently open.
 */
export function useUserChannel() {
  const me = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Preferences are read through a ref so changing them never re-subscribes.
  const preferences = React.useRef(me.notifications);
  preferences.current = me.notifications;

  React.useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase.channel(realtimeChannels.user(me.id), {
      config: { private: true },
    });

    channel
      .on('broadcast', { event: realtimeEvents.notification }, ({ payload }) => {
        const { notification } = payload as { notification: NotificationDTO };
        const settings = preferences.current;

        const wanted =
          notification.kind === 'MENTION'
            ? settings.onMention
            : notification.kind === 'REACTION'
              ? settings.onReaction
              : notification.kind === 'MESSAGE'
                ? settings.onMessage
                : true;

        queryClient.setQueryData<{ notifications: NotificationDTO[]; unread: number }>(
          queryKeys.notifications,
          (data) =>
            data
              ? {
                  unread: data.unread + 1,
                  notifications: [notification, ...data.notifications].slice(0, 50),
                }
              : data,
        );

        if (!wanted) return;
        if (settings.sounds) playChime(notification.kind === 'MENTION' ? 'mention' : 'incoming');

        if (settings.desktopPush) {
          showDesktopNotification({
            title: notification.title,
            body: notification.body,
            icon: notification.actor?.avatarUrl ?? undefined,
            tag: notification.conversationId ?? notification.id,
            onClick: () => {
              if (notification.conversationId) router.push(`/chat/${notification.conversationId}`);
            },
          });
        }
      })
      .on('broadcast', { event: realtimeEvents.inboxUpdated }, () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.conversations(false) });
      });

    void authorizeRealtime().then(() => channel.subscribe());

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [me.id, queryClient, router]);
}
