/* ------------------------------------------------------------------ *
 *  Meta webhooks + data routes — HTTP tests
 *
 *  Boots the real Express app. No database and no outbound network:
 *  every path here is rejected or gated before either is reached.
 * ------------------------------------------------------------------ */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import type { Server } from "node:http";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.JWT_ACCESS_SECRET = "test-access-secret-32-chars-minimum!!";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-32-chars-minimum!";
process.env.CORS_ORIGIN = "http://localhost:3000";
process.env.META_APP_ID = "1234567890123456";
process.env.META_APP_SECRET = "f".repeat(32);
process.env.META_INSTAGRAM_CONFIG_ID = "1038676265802072";
process.env.META_REDIRECT_URI = "http://localhost:4000/api/integrations/callback/meta";
process.env.META_GRAPH_VERSION = "v23.0";
process.env.META_WEBHOOK_VERIFY_TOKEN = "webhook-verify-token-for-tests-1234";

const { createApp } = await import("../app.js");

const HOOK = "/api/integrations/webhooks/instagram";
const VERIFY = process.env.META_WEBHOOK_VERIFY_TOKEN;
const SECRET = process.env.META_APP_SECRET;

let server: Server;
let base: string;

before(async () => {
  server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function sign(body: string): string {
  return `sha256=${crypto.createHmac("sha256", SECRET).update(body).digest("hex")}`;
}

describe("webhook verification handshake", () => {
  it("echoes hub.challenge when the verify token matches", async () => {
    const res = await fetch(
      `${base}${HOOK}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(VERIFY)}&hub.challenge=abc123`
    );
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "abc123");
  });

  it("rejects a wrong verify token without explaining why", async () => {
    const res = await fetch(`${base}${HOOK}?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=abc123`);
    assert.equal(res.status, 403);
    const body = await res.text();
    assert.ok(!body.includes(VERIFY), "must not echo the expected token back");
  });

  it("rejects a missing verify token", async () => {
    assert.equal((await fetch(`${base}${HOOK}?hub.mode=subscribe&hub.challenge=abc`)).status, 403);
  });

  it("rejects a non-subscribe mode", async () => {
    const res = await fetch(
      `${base}${HOOK}?hub.mode=unsubscribe&hub.verify_token=${encodeURIComponent(VERIFY)}&hub.challenge=abc`
    );
    assert.equal(res.status, 403);
  });
});

describe("webhook event signature", () => {
  const payload = JSON.stringify({
    object: "instagram",
    entry: [{ id: "17841400000000000", time: 1, changes: [{ field: "comments" }] }],
  });

  it("accepts a correctly signed event", async () => {
    const res = await fetch(`${base}${HOOK}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-hub-signature-256": sign(payload) },
      body: payload,
    });
    assert.equal(res.status, 200);
  });

  it("rejects an unsigned event", async () => {
    const res = await fetch(`${base}${HOOK}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });
    assert.equal(res.status, 401);
  });

  it("rejects a tampered body", async () => {
    // Signature computed over the original, body altered in flight.
    const res = await fetch(`${base}${HOOK}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-hub-signature-256": sign(payload) },
      body: payload.replace("comments", "messages"),
    });
    assert.equal(res.status, 401);
  });

  it("rejects a signature made with the wrong secret", async () => {
    const forged = `sha256=${crypto.createHmac("sha256", "not-the-app-secret").update(payload).digest("hex")}`;
    const res = await fetch(`${base}${HOOK}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-hub-signature-256": forged },
      body: payload,
    });
    assert.equal(res.status, 401);
  });

  it("does not write the payload to the log", async () => {
    type WriteFn = typeof process.stdout.write;
    const realWrite: WriteFn = process.stdout.write.bind(process.stdout);
    const captured: string[] = [];
    process.stdout.write = ((chunk: Parameters<WriteFn>[0], ...rest: unknown[]) => {
      captured.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
      return (realWrite as (...args: unknown[]) => boolean)(chunk, ...rest);
    }) as WriteFn;

    const secretish = JSON.stringify({
      object: "instagram",
      entry: [{ id: "1", changes: [{ field: "messages", value: { text: "PRIVATE_MESSAGE_BODY" } }] }],
    });

    try {
      await fetch(`${base}${HOOK}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-hub-signature-256": sign(secretish) },
        body: secretish,
      });
      await new Promise((r) => setTimeout(r, 60));
    } finally {
      process.stdout.write = realWrite;
    }

    assert.ok(!captured.join("").includes("PRIVATE_MESSAGE_BODY"), "webhook payload leaked into the log");
  });
});

describe("dashboard data routes require authentication", () => {
  const routes = [
    "/api/integrations/meta-graph/status",
    "/api/integrations/meta-graph/capabilities",
    "/api/integrations/meta-graph/profile",
    "/api/integrations/meta-graph/media",
    "/api/integrations/meta-graph/insights",
    "/api/integrations/meta-graph/comments?mediaId=1",
    "/api/integrations/meta-graph/messages",
  ];

  it("returns 401 for every route without a token", async () => {
    for (const route of routes) {
      assert.equal((await fetch(`${base}${route}`)).status, 401, `${route} must require auth`);
    }
  });

  it("returns 401 for the write routes too", async () => {
    for (const route of ["comments/reply", "comments/hide", "disconnect"]) {
      const res = await fetch(`${base}/api/integrations/meta-graph/${route}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      assert.equal(res.status, 401, `${route} must require auth`);
    }
  });

  it("never leaks the app secret in an unauthenticated response", async () => {
    for (const route of routes) {
      const body = await (await fetch(`${base}${route}`)).text();
      assert.ok(!body.includes(SECRET), `${route} leaked the app secret`);
    }
  });
});
