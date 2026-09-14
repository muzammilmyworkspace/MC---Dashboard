import { NextResponse } from "next/server";
import { apiError, requireAuth } from "@/server/auth";
import { accountInsights } from "@/server/meta/ads";
import { parseDateRange } from "@/server/meta/ads-range";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const params = new URL(req.url).searchParams;
  const accountId = params.get("accountId");
  if (!accountId) return apiError(400, "VALIDATION", "accountId is required");

  const range = parseDateRange(params);
  if (!range) return apiError(400, "VALIDATION", "Provide either preset, or since and until as YYYY-MM-DD.");

  try {
    return NextResponse.json({ accountId, range, insights: await accountInsights(accountId, range) });
  } catch (err) {
    return apiError(502, "META_ERROR", err instanceof Error ? err.message : "Marketing API request failed");
  }
}
