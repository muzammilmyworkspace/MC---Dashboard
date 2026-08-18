import "server-only";
/* ------------------------------------------------------------------ *
 *  Redis (Upstash) — shared client
 *
 *  Entirely optional. Without REDIS_URL the app runs exactly as before,
 *  using in-process caching and rate limiting. That is correct for a
 *  single instance, and it means a Redis outage degrades performance
 *  rather than taking the API down.
 *
 *  Every helper here therefore swallows its own errors and reports a
 *  miss. Callers must treat Redis as a best-effort accelerator, never as
 *  a source of truth — Postgres holds anything that matters.
 * ------------------------------------------------------------------ */
import Redis from "ioredis";
import { env } from "./env";

let client: Redis | null = null;
let warnedUnavailable = false;

if (env.REDIS_URL) {
  client = new Redis(env.REDIS_URL, {
    // Bounded retries stop a dead connection from hanging a request; that
    // is what keeps a cache lookup from becoming slower than the call it
    // was meant to save.
    maxRetriesPerRequest: 2,
    connectTimeout: 8_000,
    // Left enabled deliberately. With it off, any command issued before the
    // TLS handshake completes is rejected outright — so every write during
    // startup and each reconnect was dropped, and the cache never populated.
    // Brief queueing is exactly the behaviour a cache wants here.
    enableOfflineQueue: true,
    lazyConnect: false,
  });

  client.on("ready", () => console.log("  · redis connected"));
  client.on("error", (err: Error) => {
    // ioredis reconnects on its own; one line per incident is enough, and
    // the URL contains a password so it must never reach the log.
    if (!warnedUnavailable) {
      console.warn(`  ⚠ redis unavailable — falling back to in-process cache (${err.message})`);
      warnedUnavailable = true;
    }
  });
  client.on("ready", () => {
    warnedUnavailable = false;
  });
}

export const redis = client;
export const redisEnabled = client !== null;

/** Namespaced so one Upstash database can serve several environments. */
export function key(...parts: string[]): string {
  return [env.REDIS_PREFIX, ...parts].join(":");
}

/** Returns null on a miss, on error, or when Redis isn't configured. */
export async function cacheGet<T>(k: string): Promise<T | null> {
  if (!client) return null;
  try {
    const raw = await client.get(key(k));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Best effort — a failed write is a cache miss next time, nothing worse. */
export async function cacheSet(k: string, value: unknown, ttlMs: number): Promise<void> {
  if (!client || ttlMs <= 0) return;
  try {
    await client.set(key(k), JSON.stringify(value), "PX", ttlMs);
  } catch {
    /* ignore */
  }
}

export async function cacheDelete(prefix: string): Promise<void> {
  if (!client) return;
  try {
    // SCAN rather than KEYS: KEYS blocks the server, and this runs against
    // a shared managed instance.
    const pattern = key(prefix) + "*";
    let cursor = "0";
    do {
      const [next, found] = await client.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = next;
      if (found.length) await client.del(...found);
    } while (cursor !== "0");
  } catch {
    /* ignore */
  }
}

/**
 * Single-holder lock, used to stop two instances running the same sync.
 * Returns a release function, or null when the lock is already held.
 *
 * With no Redis this always grants the lock — a single process has its own
 * in-memory guard, so there is nothing to coordinate.
 */
export async function acquireLock(name: string, ttlMs: number): Promise<(() => Promise<void>) | null> {
  if (!client) return async () => {};
  const lockKey = key("lock", name);
  const token = Math.random().toString(36).slice(2);
  try {
    const ok = await client.set(lockKey, token, "PX", ttlMs, "NX");
    if (ok !== "OK") return null;
    return async () => {
      try {
        // Only release our own lock — otherwise a slow holder whose lock had
        // already expired would delete the next holder's.
        const current = await client!.get(lockKey);
        if (current === token) await client!.del(lockKey);
      } catch {
        /* the TTL will clear it */
      }
    };
  } catch {
    // Redis unreachable: proceed rather than block the sync entirely.
    return async () => {};
  }
}

export async function disconnectRedis(): Promise<void> {
  if (!client) return;
  try {
    await client.quit();
  } catch {
    client.disconnect();
  }
}
