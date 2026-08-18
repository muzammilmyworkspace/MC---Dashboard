import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { prisma } from "@/server/prisma";
import { platformIntegrations } from "@/server/integrations-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Merged DB state + static metadata. Credentials never leave the server. */
export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const rows = await prisma.integration.findMany();
  const byKey = new Map(rows.map((r) => [r.key, r]));

  return NextResponse.json({
    integrations: platformIntegrations.map((p) => {
      const row = byKey.get(p.key);
      return {
        key: p.key,
        name: p.name,
        category: p.category,
        status: row?.status ?? "NOT_CONNECTED",
        health: row?.health ?? "UNKNOWN",
        lastSyncAt: row?.lastSyncAt ?? null,
        configured: p.requiredEnv.every((e) => Boolean(process.env[e])),
        missingEnv: p.requiredEnv.filter((e) => !process.env[e]),
        scopes: p.scopes,
        docsUrl: p.docsUrl,
      };
    }),
  });
}
