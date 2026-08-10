'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import type { DiscoverGroup } from '@/app/api/discover/route';
import type { PublicUser, SearchResults } from '@/types/dto';

export type SearchScope = 'all' | 'users' | 'conversations' | 'messages' | 'files';

const EMPTY: SearchResults = { users: [], conversations: [], messages: [], files: [] };

export function useGlobalSearch(term: string, scope: SearchScope = 'all', enabled = true) {
  const query = useDebouncedValue(term.trim(), 220);

  return useQuery({
    queryKey: queryKeys.search(query, scope),
    queryFn: () => api<SearchResults>('/search', { query: { q: query, scope } }),
    enabled: enabled && query.length >= 2,
    placeholderData: keepPreviousData,
    initialData: query.length < 2 ? EMPTY : undefined,
    staleTime: 15_000,
  });
}

export function useUserSearch(term: string) {
  const query = useDebouncedValue(term.trim(), 220);

  return useQuery({
    queryKey: queryKeys.userSearch(query),
    queryFn: () =>
      api<{ users: PublicUser[] }>('/users/search', { query: { q: query } }).then(
        (data) => data.users,
      ),
    enabled: query.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useDiscover(term: string) {
  const query = useDebouncedValue(term.trim(), 220);

  return useQuery({
    queryKey: queryKeys.discover(query),
    queryFn: () =>
      api<{ groups: DiscoverGroup[] }>('/discover', { query: { q: query } }).then(
        (data) => data.groups,
      ),
    placeholderData: keepPreviousData,
  });
}
