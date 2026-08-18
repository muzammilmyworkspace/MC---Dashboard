import { NextResponse } from "next/server";
import { env } from "@/server/env";
import { syncInstagram } from "@/server/instagram/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Replaces the in-process 6-hourly scheduler, which cannot exist on
 * serverless. Vercel Cron calls this on the schedule in vercel.json.
 *
 * This endpoint is load-bearing rather than a convenience: IgDailySnapshot
 * is the only source of follower history, Meta sells none, and a day missed
 * here is a permanent gap in the gained/unfollowed chart.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Without a
 * secret configured the route refuses to run rather than exposing a public
 * trigger that burns Meta API quota.
 */
export async function GET(req: Request) {
  const secret = env.CRON_SECRET;
  if (!secret) {
    console.warn("[cron] refused — CRON_SECRET is not set");
    return NextResponse.json(
      { error: { code: "NOT_CONFIGURED", message: "CRON_SECRET is not set" } },
      { status: 503 }
    );
  }

  const provided = req.headers.get("authorization");
  if (provided !== `Bearer ${secret}`) {
    // No detail — an unauthenticated prober learns nothing.
    return new NextResponse(null, { status: 401 });
  }

  const started = Date.now();
  const result = await syncInstagram("cron");
  console.log(
    `[cron] instagram sync ${result.ok ? "ok" : "failed"} in ${Date.now() - started}ms` +
      (result.ok ? ` · ${result.followers} followers, ${result.mediaSynced} posts` : ` · ${result.error}`)
  );

  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
