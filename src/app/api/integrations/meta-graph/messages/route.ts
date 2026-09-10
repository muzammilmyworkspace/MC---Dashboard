import { NextResponse } from "next/server";
import { apiError, requireAuth } from "@/server/auth";
import { metaConfigStatus } from "@/server/meta/config";
import { metaConnectionStatus } from "@/server/meta/oauth";
import { listConversations } from "@/server/meta/messaging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Every conversation, optionally filtered — the inbox list. */
export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const params = new URL(req.url).searchParams;
  const search = params.get("search")?.trim() || undefined;
  const unrepliedOver24h = params.get("unrepliedOver24h") === "true";

  const [status, config] = await Promise.all([metaConnectionStatus(), Promise.resolve(metaConfigStatus())]);
  const available = status.connected;

  try {
    const conversations = available ? await listConversations({ search, unrepliedOver24h }) : [];
    return NextResponse.json({
      available,
      reason: available ? "" : status.message,
      missing: status.missing,
      webhookConfigured: config.webhooksConfigured,
      conversations,
      setupRequired: !available,
    });
  } catch (err) {
    console.error(`[messages] list failed: ${err instanceof Error ? err.message : err}`);
    return apiError(500, "MESSAGES_ERROR", "Could not load conversations.");
  }
}
