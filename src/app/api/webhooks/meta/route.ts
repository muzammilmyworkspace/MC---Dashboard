import { NextResponse } from "next/server";
import { verifyGithubSignature, safeEqual } from "@/server/crypto";
import { env } from "@/server/env";
import { metaWebhookVerifyToken } from "@/server/meta/config";
import { requireConnectedPage, recordInboundMessage, type InboundEvent } from "@/server/meta/messaging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ *
 *  Meta / Instagram webhook — public, unauthenticated.
 *
 *  Only Meta's own signature proves a request is genuine here, so this
 *  route deliberately does not call requireAuth. Nothing in this file
 *  logs a payload: Instagram webhook bodies carry message text, so a
 *  payload in a log line is a privacy incident even though it isn't a
 *  credential.
 * ------------------------------------------------------------------ */

/** Subscription handshake — Meta calls this once when the callback URL is saved. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token") ?? "";
  const challenge = url.searchParams.get("hub.challenge") ?? "";

  let expected: string;
  try {
    expected = metaWebhookVerifyToken();
  } catch {
    return new NextResponse("Webhook verify token not configured", { status: 503 });
  }

  if (mode === "subscribe" && safeEqual(token, expected)) {
    return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new NextResponse(null, { status: 403 });
}

type KnownField = "comments" | "mentions" | "messages" | "message_reactions" | "story_insights";
const KNOWN_FIELDS = new Set<KnownField>(["comments", "mentions", "messages", "message_reactions", "story_insights"]);

interface WebhookEntry {
  id?: string;
  time?: number;
  changes?: { field?: string }[];
  messaging?: InboundEvent[];
}

/**
 * Event receiver. Acknowledges first — Meta disables a subscription that is
 * slow to respond or that fails repeatedly — then processes afterward.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256") ?? undefined;

  if (!env.META_APP_SECRET) return new NextResponse(null, { status: 503 });
  if (!verifyGithubSignature(rawBody, signature, env.META_APP_SECRET)) {
    // Unsigned or forged. Never parse the body of an unverified request.
    return new NextResponse(null, { status: 401 });
  }

  void processPayload(rawBody).catch((err) => {
    console.error(`[meta-webhook] processing failed: ${err instanceof Error ? err.message : err}`);
  });

  return new NextResponse(null, { status: 200 });
}

async function processPayload(rawBody: string): Promise<void> {
  let payload: { object?: string; entry?: WebhookEntry[] };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    console.warn("[meta-webhook] could not parse a verified payload");
    return;
  }
  if (payload.object !== "instagram") return;

  const messagingEntries = (payload.entry ?? []).filter((e) => e.messaging?.length);
  if (messagingEntries.length === 0) return;

  const auth = await requireConnectedPage().catch(() => null);
  if (!auth) {
    console.warn("[meta-webhook] messages arrived but no Instagram connection is stored");
    return;
  }

  for (const entry of messagingEntries) {
    for (const event of entry.messaging ?? []) {
      // One bad event (a malformed payload, a duplicate id Meta redelivered) must not stop the rest.
      try {
        await recordInboundMessage(event, auth);
      } catch (err) {
        console.error(`[meta-webhook] failed to record one message: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  const otherFields = new Set<KnownField>();
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (typeof change.field === "string" && KNOWN_FIELDS.has(change.field as KnownField) && change.field !== "messages") {
        otherFields.add(change.field as KnownField);
      }
    }
  }
  if (otherFields.size > 0) {
    // Comments/mentions/etc. aren't handled yet — acknowledged, not silently dropped from awareness.
    console.log(`[meta-webhook] received unhandled field(s): ${[...otherFields].join(", ")}`);
  }
}
