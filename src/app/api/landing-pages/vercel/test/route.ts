import { NextResponse } from "next/server";
import { requireRole } from "@/server/auth";
import { testVercelConnection, vercelMissingEnv } from "@/server/vercel/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Always 200 with an ok flag.
 *
 * A failed credential check is a normal answer to "is this working?", not a
 * transport error — returning 502 would make the UI show a crash banner
 * instead of the explanation the user needs.
 */
export async function POST(req: Request) {
  const auth = await requireRole(req, "TEAM");
  if (auth instanceof NextResponse) return auth;

  const result = await testVercelConnection();
  return NextResponse.json({ ...result, missingEnv: vercelMissingEnv() });
}
