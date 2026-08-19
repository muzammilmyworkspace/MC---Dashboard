import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { env } from "@/server/env";
import { getFollowerHistory } from "@/server/instagram/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Date-wise follower report.
 *
 * What each column actually is, because the distinction is the whole point:
 *
 *   followers — measured. Read from the profile at snapshot time.
 *   gained    — measured. Meta's follows_and_unfollows insight, FOLLOWER
 *               breakdown: gross new follows that day.
 *   lost      — measured. The same insight's NON_FOLLOWER breakdown. Meta
 *               does publish this; rows recorded before it was wired up
 *               still carry the old (gained − net) estimate and say so.
 *   net       — measured. gained − lost across the days that have both.
 *
 * Provenance is reported per row rather than asserted for the whole column,
 * because within one window some days can be measured and others estimated.
 */
export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const params = new URL(req.url).searchParams;
  const accountId = env.IG_BUSINESS_ACCOUNT_ID;

  if (!accountId) {
    return NextResponse.json({
      configured: false,
      message: "IG_BUSINESS_ACCOUNT_ID is not set.",
      rows: [],
      totals: null,
    });
  }

  // `days` covers the presets; from/to allow a custom range.
  const from = params.get("from");
  const to = params.get("to");
  const days = Math.min(365, Math.max(1, Number(params.get("days") ?? 30)));

  const history = await getFollowerHistory(from && to ? 365 : days, accountId);

  const rows = history
    .filter((d) => (from && to ? d.date >= from && d.date <= to : true))
    .slice()
    .reverse(); // newest first — a daily report is read top-down

  const measured = rows.filter((r) => r.gained !== null);
  const observed = rows.filter((r) => r.followers !== null);

  // Both halves must be present for a day to contribute to a total, so the
  // three figures describe the same set of days and can be added up by hand.
  const paired = rows.filter((r) => r.gained !== null && r.lost !== null);
  const gainedTotal = paired.reduce((s, r) => s + (r.gained ?? 0), 0);
  const lostTotal = paired.reduce((s, r) => s + (r.lost ?? 0), 0);

  return NextResponse.json({
    configured: true,
    range: from && to ? { from, to } : { days },
    rows,
    totals: {
      // Only sum days that actually have the figure; a partial window must
      // not read as a confident zero.
      gained: gainedTotal,
      lost: lostTotal,
      /**
       * gained − lost, not the gap between the first and last snapshot.
       *
       * Snapshots exist only for days the sync ran, so that gap covered a
       * few days while gained and lost covered the whole window — three
       * headline numbers that could not be reconciled with one another.
       */
      net: gainedTotal - lostTotal,
      daysWithGainData: measured.length,
      daysObserved: observed.length,
      daysPaired: paired.length,
    },
    /** Column-level provenance; individual rows carry their own lostSource. */
    provenance: {
      followers: "measured",
      gained: "measured",
      net: "measured",
      // Measured unless some row in this window predates the metric.
      lost: rows.some((r) => r.lostSource === "derived") ? "mixed" : "measured",
      note: "Meta reports how many people followed and unfollowed each day, but never who. Figures settle about two days after the day itself.",
      source: "Instagram Graph API",
    },
  });
}
