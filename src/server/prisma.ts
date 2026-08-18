import "server-only";
import { PrismaClient } from "@prisma/client";

/**
 * Prisma client, cached across serverless invocations.
 *
 * Vercel reuses a warm container for consecutive requests, so a new client
 * per request would open a new connection pool each time and exhaust the
 * database. Stashing it on globalThis survives module re-evaluation during
 * dev hot-reload and across warm invocations in production.
 *
 * DATABASE_URL must point at Neon's POOLED endpoint (host contains
 * "-pooler"); the direct endpoint runs out of connections under concurrency.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
