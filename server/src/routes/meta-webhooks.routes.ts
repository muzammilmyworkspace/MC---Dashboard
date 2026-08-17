/* ------------------------------------------------------------------ *
 *  Meta / Instagram webhooks
 *
 *  Mounted before the JSON body parser so the signature can be checked
 *  against the exact bytes Meta sent — re-serialising the parsed body
 *  changes whitespace and key order, and the HMAC would never match.
 *
 *  Nothing here logs a payload. Instagram webhook bodies carry message
 *  text and commenter handles, so a payload in a log file is a privacy
 *  incident even though it isn't a credential.
 * ------------------------------------------------------------------ */
import { Router, raw } from "express";
import crypto from "node:crypto";
import { env } from "../env.js";
import { safeEqual } from "../lib/crypto.js";
import { emitWorkspace } from "../realtime/io.js";

export const metaWebhookRouter = Router();

/** Meta signs with sha256 HMAC of the raw body, keyed on the app secret. */
function verifyMetaSignature(rawBody: string, signature: string | undefined): boolean {
  if (!signature || !env.META_APP_SECRET) return false;
  const digest = `sha256=${crypto.createHmac("sha256", env.META_APP_SECRET).update(rawBody).digest("hex")}`;
  return safeEqual(digest, signature);
}

/**
 * Subscription handshake. Meta calls this once when you save the callback
 * URL and expects hub.challenge echoed back as plain text.
 */
metaWebhookRouter.get("/instagram", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (!env.META_WEBHOOK_VERIFY_TOKEN) {
    console.warn("[meta-webhook] verification attempted but META_WEBHOOK_VERIFY_TOKEN is not set");
    return res.status(503).type("text/plain").send("Webhook verify token not configured");
  }

  const expected = env.META_WEBHOOK_VERIFY_TOKEN;
  const provided = typeof token === "string" ? token : "";

  // Timing-safe: the verify token is a shared secret.
  if (mode === "subscribe" && provided && safeEqual(provided, expected)) {
    return res.status(200).type("text/plain").send(typeof challenge === "string" ? challenge : "");
  }

  // No detail about why — an attacker probing this shouldn't learn anything.
  return res.sendStatus(403);
});

/** Event fields we know how to interpret. Anything else is acknowledged and ignored. */
type KnownField = "comments" | "mentions" | "messages" | "message_reactions" | "story_insights";
const KNOWN_FIELDS = new Set<KnownField>([
  "comments", "mentions", "messages", "message_reactions", "story_insights",
]);

interface WebhookEntry {
  id?: string;
  time?: number;
  changes?: { field?: string }[];
  messaging?: unknown[];
}

/**
 * Event receiver.
 *
 * Meta retries and eventually disables a subscription that is slow, so this
 * acknowledges first and does the work afterwards on the next tick.
 */
metaWebhookRouter.post("/instagram", raw({ type: "*/*", limit: "1mb" }), (req, res) => {
  const rawBody = req.body instanceof Buffer ? req.body.toString("utf8") : "";
  const signature = req.get("x-hub-signature-256");

  if (!env.META_APP_SECRET) {
    console.warn("[meta-webhook] event rejected — META_APP_SECRET is not set");
    return res.sendStatus(503);
  }
  if (!verifyMetaSignature(rawBody, signature)) {
    // Unsigned or forged. Never parse the body of an unverified request.
    return res.sendStatus(401);
  }

  // Acknowledge before processing — Meta's timeout is short.
  res.sendStatus(200);

  setImmediate(() => {
    try {
      const payload = JSON.parse(rawBody) as { object?: string; entry?: WebhookEntry[] };
      if (payload.object !== "instagram") return;

      for (const entry of payload.entry ?? []) {
        const fields = (entry.changes ?? [])
          .map((c) => c.field)
          .filter((f): f is KnownField => typeof f === "string" && KNOWN_FIELDS.has(f as KnownField));

        if (entry.messaging?.length) fields.push("messages");

        for (const field of new Set(fields)) {
          // Field name and account id only — never the payload contents.
          emitWorkspace("instagram:webhook", { field, accountId: entry.id ?? null });
        }
      }
    } catch {
      // A malformed body from a correctly-signed request is not actionable,
      // and its contents must not reach the log.
      console.warn("[meta-webhook] could not parse a verified payload");
    }
  });
});
