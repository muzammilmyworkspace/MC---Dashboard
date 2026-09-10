import "server-only";
import { env } from "../env";
import { providerRequest } from "../http";

/* ------------------------------------------------------------------ *
 *  Meta Marketing API (Ads Manager)
 *
 *  Verified against the live token: ad accounts, campaigns and insights
 *  all read successfully with ads_read + ads_management.
 *
 *  Every figure returned here comes from Meta. Where a metric is absent
 *  for a date range — which is normal, Meta omits rather than zeroes —
 *  it is surfaced as null so the UI can distinguish "no spend" from
 *  "no data".
 * ------------------------------------------------------------------ */

const GRAPH = "https://graph.facebook.com";

export type DatePreset = "today" | "yesterday" | "last_7d" | "last_30d";

export class AdsUnavailableError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "AdsUnavailableError";
    this.code = code;
  }
}

function requireToken(): string {
  const token = (env.META_ACCESS_TOKEN ?? "").trim();
  if (!token) {
    throw new AdsUnavailableError("no_token", "META_ACCESS_TOKEN is not set.");
  }
  return token;
}

/** Token travels in the header so it never enters a cache key or a log line. */
async function ads<T>(path: string, params: Record<string, string | number> = {}, cacheTtlMs = 60_000): Promise<T> {
  const token = requireToken();
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v));

  return providerRequest<T>({
    provider: "meta-ads",
    url: `${GRAPH}/${env.META_GRAPH_VERSION}/${path}?${qs.toString()}`,
    token,
    cacheTtlMs,
  });
}

/* -------------------------------- Accounts -------------------------------- */

export interface AdAccount {
  id: string;
  accountId: string;
  name: string;
  /** Meta's numeric status: 1 = active, 2 = disabled, 3 = unsettled, … */
  status: number;
  statusLabel: string;
  currency: string;
  timezone: string | null;
}

const STATUS_LABELS: Record<number, string> = {
  1: "Active",
  2: "Disabled",
  3: "Unsettled",
  7: "Pending review",
  8: "Pending closure",
  9: "In grace period",
  100: "Closed",
  101: "Pending settlement",
};

export async function listAdAccounts(): Promise<AdAccount[]> {
  const res = await ads<{
    data?: { id: string; account_id?: string; name?: string; account_status?: number; currency?: string; timezone_name?: string }[];
  }>("me/adaccounts", {
    fields: "id,account_id,name,account_status,currency,timezone_name",
    limit: 25,
  });

  return (res.data ?? []).map((a) => ({
    id: a.id,
    accountId: a.account_id ?? a.id.replace(/^act_/, ""),
    name: a.name ?? "(unnamed account)",
    status: a.account_status ?? 0,
    statusLabel: STATUS_LABELS[a.account_status ?? 0] ?? "Unknown",
    currency: a.currency ?? "",
    timezone: a.timezone_name ?? null,
  }));
}

/* -------------------------------- Insights -------------------------------- */

export interface AdInsights {
  spend: number | null;
  impressions: number | null;
  reach: number | null;
  clicks: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  frequency: number | null;
  /** Absent unless a conversion event is configured on the account. */
  conversions: number | null;
  purchaseValue: number | null;
  roas: number | null;
  dateStart: string | null;
  dateStop: string | null;
}

/** Meta returns every figure as a string, and omits metrics rather than zeroing them. */
function num(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

interface RawInsight {
  spend?: string; impressions?: string; reach?: string; clicks?: string;
  ctr?: string; cpc?: string; cpm?: string; frequency?: string;
  date_start?: string; date_stop?: string;
  actions?: { action_type: string; value: string }[];
  action_values?: { action_type: string; value: string }[];
  purchase_roas?: { action_type: string; value: string }[];
}

function shapeInsights(raw: RawInsight | undefined): AdInsights {
  const r = raw ?? {};
  const purchases = r.actions?.find((a) => a.action_type === "purchase" || a.action_type === "offsite_conversion.fb_pixel_purchase");
  const leads = r.actions?.find((a) => a.action_type === "lead" || a.action_type === "onsite_conversion.lead_grouped");
  const value = r.action_values?.find((a) => a.action_type === "purchase" || a.action_type === "offsite_conversion.fb_pixel_purchase");
  const roas = r.purchase_roas?.[0];

  return {
    spend: num(r.spend),
    impressions: num(r.impressions),
    reach: num(r.reach),
    clicks: num(r.clicks),
    ctr: num(r.ctr),
    cpc: num(r.cpc),
    cpm: num(r.cpm),
    frequency: num(r.frequency),
    conversions: num(purchases?.value) ?? num(leads?.value),
    purchaseValue: num(value?.value),
    roas: num(roas?.value),
    dateStart: r.date_start ?? null,
    dateStop: r.date_stop ?? null,
  };
}

const INSIGHT_FIELDS =
  "spend,impressions,reach,clicks,ctr,cpc,cpm,frequency,actions,action_values,purchase_roas";

export async function accountInsights(accountId: string, preset: DatePreset): Promise<AdInsights> {
  const res = await ads<{ data?: RawInsight[] }>(`${accountId}/insights`, {
    fields: INSIGHT_FIELDS,
    date_preset: preset,
  });
  return shapeInsights(res.data?.[0]);
}

/* -------------------------------- Campaigns ------------------------------- */

export interface Campaign {
  id: string;
  name: string;
  status: string;
  objective: string | null;
  insights: AdInsights;
}

/**
 * Campaigns with their insights, fetched in a single request.
 *
 * Meta can nest insights inside the campaign edge, which avoids one call per
 * campaign — worth doing, since the platform enforces a per-app call budget.
 */
export async function listCampaigns(accountId: string, preset: DatePreset, limit = 25): Promise<Campaign[]> {
  const res = await ads<{
    data?: { id: string; name?: string; status?: string; objective?: string; insights?: { data?: RawInsight[] } }[];
  }>(`${accountId}/campaigns`, {
    fields: `id,name,status,objective,insights.date_preset(${preset}){${INSIGHT_FIELDS}}`,
    limit,
  });

  return (res.data ?? []).map((c) => ({
    id: c.id,
    name: c.name ?? "(unnamed campaign)",
    status: c.status ?? "UNKNOWN",
    objective: c.objective ?? null,
    insights: shapeInsights(c.insights?.data?.[0]),
  }));
}

/* ------------------------------ Insights by level -------------------------- */

/**
 * One flat, aggregated report instead of nesting `insights{...}` inside
 * every ad-set or ad returned by its own edge.
 *
 * Nesting insights inside e.g. `act_X/ads?fields=...,insights{...}` makes
 * Meta compute a separate aggregation per row — fine for a handful of
 * campaigns, but for dozens of ad sets or ads it regularly blew past
 * Vercel's 30s function limit and took the whole page down with it.
 * `act_X/insights?level=ad` asks for the same numbers as one report, which
 * is the query pattern Meta's own Ads Manager reporting uses and returns in
 * a fraction of the time.
 */
async function insightsByLevel(
  accountId: string,
  preset: DatePreset,
  level: "campaign" | "adset" | "ad",
  limit = 500
): Promise<Map<string, AdInsights>> {
  const idField = `${level}_id`;
  const res = await ads<{ data?: (RawInsight & Record<string, string>)[] }>(`${accountId}/insights`, {
    level,
    fields: `${idField},${INSIGHT_FIELDS}`,
    date_preset: preset,
    limit,
  });

  const map = new Map<string, AdInsights>();
  for (const row of res.data ?? []) {
    const id = row[idField];
    if (id) map.set(id, shapeInsights(row));
  }
  return map;
}

/* -------------------------------- Ad Sets --------------------------------- */

export interface AdSet {
  id: string;
  name: string;
  campaignId: string;
  status: string;
  /** Meta returns budgets in the account currency's minor unit (cents for EUR/USD). Already divided down. */
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  insights: AdInsights;
}

/** Meta reports budgets in minor units (cents); everything else in this file is already in major units. */
function minorToMajor(v: unknown): number | null {
  const n = num(v);
  return n === null ? null : n / 100;
}

/**
 * Every ad set in the account, tagged with its campaign — the audit groups
 * them client-side rather than one call per campaign. Metadata and insights
 * are fetched in parallel and merged by id, rather than nested, so a large
 * account doesn't time out (see `insightsByLevel`).
 */
export async function listAdSets(accountId: string, preset: DatePreset, limit = 200): Promise<AdSet[]> {
  const [res, insightsMap] = await Promise.all([
    ads<{
      data?: { id: string; name?: string; campaign_id?: string; status?: string; daily_budget?: string; lifetime_budget?: string }[];
    }>(`${accountId}/adsets`, { fields: "id,name,campaign_id,status,daily_budget,lifetime_budget", limit }),
    insightsByLevel(accountId, preset, "adset"),
  ]);

  return (res.data ?? []).map((s) => ({
    id: s.id,
    name: s.name ?? "(unnamed ad set)",
    campaignId: s.campaign_id ?? "",
    status: s.status ?? "UNKNOWN",
    dailyBudget: minorToMajor(s.daily_budget),
    lifetimeBudget: minorToMajor(s.lifetime_budget),
    insights: insightsMap.get(s.id) ?? shapeInsights(undefined),
  }));
}

/* ----------------------------- Ads & creatives ----------------------------- */

export type AdMediaType = "IMAGE" | "VIDEO" | "CAROUSEL" | "UNKNOWN";

export interface AdCreative {
  id: string;
  name: string;
  /** The ad copy — the primary text shown with the ad. */
  bodyText: string | null;
  title: string | null;
  mediaType: AdMediaType;
  thumbnailUrl: string | null;
  imageUrl: string | null;
  videoId: string | null;
  callToAction: string | null;
}

export interface Ad {
  id: string;
  name: string;
  adsetId: string;
  campaignId: string;
  status: string;
  creative: AdCreative | null;
  insights: AdInsights;
}

interface RawCreative {
  id?: string;
  name?: string;
  thumbnail_url?: string;
  image_url?: string;
  body?: string;
  title?: string;
  object_type?: string;
  video_id?: string;
  object_story_spec?: {
    link_data?: {
      message?: string; name?: string; picture?: string;
      call_to_action?: { type?: string };
      child_attachments?: unknown[];
    };
    video_data?: { message?: string; title?: string; image_url?: string; video_id?: string; call_to_action?: { type?: string } };
  };
}

function parseCreative(raw: RawCreative | undefined): AdCreative | null {
  if (!raw) return null;
  const link = raw.object_story_spec?.link_data;
  const video = raw.object_story_spec?.video_data;
  const videoId = raw.video_id ?? video?.video_id ?? null;
  const isCarousel = Boolean(link?.child_attachments?.length) || raw.object_type === "CAROUSEL";

  let mediaType: AdMediaType = "UNKNOWN";
  if (isCarousel) mediaType = "CAROUSEL";
  else if (videoId) mediaType = "VIDEO";
  else if (raw.image_url || raw.thumbnail_url || link?.picture) mediaType = "IMAGE";

  return {
    id: raw.id ?? "",
    name: raw.name ?? "",
    bodyText: raw.body ?? link?.message ?? video?.message ?? null,
    title: raw.title ?? link?.name ?? video?.title ?? null,
    mediaType,
    thumbnailUrl: raw.thumbnail_url ?? video?.image_url ?? null,
    imageUrl: raw.image_url ?? link?.picture ?? null,
    videoId,
    callToAction: link?.call_to_action?.type ?? video?.call_to_action?.type ?? null,
  };
}

const CREATIVE_FIELDS = "id,name,thumbnail_url,image_url,body,title,object_type,video_id,object_story_spec";

/**
 * Every ad in the account — the audit's actual unit. Each one carries its
 * own creative (the ad copy, the image or video) and its own insights, so
 * "which ad copy produced which sales" is answered directly, not estimated
 * from the ad set it sits in.
 */
export async function listAds(accountId: string, preset: DatePreset, limit = 200): Promise<Ad[]> {
  const [res, insightsMap] = await Promise.all([
    ads<{
      data?: {
        id: string; name?: string; adset_id?: string; campaign_id?: string; status?: string;
        creative?: RawCreative;
      }[];
    }>(`${accountId}/ads`, { fields: `id,name,adset_id,campaign_id,status,creative{${CREATIVE_FIELDS}}`, limit }),
    insightsByLevel(accountId, preset, "ad"),
  ]);

  return (res.data ?? []).map((a) => ({
    id: a.id,
    name: a.name ?? "(unnamed ad)",
    adsetId: a.adset_id ?? "",
    campaignId: a.campaign_id ?? "",
    status: a.status ?? "UNKNOWN",
    creative: parseCreative(a.creative),
    insights: insightsMap.get(a.id) ?? shapeInsights(undefined),
  }));
}

/* ------------------------------ Video preview ------------------------------ */

/**
 * The playable file behind a creative's video, for the hover preview.
 *
 * Deliberately not fetched in bulk alongside `listAds` — that is exactly the
 * per-row-expansion pattern that timed out the ads list before. This is
 * called once, on demand, only for the one video someone is actually
 * hovering over.
 */
export async function getVideoSource(videoId: string): Promise<{ source: string | null; thumbnailUrl: string | null }> {
  const res = await ads<{ source?: string; picture?: string }>(videoId, { fields: "source,picture" }, 10 * 60_000);
  return { source: res.source ?? null, thumbnailUrl: res.picture ?? null };
}

/* ------------------------------ Availability ------------------------------ */

export interface AdsAvailability {
  available: boolean;
  reason: string | null;
  accounts: AdAccount[];
}

/**
 * Whether the Marketing API is genuinely reachable with this token.
 *
 * Checked by calling it rather than by inspecting permissions: a granted
 * scope does not guarantee the token can see an ad account, and the UI must
 * not claim a capability it has not proven.
 */
export async function adsAvailability(): Promise<AdsAvailability> {
  if (!(env.META_ACCESS_TOKEN ?? "").trim()) {
    return { available: false, reason: "META_ACCESS_TOKEN is not set.", accounts: [] };
  }
  try {
    const accounts = await listAdAccounts();
    if (accounts.length === 0) {
      return {
        available: false,
        reason: "The token is valid but no ad accounts are visible to it. Assign an ad account to this user in Meta Business Settings.",
        accounts: [],
      };
    }
    return { available: true, reason: null, accounts };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const needsPermission = /permission|OAuth|#10|#200|#294/i.test(message);
    return {
      available: false,
      reason: needsPermission
        ? "The token lacks ads_read or ads_management. Regenerate it with those permissions."
        : "Could not reach the Marketing API.",
      accounts: [],
    };
  }
}
