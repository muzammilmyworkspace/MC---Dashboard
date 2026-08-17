/* ------------------------------------------------------------------ *
 *  Meta OAuth — Facebook Login for Business
 *
 *  SERVER ONLY. Reads META_APP_SECRET; nothing here returns, logs or
 *  serialises it, the authorization code, or any access token.
 *
 *  This is an *additional* connection path. The System User token flow in
 *  services/instagram/ is untouched and keeps working independently — the
 *  two never share state.
 * ------------------------------------------------------------------ */
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import { env } from "../../env.js";
import { prisma } from "../../lib/prisma.js";
import { decryptJson, encryptJson } from "../../lib/crypto.js";
import {
  MetaNotConfiguredError,
  metaConfigStatus,
  metaOAuthConfig,
} from "./meta-config.js";

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

/**
 * Builds the authorization URL.
 *
 * Note there is no `scope` parameter. With Facebook Login for Business the
 * permission set lives on the configuration (`config_id`) in the Meta
 * dashboard, and a `scope` passed alongside it is ignored. To change what
 * MC Nexus asks for, edit the "MC Nexus Instagram" configuration at Meta —
 * not this file.
 */
export function buildAuthorizeUrl(state: string): string {
  const cfg = metaOAuthConfig();
  const params = new URLSearchParams({
    client_id: cfg.appId,
    config_id: cfg.configId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    state,
  });
  return `https://www.facebook.com/${cfg.apiVersion}/dialog/oauth?${params.toString()}`;
}

/* --------------------------- Meta HTTP plumbing -------------------------- */

interface MetaErrorBody {
  error?: { message?: string; type?: string; code?: number; error_subcode?: number };
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
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }

  if (!res.ok) {
    const err = (body as MetaErrorBody)?.error;
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
    return "The redirect URI doesn't match the one registered on the Meta app. They must be identical, including http/https and any trailing slash.";
  }
  if (/config_id|configuration/i.test(raw)) {
    return "Meta rejected the login configuration ID. Check META_INSTAGRAM_CONFIG_ID matches a live configuration on the app.";
  }
  if (/code.*expired|expired.*code/i.test(raw) || err?.error_subcode === 36007) {
    return "That authorization code has expired. Codes are valid for a few minutes and can only be used once — please press Connect again.";
  }
  if (/already been used/i.test(raw)) {
    return "That authorization code was already used. Please press Connect again.";
  }
  if (err?.code === 190) {
    return "Meta rejected the credentials. Verify META_APP_ID and META_APP_SECRET in server/.env.";
  }
  if (status === 400) {
    return "Meta rejected the request. Check the app ID, secret and redirect URI in server/.env.";
  }
  return "Meta returned an unexpected error. Please try again.";
}

/* --------------------------- Step 2: token swap -------------------------- */

interface TokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

/**
 * Swaps the authorization code for a user access token.
 *
 * POST with a form body rather than GET: it keeps the app secret and the code
 * out of the request line, where they would otherwise land in any proxy or
 * access log between here and Meta.
 */
async function exchangeAuthorizationCode(code: string): Promise<TokenResponse> {
  const cfg = metaOAuthConfig();
  const body = new URLSearchParams({
    client_id: cfg.appId,
    client_secret: cfg.appSecret,
    redirect_uri: cfg.redirectUri,
    code,
  });

  return metaFetch<TokenResponse>(`https://graph.facebook.com/${cfg.apiVersion}/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
}

/** Upgrades a short-lived token to the ~60 day long-lived one. */
async function exchangeForLongLivedToken(shortLived: string): Promise<TokenResponse> {
  const cfg = metaOAuthConfig();
  const body = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: cfg.appId,
    client_secret: cfg.appSecret,
    fb_exchange_token: shortLived,
  });

  return metaFetch<TokenResponse>(`https://graph.facebook.com/${cfg.apiVersion}/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
}

/* ----------------------- Step 3: identify the account -------------------- */

export interface DiscoveredAccount {
  pageId: string;
  pageName: string;
  /** Page tokens derived from a long-lived user token do not expire. */
  pageAccessToken: string;
  igAccountId: string;
  igUsername: string;
}

async function discoverInstagramAccount(userToken: string): Promise<DiscoveredAccount> {
  const cfg = metaOAuthConfig();
  const url =
    `https://graph.facebook.com/${cfg.apiVersion}/me/accounts` +
    `?fields=id,name,access_token,instagram_business_account{id,username}`;

  const res = await metaFetch<{
    data?: {
      id: string;
      name: string;
      access_token: string;
      instagram_business_account?: { id: string; username: string };
    }[];
  }>(url, { headers: { Authorization: `Bearer ${userToken}` } });

  const pages = res.data ?? [];
  if (pages.length === 0) {
    throw new MetaOAuthError(
      "no_pages",
      "That Meta account doesn't manage any Facebook Pages, so there's no Instagram account to connect."
    );
  }

  const linked = pages.find((p) => p.instagram_business_account?.id);
  if (!linked?.instagram_business_account) {
    throw new MetaOAuthError(
      "no_instagram",
      `Found ${pages.length} Page(s) but none has an Instagram professional account linked. Link it in Meta Business Settings, then try again.`
    );
  }

  return {
    pageId: linked.id,
    pageName: linked.name,
    pageAccessToken: linked.access_token,
    igAccountId: linked.instagram_business_account.id,
    igUsername: linked.instagram_business_account.username,
  };
}

/* ----------------------------- Storage ----------------------------------- */

/** Encrypted at rest inside Integration.credentials. Never leaves the server. */
interface StoredCredentials {
  userAccessToken: string;
  pageAccessToken: string;
  tokenType: string;
  expiresAt: string | null;
}

/** Safe for API responses — deliberately contains no token material. */
export interface MetaConnectionMetadata {
  igAccountId: string;
  igUsername: string;
  pageId: string;
  pageName: string;
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
  const longLived = await exchangeForLongLivedToken(shortLived.access_token).catch(() => shortLived);

  const account = await discoverInstagramAccount(longLived.access_token);

  const expiresAt = longLived.expires_in
    ? new Date(Date.now() + longLived.expires_in * 1000).toISOString()
    : null;

  const credentials: StoredCredentials = {
    userAccessToken: longLived.access_token,
    pageAccessToken: account.pageAccessToken,
    tokenType: longLived.token_type ?? "bearer",
    expiresAt,
  };

  const metadata: MetaConnectionMetadata = {
    igAccountId: account.igAccountId,
    igUsername: account.igUsername,
    pageId: account.pageId,
    pageName: account.pageName,
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
  // outage throw here would mask a wrong META_APP_ID behind a generic
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
