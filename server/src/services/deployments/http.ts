import { env } from "../../env.js";

/**
 * Shared HTTP client for provider APIs.
 * Handles: in-memory caching, retry with exponential backoff, and
 * rate-limit awareness (honours Retry-After / X-RateLimit-Reset).
 */

interface CacheEntry {
  expiresAt: number;
  value: unknown;
}
const cache = new Map<string, CacheEntry>();

export class ProviderError extends Error {
  status: number;
  provider: string;
  retryable: boolean;
  constructor(provider: string, status: number, message: string) {
    super(`[${provider}] ${status} — ${message}`);
    this.provider = provider;
    this.status = status;
    this.retryable = status === 429 || status >= 500;
  }
}

export interface RequestOptions {
  provider: string;
  url: string;
  token?: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** Cache successful GETs for this long (ms). 0 disables. */
  cacheTtlMs?: number;
  retries?: number;
  headers?: Record<string, string>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function clearProviderCache(prefix?: string) {
  if (!prefix) return cache.clear();
  for (const key of cache.keys()) if (key.startsWith(prefix)) cache.delete(key);
}

export async function providerRequest<T>(opts: RequestOptions): Promise<T> {
  const {
    provider, url, token, method = "GET", body,
    cacheTtlMs = method === "GET" ? env.DEPLOY_CACHE_TTL_MS : 0,
    retries = 3, headers = {},
  } = opts;

  const cacheKey = `${provider}:${method}:${url}`;
  if (cacheTtlMs > 0) {
    const hit = cache.get(cacheKey);
    if (hit && hit.expiresAt > Date.now()) return hit.value as T;
  }

  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    try {
      const res = await fetch(url, {
        method,
        headers: {
          Accept: "application/json",
          "User-Agent": "MC-Nexus-Deployment-Center",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const reset = Number(res.headers.get("x-ratelimit-reset"));
        const waitMs = retryAfter
          ? retryAfter * 1000
          : reset
            ? Math.max(0, reset * 1000 - Date.now())
            : Math.min(8000, 2 ** attempt * 500);
        if (attempt === retries) throw new ProviderError(provider, res.status, await res.text());
        await sleep(Math.min(waitMs, 10_000));
        attempt++;
        continue;
      }

      if (!res.ok) throw new ProviderError(provider, res.status, await res.text());

      const value = (await res.json()) as T;
      if (cacheTtlMs > 0) cache.set(cacheKey, { value, expiresAt: Date.now() + cacheTtlMs });
      return value;
    } catch (err) {
      lastError = err;
      if (err instanceof ProviderError && !err.retryable) throw err;
      if (attempt === retries) break;
      await sleep(Math.min(8000, 2 ** attempt * 500));
      attempt++;
    }
  }

  throw lastError instanceof Error ? lastError : new ProviderError(provider, 0, "Request failed");
}
