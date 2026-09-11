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
    const base = `https://graph.instagram.com/${env.META_GRAPH_VERSION}/${account.igUserId}`;
    const auth = { Authorization: `Bearer ${account.igAccessToken}` };

    const [conversations, subscribedGet, subscribePost, me] = await Promise.all([
      fetch(`${base}/conversations?fields=participants,updated_time,messages.limit(5){id,message,from,to,created_time}`, { headers: auth }).then(async (r) => ({ status: r.status, body: (await r.text()).slice(0, 1000) })),
      fetch(`${base}/subscribed_apps`, { headers: auth }).then(async (r) => ({ status: r.status, body: (await r.text()).slice(0, 1000) })),
      fetch(`${base}/subscribed_apps?subscribed_fields=messages`, { method: "POST", headers: auth }).then(async (r) => ({ status: r.status, body: (await r.text()).slice(0, 1000) })),
      fetch(`${base.replace(account.igUserId, "me")}?fields=id,username,account_type`, { headers: auth }).then(async (r) => ({ status: r.status, body: (await r.text()).slice(0, 1000) })),
    ]);

    return NextResponse.json({ igUserId: account.igUserId, me, conversations, subscribedGet, subscribePost });
  } catch (err) {
    return apiError(500, "DEBUG_ERROR", err instanceof Error ? err.message : "Unknown error");
  }
}
