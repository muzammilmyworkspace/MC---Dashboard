import { NextResponse } from "next/server";
import { apiError } from "@/server/auth";
import { requireConnectedAccount } from "@/server/meta/messaging";
import { env } from "@/server/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Temporary diagnostic: reads the connected account's conversations
 * directly from the Graph API, bypassing webhooks entirely. Used to find
 * out whether messages are actually reachable via a direct read even
 * though the webhook never delivers them. Removed once the real delivery
 * mechanism (webhook or polling) is settled.
 *
 * Guarded by a query-param secret instead of requireAuth — this is called
 * from outside the browser session (a plain curl), not the dashboard UI.
 */
export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (!secret || secret !== env.DEBUG_SECRET) return apiError(401, "UNAUTHORIZED", "Not authorized.");

  try {
    const account = await requireConnectedAccount();
    const url = `https://graph.instagram.com/${env.META_GRAPH_VERSION}/${account.igUserId}/conversations?fields=participants,updated_time,messages.limit(5){id,message,from,to,created_time}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${account.igAccessToken}` } });
    const body = await res.text();
    return NextResponse.json({ status: res.status, igUserId: account.igUserId, body: body.slice(0, 4000) });
  } catch (err) {
    return apiError(500, "DEBUG_ERROR", err instanceof Error ? err.message : "Unknown error");
  }
}
