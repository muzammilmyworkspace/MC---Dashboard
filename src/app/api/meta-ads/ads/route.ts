import { NextResponse } from "next/server";
import { apiError, requireAuth } from "@/server/auth";
import { listActiveAdsForAccount, listAdsForAdSet, type DatePreset } from "@/server/meta/ads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Two modes, both scoped to stay fast on an account with years of history:
 * `adsetId` returns the ads under one ad set (the audit tree, on expand);
 * `accountId` alone returns every ad with activity in the period (the
 * searchable "every ad copy" list).
 */
export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const params = new URL(req.url).searchParams;
  const adsetId = params.get("adsetId");
  const accountId = params.get("accountId");
  const preset = (params.get("preset") ?? "last_30d") as DatePreset;
  if (!adsetId && !accountId) return apiError(400, "VALIDATION", "adsetId or accountId is required");

  try {
    const ads = adsetId ? await listAdsForAdSet(adsetId, preset) : await listActiveAdsForAccount(accountId!, preset);
    return NextResponse.json({ adsetId, accountId, preset, ads });
  } catch (err) {
    console.error(`[meta-ads] ads failed (${adsetId ? `adset ${adsetId}` : `account ${accountId}`}): ${err instanceof Error ? err.message : err}`);
    return apiError(502, "META_ERROR", err instanceof Error ? err.message : "Marketing API request failed");
  }
}
