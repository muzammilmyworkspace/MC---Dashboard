/* ------------------------------------------------------------------ *
 *  MC Nexus — typed API client (Phase 2)
 *
 *  Talks to the Express API in `server/`. The access token lives in memory
 *  only; the refresh token is an httpOnly cookie the browser sends
 *  automatically. A 401 triggers one silent refresh + retry.
 *
 *  Usage:
 *    await api.auth.login(email, password)
 *    const { plans } = await api.dayPlans.list("2026-07")
 * ------------------------------------------------------------------ */

/**
 * Empty string means same-origin: the API now lives in this app's own
 * /api routes, so there is no separate host to point at.
 *
 * That removes a whole class of deployment failure — a missing or stale
 * NEXT_PUBLIC_API_URL used to make the deployed site call the visitor's own
 * localhost. It stays overridable for the case where the API is genuinely
 * hosted elsewhere.
 */
import type { DashboardOverview } from "./dashboard-types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/**
 * Detects the deployment mistake this fallback invites: the app is served
 * from a real host, but NEXT_PUBLIC_API_URL was never set, so every visitor's
 * browser is told to call localhost — their own machine, where nothing is
 * listening. The symptom is an unreachable API on the deployed site while
 * everything works locally, which is easy to mistake for a backend outage.
 *
 * Returns an operator-facing explanation, or null when the config is sane.
 */
export function apiConfigProblem(): string | null {
  if (typeof window === "undefined") return null;

  const pageHost = window.location.hostname;
  const pageIsLocal = pageHost === "localhost" || pageHost === "127.0.0.1" || pageHost === "[::1]";
  if (pageIsLocal) return null;

  let apiHost = "";
  let apiProtocol = "";
  try {
    const url = new URL(API_URL);
    apiHost = url.hostname;
    apiProtocol = url.protocol;
  } catch {
    return `NEXT_PUBLIC_API_URL is not a valid URL ("${API_URL}").`;
  }

  if (apiHost === "localhost" || apiHost === "127.0.0.1") {
    return "NEXT_PUBLIC_API_URL isn't set for this deployment, so the app is trying to call localhost. Set it to your deployed API's URL and redeploy.";
  }

  // An HTTPS page cannot call an HTTP API — browsers block it as mixed content.
  if (window.location.protocol === "https:" && apiProtocol === "http:") {
    return `This site is served over HTTPS but NEXT_PUBLIC_API_URL uses http:// (${API_URL}). Browsers block that. Use an https:// API URL.`;
  }

  return null;
}

export type Role = "TEAM" | "CLIENT";

export interface ApiUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  title: string | null;
  avatarColor: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiRequestError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, err: ApiError) {
    super(err.message);
    this.status = status;
    this.code = err.code;
    this.details = err.details;
  }
}

/* --------------------------- token management --------------------------- */

let accessToken: string | null = null;
const listeners = new Set<(t: string | null) => void>();

export function setAccessToken(token: string | null) {
  accessToken = token;
  listeners.forEach((l) => l(token));
}
export function getAccessToken() {
  return accessToken;
}
export function onAccessTokenChange(fn: (t: string | null) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* ------------------------------ core fetch ------------------------------ */

async function raw<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const res = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: "include" });

  // Access token expired → refresh once, then replay the request.
  if (res.status === 401 && retry && path !== "/api/auth/refresh") {
    const refreshed = await tryRefresh();
    if (refreshed) return raw<T>(path, init, false);
  }

  if (res.status === 204) return undefined as T;

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiRequestError(res.status, payload?.error ?? { code: "UNKNOWN", message: res.statusText });
  }
  return payload as T;
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, { method: "POST", credentials: "include" });
    if (!res.ok) {
      setAccessToken(null);
      return false;
    }
    const data = (await res.json()) as { accessToken: string };
    setAccessToken(data.accessToken);
    return true;
  } catch {
    setAccessToken(null);
    return false;
  }
}

const get = <T>(p: string) => raw<T>(p);
const post = <T>(p: string, body?: unknown) => raw<T>(p, { method: "POST", body: body ? JSON.stringify(body) : undefined });
const patch = <T>(p: string, body?: unknown) => raw<T>(p, { method: "PATCH", body: body ? JSON.stringify(body) : undefined });
const del = <T>(p: string) => raw<T>(p, { method: "DELETE" });

/* ---------------------------- landing pages ------------------------------ */

export type LandingPageStatus = "LIVE" | "BUILDING" | "QUEUED" | "FAILED" | "CANCELED" | "UNKNOWN";

export interface LandingPage {
  id: string;
  name: string;
  source: "VERCEL" | "MANUAL";
  vercelProjectId: string | null;
  vercelProjectName: string;
  productionUrl: string;
  previewUrl: string;
  deploymentId: string | null;
  status: LandingPageStatus;
  framework: string;
  environment: string;
  description: string;
  lastDeploymentAt: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
}

export interface VercelAvailableProject {
  vercelProjectId: string;
  name: string;
  productionUrl: string;
  framework: string;
  status: LandingPageStatus;
  environment: string;
  deploymentId: string | null;
  lastDeploymentAt: string | null;
}

export interface VercelAvailability {
  configured: boolean;
  missingEnv: string[];
  projects: VercelAvailableProject[];
  alreadyImported: string[];
}

export interface VercelConnectionResult {
  ok: boolean;
  message: string;
  account: string | null;
  teamScoped: boolean;
  missingEnv: string[];
}

export interface VercelDeploymentRecord {
  id: string;
  url: string | null;
  status: LandingPageStatus;
  environment: "production" | "preview";
  createdAt: string | null;
  durationMs: number | null;
  commitSha: string | null;
  commitMessage: string | null;
  branch: string | null;
  creator: string | null;
}

/* ------------------------------ endpoints ------------------------------- */

export interface ApiDayPlan {
  id: string;
  date: string;
  goal: string;
  purpose: string;
  primaryPlatform: string;
  time: string;
  status: string;
  gradient: string;
  emoji: string;
  cta: string;
  captionNl: string;
  hashtags: string[];
  storyIdeas: string[];
  captions: Record<string, string>;
  reel: {
    topic: string; hook: string; script: string; bRoll: string[];
    closingCta: string; thumbnailConcept: string; editorNotes: string;
  } | null;
  post: {
    type: string; topic: string; imageConcept: string; photographyDirection: string;
    graphicText: string; designerNotes: string; slides?: number;
  } | null;
  reviews: { id: string; author: string; authorId: string; avatarColor: string; status: string; comment: string; at: string }[];
}

/* ------------------------------- Instagram ------------------------------ */

export interface IgFollowerDay {
  date: string;
  /** Null before daily snapshotting began — those days are reconstructed from insights only. */
  followers: number | null;
  /** Change in total followers vs the previous day. */
  net: number | null;
  /** Gross new follows, reported by Meta. */
  gained: number | null;
  /** Derived (gained − net) — Meta never reports unfollows directly. */
  lost: number | null;
  reach: number | null;
  views: number | null;
  profileViews: number | null;
}

export interface IgTotals {
  gained: number;
  lost: number;
  net: number;
  reach: number;
  profileViews: number;
  /** How many days in the window actually have gained/lost figures. */
  daysCovered: number;
}

export interface IgOverview {
  configured: boolean;
  message?: string;
  latest: IgFollowerDay | null;
  totals: IgTotals | null;
  history: IgFollowerDay[];
  lastSyncAt?: string | null;
  health?: string;
}

export interface IgMediaItem {
  id: string;
  caption: string;
  mediaType: string;
  productType: string;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string;
  timestamp: string;
  likeCount: number;
  commentsCount: number;
  reach: number | null;
  views: number | null;
  saved: number | null;
  shares: number | null;
  totalInteractions: number | null;
  avgWatchTimeMs: number | null;
  engagementRate: number | null;
}

/** Meta OAuth connection state. Deliberately carries no token material. */
export interface MetaConnectionStatus {
  /** Server env vars present and valid. */
  configured: boolean;
  /** A user has completed the OAuth flow. */
  connected: boolean;
  /** Human-readable, safe to render directly. */
  message: string;
  account: {
    igAccountId: string;
    igUsername: string;
    pageId: string;
    pageName: string;
    connectedAt: string;
    tokenExpiresAt: string | null;
  } | null;
  missing: string[];
}

/** Which features the granted Meta permissions actually unlock. */
export interface MetaCapability {
  feature: string;
  requires: string[];
  granted: boolean;
  missing: string[];
  appReview: boolean;
  note?: string;
}

export interface MetaMessagingReadiness {
  available: boolean;
  reason: string;
  missing: string[];
  webhookConfigured: boolean;
}

export interface MetaProfileResponse {
  profile: {
    id: string;
    username: string;
    name: string | null;
    biography: string | null;
    website: string | null;
    profilePictureUrl: string | null;
    followersCount: number;
    followsCount: number;
    mediaCount: number;
  };
  page: { id: string; name: string } | null;
  connectedAt: string | null;
}

export interface MetaMediaItem {
  id: string;
  caption: string;
  mediaType: string;
  productType: string;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string;
  timestamp: string;
  likeCount: number;
  commentsCount: number;
  reach: number | null;
  views: number | null;
  saved: number | null;
  shares: number | null;
  totalInteractions: number | null;
}

export interface MetaInsightsResponse {
  days: number;
  series: { date: string; reach: number | null; newFollowers: number | null }[];
  today: { views?: number; profileViews?: number; accountsEngaged?: number; totalInteractions?: number };
  /** False when Meta returned nothing — render a message, not zeros. */
  available: boolean;
}

export interface MetaComment {
  id: string;
  text: string;
  username: string;
  timestamp: string;
  likeCount: number;
  hidden: boolean;
  replies: { id: string; text: string; username: string; timestamp: string }[];
}

export interface MetaMessagesResponse extends MetaMessagingReadiness {
  conversations: unknown[];
  setupRequired: boolean;
}


/* ------------------------------- Meta Ads -------------------------------- */

export interface AdAccount {
  id: string; accountId: string; name: string;
  status: number; statusLabel: string; currency: string; timezone: string | null;
}

export interface AdInsights {
  spend: number | null; impressions: number | null; reach: number | null;
  clicks: number | null; ctr: number | null; cpc: number | null; cpm: number | null;
  frequency: number | null; conversions: number | null;
  purchaseValue: number | null; roas: number | null;
  dateStart: string | null; dateStop: string | null;
}

export interface AdCampaign {
  id: string; name: string; status: string; objective: string | null; insights: AdInsights;
}

export interface AdsAvailability {
  available: boolean; reason: string | null; accounts: AdAccount[];
}

export type AdDatePreset = "today" | "yesterday" | "last_7d" | "last_30d";

/* ------------------------------- Facebook -------------------------------- */

export interface FacebookPage {
  id: string; name: string; category: string | null;
  fanCount: number | null; followersCount: number | null; pictureUrl: string | null;
  linkedInstagram: { id: string; username: string } | null;
}

/* ----------------------------- Daily report ------------------------------ */

export interface DailyReportRow {
  date: string;
  followers: number | null;
  gained: number | null;
  lost: number | null;
  /** Whether  was measured by Meta or estimated. */
  lostSource: "measured" | "derived" | null;
  net: number | null;
  reach: number | null;
  views: number | null;
  profileViews: number | null;
}

export interface DailyReport {
  configured: boolean;
  message?: string;
  rows: DailyReportRow[];
  totals: {
    gained: number; lost: number; net: number;
    daysWithGainData: number; daysObserved: number;
  } | null;
  provenance?: Record<string, string>;
}

export interface IgDiagnostics {
  configured: boolean;
  missing: string[];
  token: {
    valid: boolean;
    neverExpires?: boolean;
    expiresAt?: string | null;
    scopes?: string[];
    message: string;
  } | null;
  accounts: { pageId: string; pageName: string; igAccountId: string | null; igUsername: string | null }[];
  accountsError?: string | null;
  configuredAccountId?: string;
}

export const api = {
  health: () => get<{ status: string; db: "up" | "down"; uptime: number }>("/health"),

  auth: {
    async login(email: string, password: string) {
      const data = await post<{ user: ApiUser; accessToken: string }>("/api/auth/login", { email, password });
      setAccessToken(data.accessToken);
      return data.user;
    },
    async refresh() {
      const ok = await tryRefresh();
      return ok ? (await get<{ user: ApiUser }>("/api/auth/me")).user : null;
    },
    async logout() {
      await post("/api/auth/logout").catch(() => undefined);
      setAccessToken(null);
    },
    me: () => get<{ user: ApiUser }>("/api/auth/me").then((r) => r.user),
  },

  dayPlans: {
    list: (month: string) => get<{ month: string; plans: ApiDayPlan[] }>(`/api/day-plans?month=${month}`),
    get: (date: string) => get<{ plan: ApiDayPlan }>(`/api/day-plans/${date}`),
    update: (
      date: string,
      body: Partial<{
        hook: string; cta: string; hashtags: string[]; postingTime: string;
        status: string; captionNl: string; captions: Record<string, string>;
      }>
    ) => patch<{ plan: ApiDayPlan }>(`/api/day-plans/${date}`, body),
    review: (date: string, status: "APPROVED" | "REJECTED" | "CHANGES" | "COMMENT", comment = "") =>
      post<{ plan: ApiDayPlan }>(`/api/day-plans/${date}/reviews`, { status, comment }),
  },

  landingPages: {
    list: () => get<{ pages: LandingPage[]; vercelConfigured: boolean }>("/api/landing-pages"),
    vercelProjects: () => get<VercelAvailability>("/api/landing-pages/vercel/projects"),
    testVercel: () => post<VercelConnectionResult>("/api/landing-pages/vercel/test"),
    import: (vercelProjectIds: string[]) =>
      post<{ imported: number; skipped: number; pages: LandingPage[] }>("/api/landing-pages/import", { vercelProjectIds }),
    /** No ids refreshes every tracked page; ids refresh just those cards. */
    sync: (ids?: string[]) =>
      post<{ refreshed: number; failed: number; pages: LandingPage[] }>("/api/landing-pages/sync", ids ? { ids } : {}),
    createManual: (body: { name: string; productionUrl: string; description?: string; status?: LandingPageStatus }) =>
      post<{ page: LandingPage }>("/api/landing-pages", body),
    update: (id: string, body: Partial<Pick<LandingPage, "name" | "description" | "productionUrl" | "previewUrl" | "status">>) =>
      patch<{ page: LandingPage }>(`/api/landing-pages/${id}`, body),
    remove: (id: string) => del<{ removed: boolean; id: string }>(`/api/landing-pages/${id}`),
    deployments: (id: string) =>
      get<{ deployments: VercelDeploymentRecord[]; reason: string | null }>(`/api/landing-pages/${id}/deployments`),
  },

  integrations: {
    list: () => get<{ integrations: Array<{ key: string; name: string; category: string; status: string; health: string; lastSyncAt: string | null; configured: boolean; missingEnv: string[]; scopes: string[]; docsUrl: string }> }>("/api/integrations"),
    authUrl: (key: string) => get<{ url?: string; state?: string; apiKeyOnly?: boolean; message?: string }>(`/api/integrations/${key}/auth-url`),
    test: (key: string) => post<{ ok: boolean; message: string; checkedAt: string }>(`/api/integrations/${key}/test`),
    connect: (key: string) => post<{ key: string; status: string }>(`/api/integrations/${key}/connect`),
    disconnect: (key: string) => post<{ key: string; status: string }>(`/api/integrations/${key}/disconnect`),
    syncRuns: (key: string) => get<{ runs: unknown[] }>(`/api/integrations/${key}/sync-runs`),

    /* --- Meta OAuth connection ------------------------------------------ */
    metaStatus: () => get<MetaConnectionStatus>("/api/integrations/meta-graph/status"),
    metaDisconnect: () => post<MetaConnectionStatus>("/api/integrations/meta-graph/disconnect"),
    metaCapabilities: () =>
      get<{ capabilities: MetaCapability[]; messaging: MetaMessagingReadiness }>(
        "/api/integrations/meta-graph/capabilities"
      ),

    /* --- Instagram data over the OAuth connection ------------------------ */
    metaProfile: () => get<MetaProfileResponse>("/api/integrations/meta-graph/profile"),
    metaMedia: (limit = 12, insights = true) =>
      get<{ media: MetaMediaItem[] }>(`/api/integrations/meta-graph/media?limit=${limit}&insights=${insights}`),
    metaInsights: (days = 28) => get<MetaInsightsResponse>(`/api/integrations/meta-graph/insights?days=${days}`),
    metaComments: (mediaId: string, limit = 25) =>
      get<{ comments: MetaComment[] }>(
        `/api/integrations/meta-graph/comments?mediaId=${encodeURIComponent(mediaId)}&limit=${limit}`
      ),
    metaReplyComment: (commentId: string, message: string) =>
      post<{ id: string }>("/api/integrations/meta-graph/comments/reply", { commentId, message }),
    metaHideComment: (commentId: string, hide: boolean) =>
      post<{ ok: boolean; hidden: boolean }>("/api/integrations/meta-graph/comments/hide", { commentId, hide }),
    metaMessages: () => get<MetaMessagesResponse>("/api/integrations/meta-graph/messages"),

    /* --- Meta Ads (Marketing API) --------------------------------------- */
    adAccounts: () => get<AdsAvailability>("/api/meta-ads/accounts"),
    adInsights: (accountId: string, preset: AdDatePreset = "last_30d") =>
      get<{ accountId: string; preset: string; insights: AdInsights }>(
        `/api/meta-ads/insights?accountId=${encodeURIComponent(accountId)}&preset=${preset}`
      ),
    adCampaigns: (accountId: string, preset: AdDatePreset = "last_30d") =>
      get<{ campaigns: AdCampaign[] }>(
        `/api/meta-ads/campaigns?accountId=${encodeURIComponent(accountId)}&preset=${preset}`
      ),

    /* --- Facebook Pages -------------------------------------------------- */
    facebookPages: () => get<{ pages: FacebookPage[] }>("/api/facebook/pages"),
  },

  instagram: {
    overview: (days = 30) => get<IgOverview>(`/api/instagram/overview?days=${days}`),
    followers: (days = 30) => get<{ history: IgFollowerDay[] }>(`/api/instagram/followers?days=${days}`),
    media: (limit = 24, type: "ALL" | "FEED" | "REELS" | "STORY" = "ALL") =>
      get<{ media: IgMediaItem[] }>(`/api/instagram/media?limit=${limit}&type=${type}`),
    demographics: (breakdown: "age" | "city" | "country" | "gender" = "country") =>
      get<{ breakdown: string; data: Record<string, number>; note: string | null }>(
        `/api/instagram/demographics?breakdown=${breakdown}`
      ),
    sync: () =>
      post<{ ok: boolean; followers?: number; mediaSynced?: number; daysBackfilled?: number; error?: string }>(
        "/api/instagram/sync"
      ),
    diagnostics: () => get<IgDiagnostics>("/api/instagram/diagnostics"),
    dailyReport: (days = 30) => get<DailyReport>(`/api/instagram/daily-report?days=${days}`),
  },

  dashboard: {
    /**
     * Whole executive overview in one request — Instagram, Facebook, Meta Ads,
     * alerts and platform health. Aggregated server-side so the dashboard does
     * not fan out into a dozen browser requests on every load.
     */
    overview: (days = 30) => get<DashboardOverview>(`/api/dashboard/overview?days=${days}`),
  },

  notifications: {
    list: () => get<{ notifications: unknown[]; unread: number }>("/api/notifications"),
    readAll: () => patch("/api/notifications/read-all"),
  },

  users: {
    list: () => get<{ users: ApiUser[] }>("/api/users"),
  },
};
