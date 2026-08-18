import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { metaConnectionStatus } from "@/server/meta/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json(await metaConnectionStatus());
}
