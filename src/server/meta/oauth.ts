import "server-only";
/* ------------------------------------------------------------------ *
 *  Meta OAuth — Instagram API with Instagram Login
 *
 *  SERVER ONLY. Reads META_IG_APP_SECRET; nothing here returns, logs or
 *  serialises it, the authorization code, or any access token.
 *
 *  Originally built against Facebook Login for Business (a Page-linked
 *  Instagram Business account, via a Page Access Token). That flow needed
 *  `pages_messaging` to subscribe a Page to message webhooks — a
 *  permission this app was never granted, because its actual configured
 *  product is "Instagram API with Instagram Login": direct login, no
 *  Facebook Page involved, a different app id/secret pair
 *  (META_IG_APP_ID/META_IG_APP_SECRET), and Graph calls against
 *  graph.instagram.com instead of graph.facebook.com.
 *
 *  This is an *additional* connection path. The System User token flow in
 *  services/instagram/ is untouched and keeps working independently — the
 *  two never share state.
 * ------------------------------------------------------------------ */
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import { env } from "../env";
import { prisma } from "../prisma";
import { decryptJson, encryptJson } from "../crypto";
import {
  MetaNotConfiguredError,
  metaConfigStatus,
  metaIgLoginConfig,
} from "./config";

export const META_INTEGRATION_KEY = "meta-graph";

/**
 * A failure the user is allowed to read. Every message here is written for
 * the dashboard — no secrets, no raw Meta payloads, no stack detail.
 */
export class MetaOAuthError extends Error {
  /** Short machine code, safe to put in a redirect query string. */
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "MetaOAuthError";
    this.code = code;
  }
}

/* --------------------------- OAuth state (CSRF) -------------------------- */

interface StatePayload {
  /** Integration key this authorization is for. */
  k: string;
  /** Random nonce so two states minted in the same second still differ. */
  n: string;
}

/**
 * State is a short-lived signed JWT rather than a database row.
 *
 * It only has to prove "this callback answers an authorization *this* server
 * started for *this* user", and a signature does that without a new table.
 * Replay is covered separately: Meta authorization codes are single-use, so a
 * resubmitted state fails at the exchange regardless.
 */
export function signOAuthState(userId: string): string {
  const payload: StatePayload = { k: META_INTEGRATION_KEY, n: crypto.randomBytes(8).toString("hex") };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { subject: userId, expiresIn: "10m" });
}

export function verifyOAuthState(state: string | undefined): { userId: string } {
  if (!state) throw new MetaOAuthError("invalid_state", "Authorization request is missing its security token.");
  try {
    const decoded = jwt.verify(state, env.JWT_ACCESS_SECRET) as StatePayload & { sub?: string };
    if (decoded.k !== META_INTEGRATION_KEY || !decoded.sub) {
      throw new Error("wrong key");
    }
    return { userId: decoded.sub };
  } catch {
    throw new MetaOAuthError(
      "invalid_state",
      "This connection link has expired or was not started here. Please press Connect again."
    );
  }
}

/* ------------------------------ Step 1: URL ------------------------------ */

/** Everything the app can do with the resulting token — matches what's added under "Add required messaging permissions". */
const IG_LOGIN_SCOPES = "instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments";

export function buildAuthorizeUrl(state: string): string {
  const cfg = metaIgLoginConfig();
  const params = new URLSearchParams({
    client_id: cfg.igAppId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: IG_LOGIN_SCOPES,
    state,
  });
  return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
}

/* --------------------------- Meta HTTP plumbing -------------------------- */

interface MetaErrorBody {
  error?: { message?: string; type?: string; code?: number; error_subcode?: number };
  error_message?: string;
  error_type?: string;
}

/**
 * Instagram's `user_id` (e.g. from api.instagram.com/oauth/access_token) is a
 * 17-digit integer sent as a bare JSON number, not a quoted string. That
 * exceeds Number.MAX_SAFE_INTEGER, so plain JSON.parse silently rounds the
 * last digit(s) off — every downstream Graph API call then targets a node
 * that "does not exist" because the id is wrong. Quoting any 16+ digit bare
 * integer before parsing keeps it exact, as a string, matching how every
 * other Meta id in this codebase is already typed.
 */
function parseJsonPreservingLargeIds(text: string): unknown {
  const safe = text.replace(/:(\s*)(-?\d{16,})(\s*[,}\]])/g, ':$1"$2"$3');
  try {
    return JSON.parse(safe);
  } catch {
    return null;
  }
}

/**
 * Deliberately not the shared providerRequest helper: that caches by URL, and
 * these calls carry the app secret and the authorization code. Nothing here is
 * cached and no URL containing a credential is ever retained.
 */
async function metaFetch<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { Accept: "application/json", ...init?.headers } });
  } catch {
    throw new MetaOAuthError("network", "Could not reach Meta. Check the server's internet connection.");
  }

  const text = await res.text();
  const body = parseJsonPreservingLargeIds(text);

  if (!res.ok) {
    // Instagram's own OAuth endpoints (api.instagram.com) shape errors as
    // { error_type, error_message } instead of Graph's { error: { message } }.
    const graphErr = (body as MetaErrorBody)?.error;
    const flat = body as MetaErrorBody;
    const err = graphErr ?? (flat?.error_message ? { message: flat.error_message, type: flat.error_type } : undefined);
    // Safe to log: Meta's own error description, not a credential — the URL (which does
    // carry the app secret for the token exchange) is deliberately never passed here.
    console.error(`[meta-oauth] ${res.status}: ${JSON.stringify(err ?? {})}`);
    throw new MetaOAuthError(metaErrorCode(err), humanMetaError(err, res.status));
  }
  return body as T;
}

function metaErrorCode(err: MetaErrorBody["error"]): string {
  if (err?.code === 100 && err.error_subcode === 36007) return "expired_code";
  if (err?.code === 100) return "invalid_request";
  if (err?.code === 190) return "invalid_token";
  return "meta_error";
}

/** Maps Meta's developer-facing errors to something an operator can act on. */
function humanMetaError(err: MetaErrorBody["error"], status: number): string {
  const raw = err?.message ?? "";

  if (/redirect_uri/i.test(raw)) {
    return "The redirect URI doesn't match the one registered under Instagram business login. They must be identical, including http/https and any trailing slash.";
  }
  if (/code.*expired|expired.*code/i.test(raw) || err?.error_subcode === 36007) {
    return "That authorization code has expired. Codes are valid for a few minutes and can only be used once — please press Connect again.";
  }
  if (/already been used/i.test(raw)) {
    return "That authorization code was already used. Please press Connect again.";
  }
  if (/client secret|validating client secret/i.test(raw)) {
    return "Meta rejected the credentials. Verify META_IG_APP_SECRET matches the Instagram app secret shown under API setup with Instagram login.";
  }
  if (err?.code === 190) {
    return "Meta rejected the credentials. Verify META_IG_APP_ID and META_IG_APP_SECRET.";
  }
  if (status === 400) {
    return "Meta rejected the request. Check META_IG_APP_ID, META_IG_APP_SECRET and the redirect URI.";
  }
  return "Meta returned an unexpected error. Please try again.";
}

/* --------------------------- Step 2: token swap -------------------------- */

interface ShortLivedToken {
  access_token: string;
  user_id: string;
  permissions?: string;
}

/**
 * Swaps the authorization code for a short-lived Instagram User Access
 * Token, scoped directly to the connected Instagram account — there is no
 * Facebook Page in this flow, so no Page-discovery step afterward.
 *
 * POST with a form body rather than GET: it keeps the app secret and the code
 * out of the request line, where they would otherwise land in any proxy or
 * access log between here and Meta.
 */
async function exchangeAuthorizationCode(code: string): Promise<ShortLivedToken> {
  const cfg = metaIgLoginConfig();
  const body = new URLSearchParams({
    client_id: cfg.igAppId,
    client_secret: cfg.igAppSecret,
    grant_type: "authorization_code",
    redirect_uri: cfg.redirectUri,
    code,
  });

  const res = await metaFetch<{ data?: ShortLivedToken[] } | ShortLivedToken>(
    "https://api.instagram.com/oauth/access_token",
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() }
  );

  // Documented as { data: [...] } for this product, but tolerate a flat object too.
  if ("data" in res && Array.isArray(res.data) && res.data[0]) return res.data[0];
  return res as ShortLivedToken;
}

interface LongLivedToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/** Upgrades a short-lived token to the ~60 day long-lived one. */
async function exchangeForLongLivedToken(shortLived: string): Promise<LongLivedToken> {
  const cfg = metaIgLoginConfig();
  const params = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: cfg.igAppSecret,
    access_token: shortLived,
  });

  return metaFetch<LongLivedToken>(`https://graph.instagram.com/access_token?${params.toString()}`);
}

/* ----------------------- Step 3: identify the account -------------------- */

async function fetchIgUsername(token: string): Promise<string> {
  const url = `https://graph.instagram.com/${env.META_GRAPH_VERSION}/me?fields=username`;
  const res = await metaFetch<{ username?: string }>(url, { headers: { Authorization: `Bearer ${token}` } });
  return res.username ?? "";
}

/* ----------------------------- Storage ----------------------------------- */

/** Encrypted at rest inside Integration.credentials. Never leaves the server. */
interface StoredCredentials {
  igAccessToken: string;
  tokenType: string;
  expiresAt: string | null;
}

/** Safe for API responses — deliberately contains no token material. */
export interface MetaConnectionMetadata {
  igAccountId: string;
  igUsername: string;
  connectedAt: string;
  connectedByUserId: string;
  tokenExpiresAt: string | null;
}

/**
 * Runs the whole exchange and persists the result.
 * Returns metadata only — callers never receive token material.
 */
export async function completeOAuth(code: string, userId: string): Promise<MetaConnectionMetadata> {
  const shortLived = await exchangeAuthorizationCode(code);
  // Best effort: if the long-lived swap fails we still have a working token,
  // just a shorter-lived one. Losing the connection over it would be worse.
  const longLived = await exchangeForLongLivedToken(shortLived.access_token).catch(
    (): LongLivedToken => ({ access_token: shortLived.access_token, token_type: "bearer", expires_in: 0 })
  );

  const igUsername = await fetchIgUsername(longLived.access_token);

  const expiresAt = longLived.expires_in
    ? new Date(Date.now() + longLived.expires_in * 1000).toISOString()
    : null;

  const credentials: StoredCredentials = {
    igAccessToken: longLived.access_token,
    tokenType: longLived.token_type ?? "bearer",
    expiresAt,
  };

  const metadata: MetaConnectionMetadata = {
    igAccountId: shortLived.user_id,
    igUsername,
    connectedAt: new Date().toISOString(),
    connectedByUserId: userId,
    tokenExpiresAt: expiresAt,
  };

  await prisma.integration.upsert({
    where: { key: META_INTEGRATION_KEY },
    create: {
      key: META_INTEGRATION_KEY,
      name: "Meta Graph API",
      category: "Social",
      scopes: [],
      status: "CONNECTED",
      health: "HEALTHY",
      lastSyncAt: new Date(),
      credentials: { enc: encryptJson(credentials) },
      metadata: { ...metadata },
    },
    update: {
      status: "CONNECTED",
      health: "HEALTHY",
      lastSyncAt: new Date(),
      credentials: { enc: encryptJson(credentials) },
      metadata: { ...metadata },
    },
  });

  return metadata;
}

/** Decrypts stored credentials. Server-side callers only. */
export async function readMetaCredentials(): Promise<StoredCredentials | null> {
  const row = await prisma.integration.findUnique({ where: { key: META_INTEGRATION_KEY } });
  const blob = (row?.credentials as { enc?: string } | null)?.enc;
  if (!blob) return null;
  try {
    return decryptJson<StoredCredentials>(blob);
  } catch {
    // Usually means ENCRYPTION_KEY changed since the connection was made.
    return null;
  }
}

export interface MetaConnectionStatus {
  /** Env vars present and valid. */
  configured: boolean;
  /** A user has completed OAuth. */
  connected: boolean;
  /** Human-readable, safe to render. */
  message: string;
  account: MetaConnectionMetadata | null;
  missing: string[];
}

export async function metaConnectionStatus(): Promise<MetaConnectionStatus> {
  const config = metaConfigStatus();

  // Config validity is answerable without the database. Letting a Postgres
  // outage throw here would mask a wrong META_IG_APP_ID behind a generic
  // "can't reach the API", which is the harder problem to diagnose.
  const row = await prisma.integration
    .findUnique({ where: { key: META_INTEGRATION_KEY } })
    .catch(() => null);

  const connected = row?.status === "CONNECTED" && Boolean((row.credentials as { enc?: string } | null)?.enc);
  const account = connected ? ((row?.metadata ?? null) as MetaConnectionMetadata | null) : null;

  return {
    configured: config.configured,
    connected,
    message: !config.configured
      ? config.message
      : connected
        ? `Instagram — Connected${account?.igUsername ? ` as @${account.igUsername}` : ""}`
        : "Instagram — Not connected",
    account,
    missing: config.missing,
  };
}

export async function disconnectMeta(): Promise<void> {
  await prisma.integration.updateMany({
    where: { key: META_INTEGRATION_KEY },
    // Prisma reads `undefined` as "don't touch this column", which would leave
    // the encrypted token sitting in the row after a disconnect. DbNull erases it.
    data: {
      status: "NOT_CONNECTED",
      health: "UNKNOWN",
      credentials: Prisma.DbNull,
      metadata: Prisma.DbNull,
      lastSyncAt: null,
    },
  });
}

/** Re-exported so routes can distinguish "not set up" from "Meta said no". */
export { MetaNotConfiguredError };
