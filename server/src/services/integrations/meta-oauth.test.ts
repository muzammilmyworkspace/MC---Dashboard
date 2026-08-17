/* ------------------------------------------------------------------ *
 *  Meta OAuth — unit tests
 *
 *  Runs on the built-in node:test runner via tsx. No database and no
 *  network: every value below is fabricated, and the one test that
 *  reaches the network stubs global fetch so nothing leaves the machine.
 *
 *  These do NOT replace the manual Meta login test — a stubbed response
 *  cannot prove the real app configuration is correct.
 * ------------------------------------------------------------------ */
import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";

/*
 * Set before importing anything that pulls env.ts, which parses at import
 * time. dotenv does not override variables already present in process.env,
 * so these win over whatever sits in server/.env — the suite never depends
 * on real credentials.
 */
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.JWT_ACCESS_SECRET = "test-access-secret-32-chars-minimum!!";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-32-chars-minimum!";
process.env.CORS_ORIGIN = "http://localhost:3000";
process.env.META_APP_ID = "1234567890123456";
process.env.META_APP_SECRET = "f".repeat(32);
process.env.META_INSTAGRAM_CONFIG_ID = "1038676265802072";
process.env.META_REDIRECT_URI = "http://localhost:4000/api/integrations/callback/meta";
process.env.META_GRAPH_VERSION = "v23.0";

const { buildAuthorizeUrl, signOAuthState, verifyOAuthState, MetaOAuthError, completeOAuth } =
  await import("./meta-oauth.js");
const { metaConfigStatus } = await import("./meta-config.js");
const { encryptJson, decryptJson } = await import("../../lib/crypto.js");

const SECRET = process.env.META_APP_SECRET;

describe("authorization URL", () => {
  it("uses the Facebook Login for Business configuration id", () => {
    const url = new URL(buildAuthorizeUrl("state-1"));
    assert.equal(url.searchParams.get("config_id"), "1038676265802072");
  });

  it("does NOT send a scope parameter", () => {
    // Login for Business takes permissions from the configuration; a scope
    // here is ignored by Meta and misleads whoever reads this code next.
    const url = new URL(buildAuthorizeUrl("state-1"));
    assert.equal(url.searchParams.get("scope"), null);
  });

  it("targets the configured Graph version and redirect URI", () => {
    const url = new URL(buildAuthorizeUrl("state-1"));
    assert.ok(url.pathname.startsWith("/v23.0/dialog/oauth"), url.pathname);
    assert.equal(
      url.searchParams.get("redirect_uri"),
      "http://localhost:4000/api/integrations/callback/meta"
    );
    assert.equal(url.searchParams.get("response_type"), "code");
  });

  it("never puts the app secret in the URL", () => {
    assert.ok(!buildAuthorizeUrl("state-1").includes(SECRET));
  });
});

describe("OAuth state", () => {
  it("round-trips the initiating user id", () => {
    const state = signOAuthState("user-abc");
    assert.equal(verifyOAuthState(state).userId, "user-abc");
  });

  it("rejects a missing state", () => {
    assert.throws(() => verifyOAuthState(undefined), MetaOAuthError);
  });

  it("rejects a forged state", () => {
    assert.throws(() => verifyOAuthState("not-a-jwt"), MetaOAuthError);
  });

  it("rejects a state signed with a different key", async () => {
    const jwt = (await import("jsonwebtoken")).default;
    const foreign = jwt.sign({ k: "meta-graph", n: "x" }, "some-other-signing-key", {
      subject: "user-abc",
      expiresIn: "10m",
    });
    assert.throws(() => verifyOAuthState(foreign), MetaOAuthError);
  });

  it("rejects an expired state", async () => {
    const jwt = (await import("jsonwebtoken")).default;
    const expired = jwt.sign({ k: "meta-graph", n: "x" }, process.env.JWT_ACCESS_SECRET!, {
      subject: "user-abc",
      expiresIn: "-1s",
    });
    assert.throws(() => verifyOAuthState(expired), MetaOAuthError);
  });

  it("rejects a state minted for a different integration", async () => {
    const jwt = (await import("jsonwebtoken")).default;
    const wrongKey = jwt.sign({ k: "google-ads", n: "x" }, process.env.JWT_ACCESS_SECRET!, {
      subject: "user-abc",
      expiresIn: "10m",
    });
    assert.throws(() => verifyOAuthState(wrongKey), MetaOAuthError);
  });

  it("does not leak the signing secret into the state", () => {
    assert.ok(!signOAuthState("user-abc").includes(process.env.JWT_ACCESS_SECRET!));
  });
});

describe("credential encryption", () => {
  it("round-trips stored credentials", () => {
    const creds = { userAccessToken: "EAAG-secret-token", pageAccessToken: "EAAG-page-token" };
    assert.deepEqual(decryptJson(encryptJson(creds)), creds);
  });

  it("produces ciphertext that does not contain the plaintext token", () => {
    const blob = encryptJson({ userAccessToken: "EAAG-secret-token" });
    assert.ok(!blob.includes("EAAG-secret-token"));
    assert.ok(blob.startsWith("v1:"));
  });

  it("gives a different ciphertext each time (random IV)", () => {
    const value = { userAccessToken: "EAAG-secret-token" };
    assert.notEqual(encryptJson(value), encryptJson(value));
  });

  it("refuses to decrypt tampered ciphertext", () => {
    const blob = encryptJson({ userAccessToken: "EAAG-secret-token" });
    const parts = blob.split(":");
    parts[3] = Buffer.from("tampered-ciphertext").toString("base64");
    assert.throws(() => decryptJson(parts.join(":")));
  });
});

describe("token exchange", () => {
  it("sends the app secret in the POST body, never in the URL", async () => {
    const seen: { url: string; body: string; method?: string }[] = [];

    const realFetch = globalThis.fetch;
    globalThis.fetch = mock.fn(async (input: string | URL | Request, init?: RequestInit) => {
      seen.push({
        url: String(input),
        body: String(init?.body ?? ""),
        method: init?.method,
      });
      // Fail at the first call — we only care about the request shape here.
      return new Response(JSON.stringify({ error: { message: "stubbed", code: 100 } }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof globalThis.fetch;

    try {
      await assert.rejects(() => completeOAuth("test-auth-code", "user-abc"));
    } finally {
      globalThis.fetch = realFetch;
    }

    assert.equal(seen.length, 1, "should stop after the failed exchange");
    const [call] = seen;

    assert.equal(call.method, "POST");
    assert.ok(!call.url.includes(SECRET), "app secret must not appear in the URL");
    assert.ok(!call.url.includes("test-auth-code"), "authorization code must not appear in the URL");
    assert.ok(call.body.includes("client_secret="), "secret belongs in the form body");
    assert.ok(call.body.includes("code=test-auth-code"));
  });

  it("maps a Meta redirect_uri complaint to an actionable message", async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = mock.fn(
      async () =>
        new Response(
          JSON.stringify({ error: { message: "Invalid redirect_uri: URL is not permitted.", code: 100 } }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        )
    ) as typeof globalThis.fetch;

    try {
      await assert.rejects(
        () => completeOAuth("code", "user-abc"),
        (err: Error) => {
          assert.ok(err instanceof MetaOAuthError);
          assert.match(err.message, /redirect URI doesn't match/i);
          // The operator-facing message must not echo credentials back.
          assert.ok(!err.message.includes(SECRET));
          return true;
        }
      );
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

describe("configuration validation", () => {
  it("reports a complete configuration as configured", () => {
    assert.equal(metaConfigStatus().configured, true);
  });

  it("flags a missing app secret by name, without a value", () => {
    const original = process.env.META_APP_SECRET;
    delete process.env.META_APP_SECRET;
    try {
      const status = metaConfigStatus();
      assert.equal(status.configured, false);
      assert.ok(status.missing.includes("META_APP_SECRET"));
      assert.match(status.message, /Instagram integration is not configured\./);
    } finally {
      process.env.META_APP_SECRET = original;
    }
  });

  it("rejects a placeholder left over from the template", () => {
    const original = process.env.META_APP_ID;
    process.env.META_APP_ID = "<your-app-id>";
    try {
      const status = metaConfigStatus();
      assert.equal(status.configured, false);
      assert.ok(status.invalid.some((p) => p.key === "META_APP_ID"));
    } finally {
      process.env.META_APP_ID = original;
    }
  });

  it("rejects a non-https redirect URI outside localhost", () => {
    const original = process.env.META_REDIRECT_URI;
    process.env.META_REDIRECT_URI = "http://nexus.example.com/cb";
    try {
      assert.ok(
        metaConfigStatus().invalid.some(
          (p) => p.key === "META_REDIRECT_URI" && /https/.test(p.reason)
        )
      );
    } finally {
      process.env.META_REDIRECT_URI = original;
    }
  });

  it("never includes a value in the status payload", () => {
    const serialised = JSON.stringify(metaConfigStatus());
    assert.ok(!serialised.includes(SECRET));
    assert.ok(!serialised.includes(process.env.META_APP_ID!));
  });
});
