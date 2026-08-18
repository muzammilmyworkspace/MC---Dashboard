/* ------------------------------------------------------------------ *
 *  OAuth callback — HTTP tests
 *
 *  Boots the real Express app on an ephemeral port. No database is
 *  touched: every path exercised here fails or redirects before reaching
 *  Prisma. Outbound calls to Meta are stubbed, so nothing leaves the box.
 * ------------------------------------------------------------------ */
import { after, before, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";

// No Redis in tests. dotenv loads the real .env, so leaving REDIS_URL set
// opens a live connection — and an open socket keeps the event loop alive,
// so the test runner never exits. The in-process fallback is what these
// tests should exercise anyway.
process.env.REDIS_URL = "";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.JWT_ACCESS_SECRET = "test-access-secret-32-chars-minimum!!";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-32-chars-minimum!";
process.env.CORS_ORIGIN = "http://localhost:3000";
process.env.META_APP_ID = "1234567890123456";
process.env.META_APP_SECRET = "f".repeat(32);
process.env.META_INSTAGRAM_CONFIG_ID = "1038676265802072";
process.env.META_REDIRECT_URI = "http://localhost:4000/api/integrations/callback/meta";
process.env.META_GRAPH_VERSION = "v23.0";

const { createApp } = await import("../app.js");
const { signOAuthState } = await import("../services/integrations/meta-oauth.js");

const CALLBACK = "/api/integrations/callback/meta";

let server: Server;
let base: string;

before(async () => {
  server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  base = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

/** Follows nothing — we assert on the redirect itself. */
function call(path: string) {
  return fetch(`${base}${path}`, { redirect: "manual" });
}

function redirectParams(res: Response): URLSearchParams {
  const location = res.headers.get("location");
  assert.ok(location, "expected a redirect Location header");
  return new URL(location).searchParams;
}

describe("callback reachability", () => {
  it("is reachable without a Bearer token", async () => {
    // Meta redirects the browser here; a plain navigation carries no auth
    // header. A 401 would make the whole flow impossible.
    const res = await call(CALLBACK);
    assert.notEqual(res.status, 401);
    assert.equal(res.status, 302);
  });

  it("still guards the authenticated integration routes", async () => {
    for (const path of ["/api/integrations/meta/status", "/api/integrations/meta-graph/auth-url"]) {
      assert.equal((await call(path)).status, 401, `${path} should require auth`);
    }
  });
});

describe("user cancels at Meta", () => {
  it("reports a cancellation rather than an error", async () => {
    const res = await call(`${CALLBACK}?error=access_denied&error_reason=user_denied`);
    const params = redirectParams(res);
    assert.equal(params.get("status"), "error");
    assert.equal(params.get("reason"), "cancelled");
    assert.match(params.get("message") ?? "", /cancelled/i);
  });

  it("distinguishes a Meta-side denial from a user cancellation", async () => {
    const params = redirectParams(await call(`${CALLBACK}?error=server_error`));
    assert.equal(params.get("reason"), "denied");
  });
});

describe("state validation", () => {
  it("rejects a missing state", async () => {
    assert.equal(redirectParams(await call(`${CALLBACK}?code=abc`)).get("reason"), "invalid_state");
  });

  it("rejects a forged state", async () => {
    const params = redirectParams(await call(`${CALLBACK}?code=abc&state=forged`));
    assert.equal(params.get("reason"), "invalid_state");
  });

  it("rejects a state signed with another key", async () => {
    const jwt = (await import("jsonwebtoken")).default;
    const foreign = jwt.sign({ k: "meta-graph", n: "1" }, "attacker-key", {
      subject: "victim",
      expiresIn: "10m",
    });
    const params = redirectParams(await call(`${CALLBACK}?code=abc&state=${foreign}`));
    assert.equal(params.get("reason"), "invalid_state");
  });

  it("accepts a genuine state but still requires a code", async () => {
    const state = signOAuthState("user-abc");
    const params = redirectParams(await call(`${CALLBACK}?state=${state}`));
    assert.equal(params.get("reason"), "no_code");
  });
});

describe("authorization code exchange", () => {
  it("maps an expired code to a retry-able message", async () => {
    const realFetch = globalThis.fetch;
    const stub = mock.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: { message: "This authorization code has expired.", code: 100, error_subcode: 36007 },
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        )
    );

    // Only stub calls to Meta; the test's own request must use real fetch.
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) =>
      String(input).includes("graph.facebook.com")
        ? stub()
        : realFetch(input, init)) as typeof globalThis.fetch;

    try {
      const state = signOAuthState("user-abc");
      const params = redirectParams(await call(`${CALLBACK}?code=expired-code&state=${state}`));
      assert.equal(params.get("reason"), "expired_code");
      assert.match(params.get("message") ?? "", /expired/i);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

describe("redirect target", () => {
  it("returns the user to /instagram, where the Connect button lives", async () => {
    // Landing on /integrations meant the page that started the flow never
    // saw the result and never refreshed its status.
    const location = (await call(`${CALLBACK}?error=access_denied`)).headers.get("location") ?? "";
    assert.ok(new URL(location).pathname === "/instagram", location);
  });

  it("carries the outcome in the query string so the panel can react", async () => {
    const params = redirectParams(await call(`${CALLBACK}?error=access_denied&error_reason=user_denied`));
    assert.equal(params.get("integration"), "instagram");
    assert.ok(params.get("status"));
    assert.ok(params.get("reason"));
  });
});

describe("no open redirect", () => {
  it("ignores an attacker-supplied destination and uses CORS_ORIGIN", async () => {
    const res = await call(
      `${CALLBACK}?error=x&redirect_uri=https://evil.example.com&state=https://evil.example.com`
    );
    const location = res.headers.get("location") ?? "";
    assert.ok(location.startsWith("http://localhost:3000/"), location);
    assert.ok(!location.includes("evil.example.com"));
  });
});

describe("secret leakage", () => {
  it("never reflects credentials into the redirect URL", async () => {
    const state = signOAuthState("user-abc");
    const res = await call(`${CALLBACK}?code=super-secret-code&state=${state}`);
    const location = res.headers.get("location") ?? "";
    assert.ok(!location.includes("super-secret-code"));
    assert.ok(!location.includes(process.env.META_APP_SECRET!));
  });

  it("redacts the code and state from the request log", async () => {
    type WriteFn = typeof process.stdout.write;
    const realWrite: WriteFn = process.stdout.write.bind(process.stdout);
    const captured: string[] = [];

    process.stdout.write = ((chunk: Parameters<WriteFn>[0], ...rest: unknown[]) => {
      captured.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
      return (realWrite as (...args: unknown[]) => boolean)(chunk, ...rest);
    }) as WriteFn;

    try {
      await call(`${CALLBACK}?code=LEAKY_CODE_VALUE&state=LEAKY_STATE_VALUE`);
      // morgan writes after the response completes.
      await new Promise((resolve) => setTimeout(resolve, 50));
    } finally {
      process.stdout.write = realWrite;
    }

    const log = captured.join("");
    assert.ok(log.includes(CALLBACK), "the request should have been logged at all");
    assert.ok(!log.includes("LEAKY_CODE_VALUE"), "authorization code leaked into the log");
    assert.ok(!log.includes("LEAKY_STATE_VALUE"), "state leaked into the log");
    assert.ok(log.includes("redacted"), "expected the redaction marker");
  });
});
