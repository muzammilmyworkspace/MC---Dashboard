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
 *   gained    — measured. Meta's `follower_count` insight: gross new follows
 *               that day. Verified live, returning real values.
 *   net       — measured. Difference between two of our own snapshots.
 *   lost      — DERIVED, not reported. Meta publishes no unfollow figure at
 *               any permission level, so this is gained − net, clamped at 0.
 *
 * The response labels `lost` as derived so the UI can never present it as a
 * measured number.
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

  return NextResponse.json({
    configured: true,
    range: from && to ? { from, to } : { days },
    rows,
    totals: {
      // Only sum days that actually have the figure; a partial window must
      // not read as a confident zero.
      gained: measured.reduce((s, r) => s + (r.gained ?? 0), 0),
      lost: measured.reduce((s, r) => s + (r.lost ?? 0), 0),
      net:
        observed.length > 1
          ? (observed[0].followers ?? 0) - (observed[observed.length - 1].followers ?? 0)
          : 0,
      daysWithGainData: measured.length,
      daysObserved: observed.length,
    },
    /** Tells the UI which columns are measured and which are inferred. */
    provenance: {
      followers: "measured",
      gained: "measured",
      net: "measured",
      lost: "derived",
      note: "Meta publishes no unfollow figure. `lost` is gained − net change, clamped at zero, and is an estimate.",
      source: "Instagram Graph API",
    },
  });
}
