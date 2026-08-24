import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { api, setAccessToken } from "./api";

/* ------------------------------------------------------------------ *
 *  Token refresh must be single-flight.
 *
 *  Refresh tokens rotate: the server revokes the presented token and
 *  issues a new one. Several components fetching on mount all hit 401
 *  together, and if each ran its own refresh, the first would rotate
 *  the token and the rest would arrive holding one that no longer
 *  exists. They then rendered "sign in" beside sections that had loaded
 *  perfectly — the failure was intermittent, which is what made it hard
 *  to place.
 *
 *  Reproduced against the running server before the fix: six concurrent
 *  refreshes, two accepted and four rejected with 401.
 * ------------------------------------------------------------------ */

const realFetch = globalThis.fetch;

interface Call {
  url: string;
  method: string;
}

let calls: Call[] = [];

/** Every protected call 401s once, so the client is forced to refresh. */
function installFetchStub(opts: { refreshSucceeds: boolean }) {
  let refreshed = false;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";
    calls.push({ url, method });

    if (url.endsWith("/api/auth/refresh")) {
      // A real rotation: the second caller to reach the server would be
      // presenting a token the first already revoked.
      if (refreshed || !opts.refreshSucceeds) {
        return new Response(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "revoked" } }), { status: 401 });
      }
      refreshed = true;
      return new Response(JSON.stringify({ accessToken: "fresh-token" }), { status: 200 });
    }

    if (url.endsWith("/api/auth/me")) {
      return refreshed
        ? new Response(JSON.stringify({ user: { id: "u1", email: "a@b.c", name: "A", role: "TEAM" } }), { status: 200 })
        : new Response(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "no" } }), { status: 401 });
    }

    return new Response(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "no" } }), { status: 401 });
  }) as typeof fetch;
}

const refreshCalls = () => calls.filter((c) => c.url.endsWith("/api/auth/refresh")).length;

describe("access token refresh", () => {
  beforeEach(() => {
    calls = [];
    setAccessToken(null);
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("concurrent callers share a single refresh request", async () => {
    installFetchStub({ refreshSucceeds: true });

    // Five components mounting at once, exactly as the Instagram page does.
    const results = await Promise.all(Array.from({ length: 5 }, () => api.auth.refresh()));

    assert.equal(refreshCalls(), 1, "the refresh endpoint must be hit once, not once per caller");
    for (const user of results) {
      assert.ok(user, "every caller must receive the refreshed session");
    }
  });

  test("all callers see the failure when the refresh genuinely fails", async () => {
    installFetchStub({ refreshSucceeds: false });

    const results = await Promise.all(Array.from({ length: 4 }, () => api.auth.refresh()));

    assert.equal(refreshCalls(), 1, "a doomed refresh is still only attempted once");
    for (const user of results) {
      assert.equal(user, null, "a real auth failure must reach every caller");
    }
  });

  test("a later refresh starts a new request rather than reusing the finished one", async () => {
    installFetchStub({ refreshSucceeds: true });

    await api.auth.refresh();
    assert.equal(refreshCalls(), 1);

    // The shared promise is cleared once settled; the next expiry must be
    // able to refresh again rather than replaying a stale result forever.
    await api.auth.refresh();
    assert.equal(refreshCalls(), 2);
  });
});
