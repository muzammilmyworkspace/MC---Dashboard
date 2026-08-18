import { NextResponse } from "next/server";
import { prisma } from "@/server/prisma";
import { envErrors } from "@/server/env";
import { redisEnabled } from "@/server/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Liveness + readiness. Safe to call without a database. */
export async function GET() {
  let db: "up" | "down" = "down";
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = "up";
  } catch {
    /* reported as down */
  }

  return NextResponse.json({
    status: "ok",
    service: "mc-nexus-api",
    db,
    redis: redisEnabled ? "enabled" : "disabled",
    // Names only — never values.
    configErrors: envErrors,
    timestamp: new Date().toISOString(),
  });
}
