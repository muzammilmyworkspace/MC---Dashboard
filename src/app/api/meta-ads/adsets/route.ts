import { NextResponse } from "next/server";
import { apiError, requireAuth } from "@/server/auth";
import { listAdSetsForCampaign, type DatePreset } from "@/server/meta/ads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Scoped to one campaign — called when that campaign is expanded in the audit tree, never for the whole account at once. */
export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const params = new URL(req.url).searchParams;
  const campaignId = params.get("campaignId");
  const preset = (params.get("preset") ?? "last_30d") as DatePreset;
  if (!campaignId) return apiError(400, "VALIDATION", "campaignId is required");

  try {
    return NextResponse.json({ campaignId, preset, adSets: await listAdSetsForCampaign(campaignId, preset) });
  } catch (err) {
    console.error(`[meta-ads] adsets failed for campaign ${campaignId}: ${err instanceof Error ? err.message : err}`);
    return apiError(502, "META_ERROR", err instanceof Error ? err.message : "Marketing API request failed");
  }
}
