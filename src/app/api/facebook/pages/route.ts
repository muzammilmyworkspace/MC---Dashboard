import { NextResponse } from "next/server";
import { apiError, requireAuth } from "@/server/auth";
import { listPages } from "@/server/meta/pages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    return NextResponse.json({ pages: await listPages() });
  } catch (err) {
    return apiError(502, "META_ERROR", err instanceof Error ? err.message : "Could not load Pages");
  }
}
