import { prisma } from '@/lib/prisma';
import { json, route } from '@/server/http';

export const dynamic = 'force-dynamic';

/**
 * Liveness and readiness in one endpoint.
 *
 * Deliberately unauthenticated: whatever checks this — a container orchestrator,
 * an uptime monitor, a load balancer — has no session and should not need one.
 * It therefore reports only what is safe to publish: whether the database
 * answers, how long that took, and which region answered. No versions, no
 * connection strings, no counts that would reveal how much data exists.
 *
 * The round-trip number is the useful part. Application code and database live
 * in different places, and when they drift apart every query pays for it; a
 * single number here makes that visible without attaching a profiler.
 */
export const GET = route(async () => {
  const startedAt = performance.now();

  let database: 'up' | 'down' = 'up';
  try {
    await prisma.$queryRaw`select 1`;
  } catch {
    database = 'down';
  }

  const databaseMs = Math.round(performance.now() - startedAt);

  return json(
    {
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      databaseMs,
      region: process.env.VERCEL_REGION ?? 'local',
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    },
    { status: database === 'up' ? 200 : 503 },
  );
});
