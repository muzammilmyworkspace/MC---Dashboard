import { NextResponse } from "next/server";
import { requireRole } from "@/server/auth";
import { syncInstagram } from "@/server/instagram/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A full sync pulls the profile, 30 days of insights and up to 50 posts with
// per-post insights, so it needs well beyond the default function timeout.
export const maxDuration = 60;

export async function POST(req: Request) {
  const auth = await requireRole(req, "TEAM");
  if (auth instanceof NextResponse) return auth;

  const result = await syncInstagram("manual");
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
