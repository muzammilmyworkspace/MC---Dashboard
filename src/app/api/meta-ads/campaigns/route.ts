import { NextResponse } from "next/server";
import { apiError, requireAuth } from "@/server/auth";
import { listCampaigns, type DatePreset } from "@/server/meta/ads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const params = new URL(req.url).searchParams;
  const accountId = params.get("accountId");
  const preset = (params.get("preset") ?? "last_30d") as DatePreset;
  if (!accountId) return apiError(400, "VALIDATION", "accountId is required");

  try {
    return NextResponse.json({ accountId, preset, campaigns: await listCampaigns(accountId, preset) });
  } catch (err) {
    return apiError(502, "META_ERROR", err instanceof Error ? err.message : "Marketing API request failed");
  }
}
