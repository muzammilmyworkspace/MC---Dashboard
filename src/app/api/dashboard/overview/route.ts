import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { getDashboardOverview } from "@/server/dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

/** One request for the whole executive overview. See server/dashboard.ts. */
export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const days = Math.min(365, Math.max(1, Number(new URL(req.url).searchParams.get("days") ?? 30)));
  return NextResponse.json(await getDashboardOverview(days));
}
