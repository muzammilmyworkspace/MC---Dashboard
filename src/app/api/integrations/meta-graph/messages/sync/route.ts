import { NextResponse } from "next/server";
import { apiError, requireAuth } from "@/server/auth";
import { syncHistoricalConversations, MessagingUnavailableError } from "@/server/meta/messaging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One-time pull of conversation history that predates the webhook subscription. */
export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const result = await syncHistoricalConversations();
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof MessagingUnavailableError) return apiError(502, err.code.toUpperCase(), err.message);
    console.error(`[messages] sync failed: ${err instanceof Error ? err.message : err}`);
    return apiError(500, "MESSAGES_ERROR", "Could not import conversation history.");
  }
}
