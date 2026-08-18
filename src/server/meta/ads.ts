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
