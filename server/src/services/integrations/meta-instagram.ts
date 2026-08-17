/* ------------------------------------------------------------------ *
 *  Instagram data over the OAuth connection — SERVER ONLY
 *
 *  Deliberately thin. Every read that services/instagram/client.ts
 *  already implements is reused by handing it an IgConfig built from the
 *  OAuth page token instead of the System User token from env — that
 *  file is not imported for its config, only for its request logic, and
 *  is not modified.
 *
 *  Only what the client genuinely lacks (comments, permissions) is
 *  written here.
 * ------------------------------------------------------------------ */
import { env } from "../../env.js";
import { prisma } from "../../lib/prisma.js";
import { providerRequest } from "../deployments/http.js";
import type { IgConfig } from "../instagram/client.js";
import {
  META_INTEGRATION_KEY,
  readMetaCredentials,
  type MetaConnectionMetadata,
} from "./meta-oauth.js";

/** Raised when the caller asks for data before anyone has connected. */
export class NotConnectedError extends Error {
  constructor(message = "Instagram is not connected. Press Connect Instagram to authorize.") {
    super(message);
    this.name = "NotConnectedError";
  }
}

/**
 * An IgConfig backed by the OAuth page token.
 *
 * Page tokens derived from a long-lived user token don't expire, which is
 * why the page token is preferred here over the user token.
 */
export async function oauthIgConfig(): Promise<IgConfig | null> {
  const [creds, row] = await Promise.all([
    readMetaCredentials(),
    prisma.integration.findUnique({ where: { key: META_INTEGRATION_KEY } }),
  ]);

  const metadata = row?.metadata as MetaConnectionMetadata | null;
  if (!creds?.pageAccessToken || !metadata?.igAccountId) return null;

  return {
    token: creds.pageAccessToken,
    igAccountId: metadata.igAccountId,
    version: env.META_GRAPH_VERSION,
  };
}

export async function requireOauthConfig(): Promise<IgConfig> {
  const cfg = await oauthIgConfig();
  if (!cfg) throw new NotConnectedError();
  return cfg;
}

export async function connectionMetadata(): Promise<MetaConnectionMetadata | null> {
  const row = await prisma.integration.findUnique({ where: { key: META_INTEGRATION_KEY } });
  return (row?.metadata ?? null) as MetaConnectionMetadata | null;
}

/* ------------------------------ Graph calls ------------------------------ */

const GRAPH = "https://graph.facebook.com";

/** Token travels in the Authorization header so it never enters a cache key or log line. */
function graph<T>(path: string, params: Record<string, string | number>, cfg: IgConfig, cacheTtlMs = 0) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
  return providerRequest<T>({
    provider: "meta-instagram",
    url: `${GRAPH}/${cfg.version}/${path}?${qs.toString()}`,
    token: cfg.token,
    cacheTtlMs,
  });
}

/* ------------------------------ Permissions ------------------------------ */

export type MetaPermission =
  | "instagram_basic"
  | "instagram_manage_insights"
  | "instagram_manage_comments"
  | "instagram_content_publish"
  | "instagram_manage_messages"
  | "pages_show_list"
  | "pages_read_engagement"
  | "pages_manage_metadata";

/**
 * What the connected user actually granted, straight from Meta.
 *
 * Asking Meta beats hardcoding a list: the Login for Business configuration
 * can change in the dashboard without this repo knowing, and a permission
 * the user declined at the consent screen would otherwise look available.
 */
export async function grantedPermissions(): Promise<string[]> {
  const creds = await readMetaCredentials();
  if (!creds?.userAccessToken) return [];

  try {
    const res = await providerRequest<{ data?: { permission: string; status: string }[] }>({
      provider: "meta-instagram",
      url: `${GRAPH}/${env.META_GRAPH_VERSION}/me/permissions`,
      token: creds.userAccessToken,
      cacheTtlMs: 60_000,
    });
    return (res.data ?? []).filter((p) => p.status === "granted").map((p) => p.permission);
  } catch {
    return [];
  }
}

export interface FeatureCapability {
  feature: string;
  /** Permissions Meta requires for this feature. */
  requires: MetaPermission[];
  granted: boolean;
  missing: MetaPermission[];
  /** Meta requires App Review before this works for accounts you don't own. */
  appReview: boolean;
  /** Extra setup beyond permissions, e.g. a webhook subscription. */
  note?: string;
}

const FEATURE_MATRIX: Omit<FeatureCapability, "granted" | "missing">[] = [
  { feature: "profile", requires: ["instagram_basic", "pages_show_list"], appReview: false },
  { feature: "media", requires: ["instagram_basic"], appReview: false },
  { feature: "insights", requires: ["instagram_basic", "instagram_manage_insights"], appReview: true },
  { feature: "comments", requires: ["instagram_basic", "instagram_manage_comments"], appReview: true },
  {
    feature: "messages",
    requires: ["instagram_basic", "instagram_manage_messages"],
    appReview: true,
    note: "Also needs a messages webhook subscription on the Meta app.",
  },
  {
    feature: "publishing",
    requires: ["instagram_basic", "instagram_content_publish"],
    appReview: true,
  },
];

export async function capabilities(): Promise<FeatureCapability[]> {
  const granted = new Set(await grantedPermissions());
  return FEATURE_MATRIX.map((f) => {
    const missing = f.requires.filter((p) => !granted.has(p));
    return { ...f, missing, granted: missing.length === 0 };
  });
}

/* -------------------------------- Comments ------------------------------- */

export interface IgComment {
  id: string;
  text: string;
  username: string;
  timestamp: string;
  likeCount: number;
  hidden: boolean;
  replies: { id: string; text: string; username: string; timestamp: string }[];
}

interface RawComment {
  id: string;
  text?: string;
  username?: string;
  timestamp: string;
  like_count?: number;
  hidden?: boolean;
  replies?: { data?: { id: string; text?: string; username?: string; timestamp: string }[] };
}

export async function getComments(mediaId: string, cfg: IgConfig, limit = 25): Promise<IgComment[]> {
  const res = await graph<{ data?: RawComment[] }>(
    `${mediaId}/comments`,
    {
      fields: "id,text,username,timestamp,like_count,hidden,replies{id,text,username,timestamp}",
      limit,
    },
    cfg
  );

  return (res.data ?? []).map((c) => ({
    id: c.id,
    text: c.text ?? "",
    username: c.username ?? "",
    timestamp: c.timestamp,
    likeCount: c.like_count ?? 0,
    hidden: c.hidden ?? false,
    replies: (c.replies?.data ?? []).map((r) => ({
      id: r.id,
      text: r.text ?? "",
      username: r.username ?? "",
      timestamp: r.timestamp,
    })),
  }));
}

export async function replyToComment(commentId: string, message: string, cfg: IgConfig): Promise<{ id: string }> {
  return providerRequest<{ id: string }>({
    provider: "meta-instagram",
    url: `${GRAPH}/${cfg.version}/${commentId}/replies`,
    token: cfg.token,
    method: "POST",
    body: { message },
    cacheTtlMs: 0,
  });
}

export async function setCommentHidden(commentId: string, hide: boolean, cfg: IgConfig): Promise<void> {
  await providerRequest({
    provider: "meta-instagram",
    url: `${GRAPH}/${cfg.version}/${commentId}`,
    token: cfg.token,
    method: "POST",
    body: { hide },
    cacheTtlMs: 0,
  });
}

/* -------------------------------- Messages ------------------------------- */

export interface MessagingReadiness {
  available: boolean;
  reason: string;
  missing: MetaPermission[];
  webhookConfigured: boolean;
}

/**
 * Instagram messaging is gated on more than a token: the app needs
 * `instagram_manage_messages` through App Review AND an active messages
 * webhook subscription, because conversations arrive by webhook rather
 * than being pollable. Reports readiness instead of pretending.
 */
export async function messagingReadiness(): Promise<MessagingReadiness> {
  const caps = await capabilities();
  const messages = caps.find((c) => c.feature === "messages");
  const webhookConfigured = Boolean(env.META_WEBHOOK_VERIFY_TOKEN);

  const missing = messages?.missing ?? ["instagram_manage_messages"];
  const available = Boolean(messages?.granted) && webhookConfigured;

  let reason = "Ready.";
  if (!messages?.granted && !webhookConfigured) {
    reason = "Needs the instagram_manage_messages permission (App Review) and a webhook verify token.";
  } else if (!messages?.granted) {
    reason = `Missing permission: ${missing.join(", ")}. This requires Meta App Review.`;
  } else if (!webhookConfigured) {
    reason = "Set META_WEBHOOK_VERIFY_TOKEN and subscribe the app to the messages webhook field.";
  }

  return { available, reason, missing, webhookConfigured };
}
