import { PrismaClient } from '@prisma/client';

import { isProduction } from '@/lib/env';

/**
 * A single PrismaClient per process. Next.js dev-mode hot reload re-evaluates
 * modules, so the instance is cached on globalThis to avoid exhausting the
 * connection pool.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProduction ? ['error'] : ['warn', 'error'],
    // Prisma gives up waiting for a free connection after 2s by default and
    // throws P2028. Under a burst of concurrent writes that turns queueing —
    // which resolves on its own — into 500s. Waiting is the correct behaviour
    // here; the rate limiter is what caps the burst.
    transactionOptions: { maxWait: 10_000, timeout: 15_000 },
  });

if (!isProduction) globalForPrisma.prisma = prisma;
