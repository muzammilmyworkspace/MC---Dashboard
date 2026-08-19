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

  // Only days with a real profile reading can report a follower count —
  // backfilled days carry insights but no profile snapshot. `latest` is the
  // headline follower number; the window's movement comes from the measured
  // follow/unfollow pair below rather than from comparing two snapshots.
  const observed = history.filter((d) => d.followers !== null);
  const latest = observed.at(-1) ?? null;

  const integration = await prisma.integration.findUnique({ where: { key: "instagram-graph" } });
  const withDeltas = history.filter((d) => d.gained !== null && d.lost !== null);

  const gained = withDeltas.reduce((s, d) => s + (d.gained ?? 0), 0);
  const lost = withDeltas.reduce((s, d) => s + (d.lost ?? 0), 0);

  return NextResponse.json({
    configured: true,
    latest,
    totals: {
      gained,
      lost,
      /**
       * gained − lost over the SAME days, not the difference between the
       * first and last follower snapshot.
       *
       * Those snapshots exist only for days the sync actually ran, so the
       * old figure covered a handful of days while gained and lost covered
       * thirty — three headline numbers that could not be reconciled with
       * each other ("222 gained, 101 lost, net +25"). Both halves here are
       * measured by Meta for the same set of days, so their difference is
       * the exact net movement across them and the three now add up.
       */
      net: gained - lost,
      reach: history.reduce((s, d) => s + (d.reach ?? 0), 0),
      profileViews: history.reduce((s, d) => s + (d.profileViews ?? 0), 0),
      daysCovered: withDeltas.length,
    },
    history,
    lastSyncAt: integration?.lastSyncAt ?? null,
    health: integration?.health ?? "UNKNOWN",
  });
}
