'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import type { CurrentUser } from '@/types/dto';

const SessionContext = React.createContext<CurrentUser | null>(null);

/**
 * The signed-in profile, seeded from the server render so the first paint
 * already knows who you are, then kept live by TanStack Query.
 */
export function SessionProvider({
  initialUser,
  children,
}: {
  initialUser: CurrentUser;
  children: React.ReactNode;
}) {
  const { data } = useQuery({
    queryKey: queryKeys.me,
    queryFn: () => api<CurrentUser>('/me'),
    initialData: initialUser,
    staleTime: 60_000,
  });

  const user = data ?? initialUser;

  // Accent and motion preferences live on <html> so CSS variables cascade to
  // portals (dialogs, menus) that render outside the React tree.
  React.useEffect(() => {
    const root = document.documentElement;
    root.dataset.accent = user.accent;
    root.dataset.reducedMotion = String(user.reducedMotion);
  }, [user.accent, user.reducedMotion]);

  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

export function useSession(): CurrentUser {
  const user = React.useContext(SessionContext);
  if (!user) throw new Error('useSession must be used inside <SessionProvider>.');
  return user;
}

/** Optimistically patch the cached profile (settings toggles feel instant). */
export function useUpdateSessionCache() {
  const queryClient = useQueryClient();
  return React.useCallback(
    (patch: Partial<CurrentUser>) => {
      queryClient.setQueryData<CurrentUser>(queryKeys.me, (previous) =>
        previous ? { ...previous, ...patch } : previous,
      );
    },
    [queryClient],
  );
}
