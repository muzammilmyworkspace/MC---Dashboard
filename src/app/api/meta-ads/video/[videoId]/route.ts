import { NextResponse } from "next/server";
import { apiError, requireAuth } from "@/server/auth";
import { getVideoSource } from "@/server/meta/ads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/** Fetched lazily, only when someone hovers a video ad — never in bulk. */
export async function GET(req: Request, { params }: { params: Promise<{ videoId: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { videoId } = await params;
  try {
    return NextResponse.json(await getVideoSource(videoId));
  } catch (err) {
    console.error(`[meta-ads] video source failed for ${videoId}: ${err instanceof Error ? err.message : err}`);
    return apiError(502, "META_ERROR", err instanceof Error ? err.message : "Marketing API request failed");
  }
}
