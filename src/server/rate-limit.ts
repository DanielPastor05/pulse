import { errors } from '@/server/errors';
import { prisma } from '@/lib/prisma';

export type RateLimitRule = {
  /** Requests allowed per window. */
  limit: number;
  /** Length of the window in milliseconds. */
  windowMs: number;
};

export const rateLimits = {
  sendMessage: { limit: 25, windowMs: 10_000 },
  mutate: { limit: 60, windowMs: 60_000 },
  search: { limit: 60, windowMs: 60_000 },
  upload: { limit: 30, windowMs: 60_000 },
  auth: { limit: 10, windowMs: 60_000 },
} satisfies Record<string, RateLimitRule>;

/**
 * Fixed-window limiter backed by Postgres.
 *
 * One statement does the whole thing: the upsert either starts a fresh window
 * or increments the current one, and returns the resulting count. Because the
 * row is locked by the `on conflict` update, concurrent requests serialise —
 * two callers cannot both read "59" and both decide they are under the limit.
 *
 * Fixed window, not a token bucket: at a window boundary a caller can spend the
 * tail of one window and the head of the next back to back, so the real burst
 * ceiling is 2×limit. That is fine for blunting abuse and it costs one round
 * trip instead of the read-modify-write a bucket needs.
 */
export async function rateLimit(key: string, rule: RateLimitRule): Promise<void> {
  const seconds = rule.windowMs / 1000;

  const [row] = await prisma.$queryRaw<Array<{ count: number }>>`
    insert into rate_limits (key, "windowStart", count)
    values (${key}, now(), 1)
    on conflict (key) do update set
      count = case
        when rate_limits."windowStart" < now() - make_interval(secs => ${seconds}) then 1
        else rate_limits.count + 1
      end,
      "windowStart" = case
        when rate_limits."windowStart" < now() - make_interval(secs => ${seconds}) then now()
        else rate_limits."windowStart"
      end
    returning count
  `;

  if ((row?.count ?? 0) > rule.limit) throw errors.rateLimited();
}
