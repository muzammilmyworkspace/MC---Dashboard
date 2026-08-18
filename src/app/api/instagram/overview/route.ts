import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { env } from "@/server/env";
import { prisma } from "@/server/prisma";
import { isConfigured } from "@/server/instagram/client";
import { getFollowerHistory } from "@/server/instagram/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const days = Math.min(365, Math.max(1, Number(new URL(req.url).searchParams.get("days") ?? 30)));
  const accountId = env.IG_BUSINESS_ACCOUNT_ID;

  if (!isConfigured() || !accountId) {
    return NextResponse.json({
      configured: false,
      message: "Set META_ACCESS_TOKEN and IG_BUSINESS_ACCOUNT_ID, then run a sync.",
      history: [], totals: null, latest: null,
    });
  }

  const history = await getFollowerHistory(days, accountId);

  // Only days with a real profile reading can anchor a total — backfilled
  // days carry insights but no follower count.
  const observed = history.filter((d) => d.followers !== null);
  const latest = observed.at(-1) ?? null;
  const first = observed[0] ?? null;

  const integration = await prisma.integration.findUnique({ where: { key: "instagram-graph" } });
  const withDeltas = history.filter((d) => d.gained !== null && d.lost !== null);

  return NextResponse.json({
    configured: true,
    latest,
    totals: {
      gained: withDeltas.reduce((s, d) => s + (d.gained ?? 0), 0),
      lost: withDeltas.reduce((s, d) => s + (d.lost ?? 0), 0),
      net: first && latest ? (latest.followers ?? 0) - (first.followers ?? 0) : 0,
      reach: history.reduce((s, d) => s + (d.reach ?? 0), 0),
      profileViews: history.reduce((s, d) => s + (d.profileViews ?? 0), 0),
      daysCovered: withDeltas.length,
    },
    history,
    lastSyncAt: integration?.lastSyncAt ?? null,
    health: integration?.health ?? "UNKNOWN",
  });
}
