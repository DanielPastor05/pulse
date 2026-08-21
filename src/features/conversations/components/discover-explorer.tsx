'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Check, Compass, Hash, Search, ShieldCheck, Users } from 'lucide-react';
import { toast } from 'sonner';

import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import { useDiscover } from '@/features/search/hooks';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/misc';
import { Skeleton } from '@/components/ui/skeleton';
import { useT } from '@/i18n/provider';

export function DiscoverExplorer() {
  const t = useT();
  const [term, setTerm] = React.useState('');
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: groups, isLoading } = useDiscover(term);

  const join = useMutation({
    mutationFn: (conversationId: string) =>
      api<{ joined: boolean }>(`/conversations/${conversationId}/join`, {
        method: 'POST',
        body: { message: '' },
      }),
    onSuccess: (result, conversationId) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.discover(term.trim()) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations(false) });
      if (result.joined) router.push(`/chat/${conversationId}`);
      else toast.success(t.nav.requestSent, { description: t.nav.requestSentHint });
    },
    onError: (error) => toast.error(t.nav.joinFailed, { description: error.message }),
  });

  return (
    <div className="panel flex h-full flex-col overflow-hidden rounded-[var(--radius-panel)] shadow-[var(--shadow-raised)]">
      <header className="space-y-4 border-b border-[var(--hairline)] p-5 pb-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">{t.nav.discover}</h1>
          <p className="text-[13px] text-[var(--text-2)]">
            {t.nav.discoverHint}
          </p>
        </div>
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={t.nav.searchGroups}
          icon={<Search />}
          className="max-w-md"
        />
      </header>

      <div className="scroll-area flex-1 overflow-y-auto p-5 pb-24 lg:pb-5">
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-40 rounded-[var(--radius-card)]" />
            ))}
          </div>
        ) : !groups || groups.length === 0 ? (
          <EmptyState
            icon={<Compass />}
            title={term ? t.nav.noPublicMatch : t.nav.noPublic}
            description={
              term
                ? t.nav.noPublicMatchHint
                : t.nav.noPublicHint
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {groups.map((group, index) => (
              <motion.article
                key={group.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.3), ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  'group relative flex flex-col gap-3 overflow-hidden rounded-[var(--radius-card)] p-4',
                  'border border-[var(--hairline)] bg-[var(--surface)]',
                  'transition-all duration-300 ease-[var(--ease-out)]',
                  'hover:-translate-y-0.5 hover:border-[var(--hairline-strong)] hover:shadow-[var(--shadow-overlay)]',
                )}
              >
                <div
                  className="absolute inset-x-0 top-0 h-20 opacity-15 transition-opacity duration-300 group-hover:opacity-25"
                  style={{
                    backgroundImage: 'linear-gradient(135deg, var(--accent), var(--accent))',
                  }}
                  aria-hidden
                />

                <div className="relative flex items-start gap-3">
                  {group.avatarUrl ? (
                    <Avatar src={group.avatarUrl} name={group.name} size="lg" />
                  ) : (
                    <span className="bg-[var(--accent)] grid size-12 shrink-0 place-items-center rounded-[var(--radius-card)] text-white shadow-[var(--shadow-raised)]">
                      <Hash className="size-6" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-[15px] font-semibold">{group.name}</h2>
                    <p className="flex items-center gap-1 text-[12px] text-[var(--text-3)]">
                      <Users className="size-3" />
                      {group.memberCount} member{group.memberCount === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>

                <p className="relative line-clamp-2 min-h-[2.5rem] text-[13px] leading-relaxed text-[var(--text-2)]">
                  {group.description ?? t.nav.noDescription}
                </p>

                <div className="relative flex items-center justify-between gap-2">
                  {group.requiresApproval ? (
                    <Badge>
                      <ShieldCheck className="size-3" />
                      {t.nav.approval}
                    </Badge>
                  ) : (
                    <Badge tone="success">{t.nav.open}</Badge>
                  )}

                  {group.isMember ? (
                    <Button size="sm" variant="secondary" onClick={() => router.push(`/chat/${group.id}`)}>
                      <Check />
                      {t.nav.open}
                    </Button>
                  ) : group.requested ? (
                    <Button size="sm" variant="ghost" disabled>
                      {t.nav.requested}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => join.mutate(group.id)}
                      loading={join.isPending && join.variables === group.id}
                    >
                      {t.nav.join}
                    </Button>
                  )}
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
