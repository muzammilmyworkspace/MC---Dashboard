import "server-only";
/* ------------------------------------------------------------------ *
 *  Instagram Graph API client
 *
 *  Reaches Instagram through the linked Facebook Page using a System
 *  User token (see server/README.md → "Instagram setup").
 *
 *  Two things about this API drive the design below:
 *   1. Meta deprecates insight metrics between versions without warning
 *      (`impressions` → `views` in v22). Every insights call is therefore
 *      allowed to fail without taking the whole sync down.
 *   2. Insight day-buckets are labelled by their END time in the account's
 *      timezone, so a bucket ending 2026-08-17T07:00 holds 2026-08-16's
 *      data. `bucketDate()` does that shift — get it wrong and every
 *      follower number lands one day late.
 * ------------------------------------------------------------------ */
import { env } from "../env";
import { ProviderError, providerRequest } from "../http";

const GRAPH = "https://graph.facebook.com";

export class MetaApiError extends Error {
  code?: number;
  subcode?: number;
  type?: string;
  /** True when the token is dead — expired, revoked, or password changed. */
  authFailure: boolean;

  constructor(message: string, meta: { code?: number; subcode?: number; type?: string } = {}) {
    super(message);
    this.name = "MetaApiError";
    this.code = meta.code;
    this.subcode = meta.subcode;
    this.type = meta.type;
    this.authFailure = meta.code === 190 || meta.type === "OAuthException";
  }
}

export interface IgConfig {
  token: string;
  igAccountId: string;
  version: string;
}

/** Reads config from env, with a message that says exactly what's missing. */
export function igConfig(): IgConfig {
  const missing: string[] = [];
  if (!env.META_ACCESS_TOKEN) missing.push("META_ACCESS_TOKEN");
  if (!env.IG_BUSINESS_ACCOUNT_ID) missing.push("IG_BUSINESS_ACCOUNT_ID");
  if (missing.length) {
    throw new MetaApiError(
      `Instagram is not configured — set ${missing.join(" and ")} in server/.env`
    );
  }
  return {
    token: env.META_ACCESS_TOKEN!,
    igAccountId: env.IG_BUSINESS_ACCOUNT_ID!,
    version: env.META_GRAPH_VERSION,
  };
}

export function isConfigured(): boolean {
  return Boolean(env.META_ACCESS_TOKEN && env.IG_BUSINESS_ACCOUNT_ID);
}

/**
 * A Graph GET. The token travels in the Authorization header rather than
 * the query string so it never reaches the shared cache key or a log line.
 */
async function graph<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  cfg: IgConfig,
  cacheTtlMs = 0
): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  const url = `${GRAPH}/${cfg.version}/${path}?${qs.toString()}`;

  try {
    return await providerRequest<T>({
      provider: "instagram",
      url,
      token: cfg.token,
      cacheTtlMs,
    });
  } catch (err) {
    throw toMetaError(err);
  }
}

/** Unwraps Meta's `{ error: { message, code, ... } }` envelope for a usable message. */
function toMetaError(err: unknown): Error {
  if (!(err instanceof ProviderError)) return err instanceof Error ? err : new Error(String(err));
  const raw = err.message.slice(err.message.indexOf("—") + 1).trim();
  try {
    const parsed = JSON.parse(raw) as {
      error?: { message?: string; code?: number; error_subcode?: number; type?: string };
    };
    if (parsed.error?.message) {
      return new MetaApiError(parsed.error.message, {
        code: parsed.error.code,
        subcode: parsed.error.error_subcode,
        type: parsed.error.type,
      });
    }
  } catch {
    /* not JSON — fall through to the raw provider error */
  }
  return err;
}

/* ------------------------------- Account -------------------------------- */

export interface IgAccount {
  id: string;
  username: string;
  name?: string;
  biography?: string;
  website?: string;
  followers_count: number;
  follows_count: number;
  media_count: number;
  profile_picture_url?: string;
}

export function getAccount(cfg = igConfig()): Promise<IgAccount> {
  return graph<IgAccount>(
    cfg.igAccountId,
    {
      fields:
        "id,username,name,biography,website,followers_count,follows_count,media_count,profile_picture_url",
    },
    cfg,
    60_000
  );
}

/* ------------------------------- Insights ------------------------------- */

interface TimeSeriesInsight {
  name: string;
  period: string;
  values: { value: number; end_time?: string }[];
}
interface TotalValueInsight {
  name: string;
  period: string;
  total_value?: { value?: number };
}

/**
 * Insight day-buckets are stamped with the moment the day *ended*, so the
 * data belongs to the previous calendar day. Returns `YYYY-MM-DD`.
 *
 * The date portion is taken verbatim rather than converting the timestamp:
 * Meta stamps the boundary in the account's own timezone (midnight local),
 * so `2026-08-17T00:00:00+0200` and `2026-08-17T07:00:00+0000` both mean
 * "the day that ended on the 17th" → 2026-08-16. Normalising to UTC first
 * would shift half the world's accounts a day early.
 */
export function bucketDate(endTime: string): string {
  const d = new Date(`${endTime.slice(0, 10)}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export interface DailyMetrics {
  /** Keyed by YYYY-MM-DD. */
  reach: Record<string, number>;
  newFollowers: Record<string, number>;
}

/**
 * Time-series account insights for a window. `follower_count` is the gross
 * number of new follows per day and only reaches ~30 days back.
 */
export async function getDailyInsights(
  since: Date,
  until: Date,
  cfg = igConfig()
): Promise<DailyMetrics> {
  const out: DailyMetrics = { reach: {}, newFollowers: {} };

  const res = await graph<{ data: TimeSeriesInsight[] }>(
    `${cfg.igAccountId}/insights`,
    {
      metric: "reach,follower_count",
      period: "day",
      since: Math.floor(since.getTime() / 1000),
      until: Math.floor(until.getTime() / 1000),
    },
    cfg
  );

  for (const metric of res.data ?? []) {
    const target =
      metric.name === "reach" ? out.reach : metric.name === "follower_count" ? out.newFollowers : null;
    if (!target) continue;
    for (const v of metric.values ?? []) {
      if (v.end_time) target[bucketDate(v.end_time)] = v.value ?? 0;
    }
  }
  return out;
}

export interface TodayTotals {
  views?: number;
  profileViews?: number;
  accountsEngaged?: number;
  totalInteractions?: number;
}

/**
 * Metrics that moved behind `metric_type=total_value` in v22+. Returns an
 * empty object rather than throwing — these are nice-to-have next to the
 * follower counts, and Meta renames them often.
 */
export async function getTodayTotals(cfg = igConfig()): Promise<TodayTotals> {
  try {
    const res = await graph<{ data: TotalValueInsight[] }>(
      `${cfg.igAccountId}/insights`,
      {
        metric: "views,profile_views,accounts_engaged,total_interactions",
        metric_type: "total_value",
        period: "day",
      },
      cfg
    );
    const byName = new Map((res.data ?? []).map((m) => [m.name, m.total_value?.value]));
    return {
      views: byName.get("views"),
      profileViews: byName.get("profile_views"),
      accountsEngaged: byName.get("accounts_engaged"),
      totalInteractions: byName.get("total_interactions"),
    };
  } catch (err) {
    console.warn(`[instagram] total_value insights unavailable: ${(err as Error).message}`);
    return {};
  }
}

/** Audience breakdown. Requires >= 100 followers or Meta returns an error. */
export async function getFollowerDemographics(
  breakdown: "age" | "city" | "country" | "gender",
  cfg = igConfig()
): Promise<Record<string, number>> {
  try {
    const res = await graph<{
      data: { total_value?: { breakdowns?: { results?: { dimension_values: string[]; value: number }[] }[] } }[];
    }>(
      `${cfg.igAccountId}/insights`,
      {
        metric: "follower_demographics",
        period: "lifetime",
        metric_type: "total_value",
        breakdown,
        timeframe: "this_month",
      },
      cfg,
      3_600_000
    );
    const results = res.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
    return Object.fromEntries(results.map((r) => [r.dimension_values[0], r.value]));
  } catch (err) {
    console.warn(`[instagram] demographics unavailable: ${(err as Error).message}`);
    return {};
  }
}

/* -------------------------------- Media --------------------------------- */

export interface IgMediaItem {
  id: string;
  caption?: string;
  media_type: string;
  media_product_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
}

export async function getMedia(limit = env.IG_MEDIA_LIMIT, cfg = igConfig()): Promise<IgMediaItem[]> {
  const items: IgMediaItem[] = [];
  let url: string | null = null;

  // First page through the normal helper, subsequent pages via paging.next.
  const first = await graph<{ data: IgMediaItem[]; paging?: { next?: string } }>(
    `${cfg.igAccountId}/media`,
    {
      fields:
        "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
      limit: Math.min(limit, 100),
    },
    cfg
  );
  items.push(...(first.data ?? []));
  url = first.paging?.next ?? null;

  while (url && items.length < limit) {
    const page: { data: IgMediaItem[]; paging?: { next?: string } } = await providerRequest({
      provider: "instagram",
      url,
      token: cfg.token,
      cacheTtlMs: 0,
    });
    items.push(...(page.data ?? []));
    url = page.paging?.next ?? null;
  }

  return items.slice(0, limit);
}

export interface MediaInsights {
  reach?: number;
  views?: number;
  saved?: number;
  shares?: number;
  totalInteractions?: number;
  avgWatchTimeMs?: number;
}

/** Valid metrics differ per media type — asking for the wrong one is a hard error. */
function metricsFor(productType: string): string {
  if (productType === "REELS") {
    return "reach,views,saved,shares,total_interactions,ig_reels_avg_watch_time";
  }
  if (productType === "STORY") return "reach,views,replies";
  return "reach,views,saved,shares,total_interactions";
}

export async function getMediaInsights(
  mediaId: string,
  productType = "FEED",
  cfg = igConfig()
): Promise<MediaInsights> {
  try {
    const res = await graph<{ data: { name: string; values?: { value: number }[]; total_value?: { value?: number } }[] }>(
      `${mediaId}/insights`,
      { metric: metricsFor(productType) },
      cfg,
      300_000
    );
    const val = (name: string) => {
      const m = res.data?.find((d) => d.name === name);
      return m?.values?.[0]?.value ?? m?.total_value?.value;
    };
    return {
      reach: val("reach"),
      views: val("views"),
      saved: val("saved"),
      shares: val("shares"),
      totalInteractions: val("total_interactions"),
      avgWatchTimeMs: val("ig_reels_avg_watch_time"),
    };
  } catch (err) {
    // Insights expire for stories after 24h and aren't available on very
    // old media — a miss here shouldn't drop the post itself.
    console.warn(`[instagram] insights for ${mediaId}: ${(err as Error).message}`);
    return {};
  }
}


/* --------------------- Follows & unfollows (measured) -------------------- */

export interface FollowActivity {
  /** Accounts that started following on this day. */
  follows: number | null;
  /** Accounts that unfollowed. Measured by Meta, not derived. */
  unfollows: number | null;
}

/**
 * Real follows and unfollows for a single day.
 *
 * Meta exposes both through `follows_and_unfollows` broken down by
 * `follow_type`: FOLLOWER counts new follows, NON_FOLLOWER counts unfollows.
 * Verified against `follower_count` — the FOLLOWER totals match exactly over
 * the same window, which is what confirms the mapping.
 *
 * This replaces deriving unfollows as (gained - net). That estimate was only
 * ever necessary because this metric had not been found; it is measured now.
 *
 * `day` is YYYY-MM-DD. Returns nulls when Meta has no data for the day yet —
 * the current day is typically empty until it closes.
 */
export async function getFollowActivity(day: string, cfg = igConfig()): Promise<FollowActivity> {
  const since = Math.floor(new Date(`${day}T00:00:00.000Z`).getTime() / 1000);
  const until = since + 86_400;

  try {
    const res = await graph<{
      data?: {
        total_value?: { breakdowns?: { results?: { dimension_values: string[]; value: number }[] }[] };
      }[];
    }>(
      `${cfg.igAccountId}/insights`,
      {
        metric: "follows_and_unfollows",
        metric_type: "total_value",
        period: "day",
        breakdown: "follow_type",
        since,
        until,
      },
      cfg
    );

    const results = res.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
    const pick = (k: string) => results.find((r) => r.dimension_values[0] === k)?.value ?? null;
    return { follows: pick("FOLLOWER"), unfollows: pick("NON_FOLLOWER") };
  } catch (err) {
    // Needs instagram_manage_insights; a miss must not fail the whole sync.
    console.warn(`[instagram] follows_and_unfollows unavailable: ${(err as Error).message}`);
    return { follows: null, unfollows: null };
  }
}

/* ----------------------------- Diagnostics ------------------------------ */

export interface TokenInfo {
  valid: boolean;
  neverExpires: boolean;
  expiresAt: string | null;
  scopes: string[];
  appId?: string;
  message: string;
}

/** Inspects the token via /debug_token — powers the Integration Center probe. */
export async function debugToken(cfg = igConfig()): Promise<TokenInfo> {
  if (!env.META_APP_ID || !env.META_APP_SECRET) {
    return {
      valid: false, neverExpires: false, expiresAt: null, scopes: [],
      message: "Set META_APP_ID and META_APP_SECRET to inspect the token",
    };
  }

  const appToken = `${env.META_APP_ID}|${env.META_APP_SECRET}`;
  const url =
    `${GRAPH}/${cfg.version}/debug_token` +
    `?input_token=${encodeURIComponent(cfg.token)}&access_token=${encodeURIComponent(appToken)}`;

  const res = await providerRequest<{
    data?: { is_valid?: boolean; expires_at?: number; scopes?: string[]; app_id?: string };
  }>({ provider: "instagram", url, cacheTtlMs: 0 }).catch((e) => {
    throw toMetaError(e);
  });

  const d = res.data ?? {};
  const neverExpires = d.expires_at === 0;
  return {
    valid: Boolean(d.is_valid),
    neverExpires,
    expiresAt: d.expires_at ? new Date(d.expires_at * 1000).toISOString() : null,
    scopes: d.scopes ?? [],
    appId: d.app_id,
    message: d.is_valid
      ? neverExpires
        ? "Token valid, never expires"
        : `Token valid until ${new Date((d.expires_at ?? 0) * 1000).toLocaleDateString()}`
      : "Token is invalid or revoked",
  };
}

/**
 * Setup helper — walks Pages to find the linked IG account, so a misconfigured
 * Page↔Instagram link reports itself instead of surfacing as empty data.
 */
export async function discoverAccounts(): Promise<
  { pageId: string; pageName: string; igAccountId: string | null; igUsername: string | null }[]
> {
  if (!env.META_ACCESS_TOKEN) throw new MetaApiError("META_ACCESS_TOKEN is not set");
  const cfg: IgConfig = {
    token: env.META_ACCESS_TOKEN,
    igAccountId: "",
    version: env.META_GRAPH_VERSION,
  };

  const res = await graph<{
    data: { id: string; name: string; instagram_business_account?: { id: string; username: string } }[];
  }>("me/accounts", { fields: "id,name,instagram_business_account{id,username}" }, cfg);

  return (res.data ?? []).map((p) => ({
    pageId: p.id,
    pageName: p.name,
    igAccountId: p.instagram_business_account?.id ?? null,
    igUsername: p.instagram_business_account?.username ?? null,
  }));
}
