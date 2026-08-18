/* ------------------------------------------------------------------ *
 *  Redis helpers — no-Redis fallback
 *
 *  The important property is that the app is unchanged without
 *  REDIS_URL. These run with it deliberately unset, so no network call
 *  is made and nothing here depends on a live Upstash instance.
 * ------------------------------------------------------------------ */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.JWT_ACCESS_SECRET = "test-access-secret-32-chars-minimum!!";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-32-chars-minimum!";
process.env.REDIS_PREFIX = "testprefix";
process.env.REDIS_URL = "";

const { redis, redisEnabled, cacheGet, cacheSet, cacheDelete, acquireLock, key, disconnectRedis } =
  await import("./redis.js");

describe("without REDIS_URL", () => {
  it("creates no client", () => {
    assert.equal(redis, null);
    assert.equal(redisEnabled, false);
  });

  it("reports every read as a miss instead of throwing", async () => {
    assert.equal(await cacheGet("anything"), null);
  });

  it("accepts writes as no-ops", async () => {
    await cacheSet("k", { a: 1 }, 1000);
    assert.equal(await cacheGet("k"), null);
  });

  it("deletes without error", async () => {
    await cacheDelete("http:");
  });

  it("grants the lock, since a single process needs no coordination", async () => {
    const release = await acquireLock("sync", 1000);
    assert.ok(release, "lock should be granted when Redis is absent");
    await release();
  });

  it("disconnects without error", async () => {
    await disconnectRedis();
  });
});

describe("key namespacing", () => {
  it("prefixes so one database can host several environments", () => {
    assert.equal(key("http", "meta"), "testprefix:http:meta");
  });

  it("joins every part", () => {
    assert.equal(key("a", "b", "c"), "testprefix:a:b:c");
  });
});
