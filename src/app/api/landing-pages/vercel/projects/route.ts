import { NextResponse } from "next/server";
import { apiError, requireRole } from "@/server/auth";
import { availableProjects } from "@/server/landing-pages";
import { describeVercelError, logVercelError } from "@/server/vercel/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Listing every project in an account can be several upstream pages.
export const maxDuration = 30;

/**
 * What is available to import. Team-only: it enumerates the whole Vercel
 * account, which is more than the curated list a client is meant to see.
 */
export async function GET(req: Request) {
  const auth = await requireRole(req, "TEAM");
  if (auth instanceof NextResponse) return auth;

  try {
    return NextResponse.json(await availableProjects());
  } catch (err) {
    logVercelError("list projects", err);
    const failure = describeVercelError(err);
    return apiError(failure.status, failure.code, failure.message);
  }
}
