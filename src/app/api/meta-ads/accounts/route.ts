import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { adsAvailability } from "@/server/meta/ads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ad accounts, plus whether the Marketing API is reachable at all.
 *
 * Availability is proven by calling the API, not inferred from granted
 * scopes: a scope does not guarantee the token can see an ad account.
 */
export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json(await adsAvailability());
}
