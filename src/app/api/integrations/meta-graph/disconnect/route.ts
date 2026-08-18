import { NextResponse } from "next/server";
import { requireRole } from "@/server/auth";
import { disconnectMeta, metaConnectionStatus } from "@/server/meta/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireRole(req, "TEAM");
  if (auth instanceof NextResponse) return auth;

  await disconnectMeta();
  return NextResponse.json(await metaConnectionStatus());
}
