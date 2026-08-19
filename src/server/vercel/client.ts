import "server-only";
import { env } from "../env";
import { providerRequest, ProviderError } from "../http";

/* ------------------------------------------------------------------ *
 *  Vercel API client
 *
 *  Wraps the shared providerRequest so Landing Pages inherits the
 *  caching, retry/backoff and rate-limit handling every other
 *  integration already uses.
 *
 *  The token is read from the environment here and nowhere else. It is
 *  never returned to a caller, never written to the database, and never
 *  logged — errors surfaced upward carry a message only.
 * ------------------------------------------------------------------ */

export const VERCEL_PROVIDER = "vercel";

/** True when a token is present. Absence is a normal state, not an error. */
export function vercelConfigured(): boolean {
  return Boolean(env.VERCEL_TOKEN);
}

/** Which variables are missing, by name. Safe to send to the browser. */
export function vercelMissingEnv(): string[] {
  return vercelConfigured() ? [] : ["VERCEL_TOKEN"];
}

export class VercelNotConfiguredError extends Error {
  constructor() {
    super("Vercel isn't connected yet.");
    this.name = "VercelNotConfiguredError";
  }
}

function token(): string {
  const t = env.VERCEL_TOKEN;
  if (!t) throw new VercelNotConfiguredError();
  return t;
}

/**
 * Team-scoped requests need teamId on every call. Personal accounts must
 * omit it entirely — sending an empty teamId is a 403, not a no-op.
 */
export function teamParams(): Record<string, string> {
  return env.VERCEL_TEAM_ID ? { teamId: env.VERCEL_TEAM_ID } : {};
}

export function vercelUrl(path: string, params: Record<string, string | number | undefined> = {}): string {
  const url = new URL(path, env.VERCEL_API_URL);
  for (const [k, v] of Object.entries({ ...teamParams(), ...params })) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  return url.toString();
}

export async function vercelRequest<T>(path: string, params?: Record<string, string | number | undefined>, cacheTtlMs?: number): Promise<T> {
  return providerRequest<T>({
    provider: VERCEL_PROVIDER,
    url: vercelUrl(path, params),
    token: token(),
    ...(cacheTtlMs !== undefined ? { cacheTtlMs } : {}),
  });
}

/* ----------------------------- error mapping ----------------------------- */

export interface VercelFailure {
  status: number;
  code: string;
  message: string;
}

/**
 * Turns a provider failure into something safe and useful for the client.
 *
 * Vercel echoes the request in its error bodies, so the raw text is kept
 * server-side and only a written explanation crosses the wire.
 */
export function describeVercelError(err: unknown): VercelFailure {
  if (err instanceof VercelNotConfiguredError) {
    return { status: 503, code: "VERCEL_NOT_CONFIGURED", message: "Vercel isn't connected yet." };
  }
  if (err instanceof ProviderError) {
    switch (err.status) {
      case 401:
        return {
          status: 502,
          code: "VERCEL_UNAUTHORIZED",
          message: "Vercel rejected the token. It may have been revoked or expired — create a new one and update VERCEL_TOKEN.",
        };
      // Vercel answers 403 for a bad token as well as for a real permission
      // gap, so this message must not assert that the token is valid — it
      // frequently is not.
      case 403:
        return {
          status: 502,
          code: "VERCEL_FORBIDDEN",
          message:
            "Vercel refused the request. Either the token is wrong or expired, or it cannot see these projects — if they belong to a team, set VERCEL_TEAM_ID and give the token access to that team.",
        };
      case 404:
        return {
          status: 404,
          code: "VERCEL_NOT_FOUND",
          message: "That project no longer exists in Vercel. It may have been deleted or renamed.",
        };
      case 429:
        return {
          status: 429,
          code: "VERCEL_RATE_LIMITED",
          message: "Vercel is rate-limiting requests. Wait a minute and try again.",
        };
      default:
        return {
          status: 502,
          code: "VERCEL_ERROR",
          message: "Vercel returned an error. Try again shortly.",
        };
    }
  }
  return { status: 502, code: "VERCEL_ERROR", message: "Unable to reach Vercel." };
}

/**
 * Logs the technical detail server-side. Deliberately separate from the
 * client-facing message so a body containing a request echo can never be
 * returned to the browser.
 */
export function logVercelError(context: string, err: unknown): void {
  const detail = err instanceof Error ? err.message : String(err);
  console.error(`[vercel] ${context}: ${detail}`);
}

/* ---------------------------- connection test ---------------------------- */

export interface ConnectionResult {
  ok: boolean;
  message: string;
  account: string | null;
  teamScoped: boolean;
}

/**
 * Proves access by calling the API rather than by checking that a token
 * looks present — a revoked token is indistinguishable from a good one
 * until something asks Vercel.
 */
export async function testVercelConnection(): Promise<ConnectionResult> {
  if (!vercelConfigured()) {
    return { ok: false, message: "Vercel isn't connected yet.", account: null, teamScoped: false };
  }
  try {
    // cacheTtlMs 0: a connection test that answers from cache tests nothing.
    const me = await vercelRequest<{ user?: { username?: string; email?: string } }>("/v2/user", {}, 0);
    const account = me.user?.username ?? me.user?.email ?? null;

    // A token can authenticate and still not see the team's projects, so the
    // test is only meaningful if it also reaches the project list.
    const projects = await vercelRequest<{ projects: unknown[] }>("/v9/projects", { limit: 1 }, 0);

    return {
      ok: true,
      message: `Connected as ${account ?? "your Vercel account"} — ${projects.projects.length > 0 ? "projects are readable" : "no projects found, but access works"}.`,
      account,
      teamScoped: Boolean(env.VERCEL_TEAM_ID),
    };
  } catch (err) {
    logVercelError("connection test", err);
    return { ok: false, message: describeVercelError(err).message, account: null, teamScoped: Boolean(env.VERCEL_TEAM_ID) };
  }
}
