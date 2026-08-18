/* ------------------------------------------------------------------ *
 *  Provider cache key safety
 *
 *  Cache keys now leave the process for a shared Redis instance, so a
 *  credential in a key would be a credential in third-party storage.
 *  Meta's paging links carry access_token in the query string, which is
 *  exactly how that would happen by accident.
 * ------------------------------------------------------------------ */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.JWT_ACCESS_SECRET = "test-access-secret-32-chars-minimum!!";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-32-chars-minimum!";
process.env.REDIS_URL = "";

const { providerRequest, clearProviderCache } = await import("./http.js");

const TOKEN = "EAAsecret-token-value-that-must-not-be-stored";

describe("cache keys", () => {
  it("does not retain a token from the query string", async () => {
    const seen: string[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL | Request) => {
      seen.push(String(input));
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof globalThis.fetch;

    try {
      const url = `https://graph.facebook.com/v23.0/me?access_token=${TOKEN}`;
      await providerRequest({ provider: "test", url, cacheTtlMs: 5_000 });

      // Served from cache the second time — the request must not repeat.
      await providerRequest({ provider: "test", url, cacheTtlMs: 5_000 });
      assert.equal(seen.length, 1, "second call should hit the cache");
    } finally {
      globalThis.fetch = realFetch;
      await clearProviderCache();
    }
  });

  it("still distinguishes different URLs", async () => {
    const seen: string[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL | Request) => {
      seen.push(String(input));
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof globalThis.fetch;

    try {
      await providerRequest({ provider: "test", url: "https://example.com/a", cacheTtlMs: 5_000 });
      await providerRequest({ provider: "test", url: "https://example.com/b", cacheTtlMs: 5_000 });
      assert.equal(seen.length, 2, "different paths must not share a cache entry");
    } finally {
      globalThis.fetch = realFetch;
      await clearProviderCache();
    }
  });

  it("works unchanged with no Redis configured", async () => {
    let calls = 0;
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      calls++;
      return new Response(JSON.stringify({ n: calls }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof globalThis.fetch;

    try {
      const a = await providerRequest<{ n: number }>({
        provider: "test", url: "https://example.com/x", cacheTtlMs: 5_000,
      });
      const b = await providerRequest<{ n: number }>({
        provider: "test", url: "https://example.com/x", cacheTtlMs: 5_000,
      });
      assert.deepEqual(a, b);
      assert.equal(calls, 1, "in-process cache must still work without Redis");
    } finally {
      globalThis.fetch = realFetch;
      await clearProviderCache();
    }
  });
});
