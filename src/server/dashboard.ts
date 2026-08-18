import "server-only";
import { env } from "./env";
import { prisma } from "./prisma";
import { getAccount, isConfigured } from "./instagram/client";
import { getFollowerHistory } from "./instagram/sync";
import { adsAvailability, accountInsights, listCampaigns, type AdInsights } from "./meta/ads";
import { listPages } from "./meta/pages";

/* ------------------------------------------------------------------ *
 *  Dashboard aggregation
 *
 *  One request serves the whole executive overview. Each source is
 *  settled independently, so a Meta outage costs one card rather than
 *  the page — the dashboard must never be all-or-nothing.
 *
 *  Anything Meta does not return stays null. The UI distinguishes "no
 *  data" from "zero"; collapsing them would misreport performance.
 * ------------------------------------------------------------------ */

export interface TopContent {
  id: string;
  type: string;
  caption: string;
  permalink: string;
  thumbnailUrl: string | null;
  timestamp: string;
  reach: number | null;
  likes: number;
  comments: number;
  engagementRate: number | null;
}

export interface InstagramBlock {
  available: boolean;
  username: string | null;
  followers: number | null;
  following: number | null;
  contentCount: number | null;
  /** Most recent day Meta has published follow data for. */
  latest: { date: string; newFollowers: number | null; unfollows: number | null; net: number | null } | null;
  /** Percentage change in followers across the window. */
  trendPct: number | null;
  reach: number | null;
  profileViews: number | null;
  history: { date: string; followers: number | null; gained: number | null; lost: number | null; net: number | null }[];
  topContent: TopContent[];
  lastSyncAt: string | null;
}

export interface FacebookBlock {
  available: boolean;
  totalFollowers: number | null;
  pages: { id: string; name: string; followers: number | null; fans: number | null }[];
}

export interface AdsBlock {
  available: boolean;
  reason: string | null;
  accountName: string | null;
  currency: string | null;
  insights: AdInsights | null;
  activeCampaigns: number | null;
  campaigns: { id: string; name: string; status: string; spend: number | null; conversions: number | null; roas: number | null }[];
}

export interface Alert {
  severity: "warning" | "danger" | "info";
  title: string;
  detail: string;
  href?: string;
}

export interface PlatformHealth {
  key: string;
  name: string;
  status: "connected" | "attention" | "not_connected";
  href: string;
  lastSyncAt: string | null;
}

export interface DashboardOverview {
  generatedAt: string;
  instagram: InstagramBlock;
  facebook: FacebookBlock;
  ads: AdsBlock;
  alerts: Alert[];
  platforms: PlatformHealth[];
}

async function instagramBlock(days: number): Promise<InstagramBlock> {
  const empty: InstagramBlock = {
    available: false, username: null, followers: null, following: null, contentCount: null,
    latest: null, trendPct: null, reach: null, profileViews: null,
    history: [], topContent: [], lastSyncAt: null,
  };
  if (!isConfigured() || !env.IG_BUSINESS_ACCOUNT_ID) return empty;

  const accountId = env.IG_BUSINESS_ACCOUNT_ID;

  const [profile, history, media, row] = await Promise.all([
    getAccount().catch(() => null),
    getFollowerHistory(days, accountId).catch(() => []),
    prisma.igMedia
      .findMany({ where: { igAccountId: accountId }, orderBy: { timestamp: "desc" }, take: 60 })
      .catch(() => []),
    prisma.integration.findUnique({ where: { key: "instagram-graph" } }).catch(() => null),
  ]);

  const observed = history.filter((h) => h.followers !== null);
  const first = observed[0];
  const last = observed.at(-1);

  // The newest day Meta has actually published follow figures for. Its data
  // runs about two days behind, so the final row is usually still empty.
  const newestFirst = [...history].reverse();
  const latestWithFollowData =
    // A day with only one half of the pair reports a misleading "net", so a
    // complete day is preferred and a partial one is only a fallback.
    newestFirst.find((h) => h.gained !== null && h.lost !== null) ??
    newestFirst.find((h) => h.gained !== null || h.lost !== null) ??
    null;

  const topContent: TopContent[] = media
    .map((m) => {
      const interactions = m.totalInteractions ?? m.likeCount + m.commentsCount;
      return {
        id: m.id,
        type: m.productType === "REELS" ? "Reel" : m.mediaType === "CAROUSEL_ALBUM" ? "Carousel" : "Post",
        caption: m.caption,
        permalink: m.permalink,
        thumbnailUrl: m.thumbnailUrl ?? m.mediaUrl,
        timestamp: m.timestamp.toISOString(),
        reach: m.reach,
        likes: m.likeCount,
        comments: m.commentsCount,
        engagementRate: m.reach && m.reach > 0 ? Number(((interactions / m.reach) * 100).toFixed(1)) : null,
      };
    })
    .filter((c) => c.reach !== null)
    .sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0))
    .slice(0, 5);

  return {
    available: true,
    username: profile?.username ?? null,
    followers: profile?.followers_count ?? last?.followers ?? null,
    following: profile?.follows_count ?? null,
    contentCount: profile?.media_count ?? null,
    latest: latestWithFollowData
      ? {
          date: latestWithFollowData.date,
          newFollowers: latestWithFollowData.gained,
          unfollows: latestWithFollowData.lost,
          // Prefer the measured pair; the stored net compares snapshots.
          net:
            latestWithFollowData.gained !== null && latestWithFollowData.lost !== null
              ? latestWithFollowData.gained - latestWithFollowData.lost
              : latestWithFollowData.net,
        }
      : null,
    trendPct:
      first?.followers && last?.followers && first.followers > 0
        ? Number((((last.followers - first.followers) / first.followers) * 100).toFixed(1))
        : null,
    reach: history.reduce((s, h) => s + (h.reach ?? 0), 0) || null,
    profileViews: history.reduce((s, h) => s + (h.profileViews ?? 0), 0) || null,
    history: history.map((h) => ({ date: h.date, followers: h.followers, gained: h.gained, lost: h.lost, net: h.net })),
    topContent,
    lastSyncAt: row?.lastSyncAt?.toISOString() ?? null,
  };
}

async function facebookBlock(): Promise<FacebookBlock> {
  try {
    const pages = await listPages();
    return {
      available: pages.length > 0,
      totalFollowers: pages.length ? pages.reduce((s, p) => s + (p.followersCount ?? 0), 0) : null,
      pages: pages.map((p) => ({ id: p.id, name: p.name, followers: p.followersCount, fans: p.fanCount })),
    };
  } catch {
    return { available: false, totalFollowers: null, pages: [] };
  }
}

async function adsBlock(): Promise<AdsBlock> {
  const none: AdsBlock = {
    available: false, reason: null, accountName: null, currency: null,
    insights: null, activeCampaigns: null, campaigns: [],
  };

  try {
    const availability = await adsAvailability();
    if (!availability.available || !availability.accounts.length) {
      return { ...none, reason: availability.reason };
    }

    const account = availability.accounts[0];
    const [insights, campaigns] = await Promise.all([
      accountInsights(account.id, "last_30d").catch(() => null),
      listCampaigns(account.id, "last_30d", 25).catch(() => []),
    ]);

    const withSpend = campaigns
      .filter((c) => c.insights.spend !== null)
      .sort((a, b) => (b.insights.spend ?? 0) - (a.insights.spend ?? 0));

    return {
      available: true,
      reason: null,
      accountName: account.name,
      currency: account.currency,
      insights,
      activeCampaigns: campaigns.filter((c) => c.status === "ACTIVE").length,
      campaigns: (withSpend.length ? withSpend : campaigns).slice(0, 4).map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        spend: c.insights.spend,
        conversions: c.insights.conversions,
        roas: c.insights.roas,
      })),
    };
  } catch (err) {
    return { ...none, reason: err instanceof Error ? err.message : "Marketing API unavailable" };
  }
}

/** Only genuine problems. An empty list means everything is healthy. */
function buildAlerts(ig: InstagramBlock, ads: AdsBlock): Alert[] {
  const alerts: Alert[] = [];

  if (ig.available && ig.lastSyncAt) {
    const hours = (Date.now() - new Date(ig.lastSyncAt).getTime()) / 3_600_000;
    if (hours > 36) {
      alerts.push({
        severity: "warning",
        title: "Instagram has not updated recently",
        detail: `Last update was ${Math.round(hours)} hours ago. Follower history only builds while the daily sync runs, and a missed day cannot be recovered.`,
        href: "/instagram",
      });
    }
  }

  if (!ads.available && ads.reason) {
    alerts.push({ severity: "warning", title: "Meta Ads needs attention", detail: ads.reason, href: "/meta" });
  }

  // Money going out with nothing measurable coming back is worth surfacing.
  const spend = ads.insights?.spend ?? null;
  const conversions = ads.insights?.conversions ?? null;
  if (spend !== null && spend > 50 && conversions === 0) {
    alerts.push({
      severity: "warning",
      title: "Ad spend with no conversions",
      detail: `${ads.currency ?? ""} ${spend.toLocaleString()} spent in the last 30 days with no conversions recorded.`,
      href: "/meta",
    });
  }

  const roas = ads.insights?.roas ?? null;
  if (roas !== null && roas < 1 && (spend ?? 0) > 0) {
    alerts.push({
      severity: "info",
      title: "Ads are returning less than they cost",
      detail: `Return on ad spend is ${roas.toFixed(2)}x. Below 1x means the campaigns spend more than they bring back.`,
      href: "/meta",
    });
  }

  return alerts;
}

export async function getDashboardOverview(days = 30): Promise<DashboardOverview> {
  const [ig, fb, ads, integrations] = await Promise.all([
    instagramBlock(days),
    facebookBlock(),
    adsBlock(),
    prisma.integration.findMany().catch(() => []),
  ]);

  const byKey = new Map(integrations.map((i) => [i.key, i]));
  const health = (key: string, live: boolean): PlatformHealth["status"] =>
    live ? "connected" : byKey.get(key)?.status === "CONNECTED" ? "connected" : "not_connected";

  const platforms: PlatformHealth[] = [
    { key: "instagram", name: "Instagram", href: "/instagram", status: health("instagram-graph", ig.available), lastSyncAt: ig.lastSyncAt },
    { key: "facebook", name: "Facebook", href: "/facebook", status: health("meta-graph", fb.available), lastSyncAt: null },
    { key: "meta-ads", name: "Meta Ads", href: "/meta", status: health("meta-graph", ads.available), lastSyncAt: null },
    { key: "analytics", name: "Analytics", href: "/analytics", status: "not_connected", lastSyncAt: null },
    { key: "google", name: "Google", href: "/google", status: "not_connected", lastSyncAt: null },
    { key: "youtube", name: "YouTube", href: "/youtube", status: "not_connected", lastSyncAt: null },
    { key: "tiktok", name: "TikTok", href: "/tiktok", status: "not_connected", lastSyncAt: null },
  ];

  return {
    generatedAt: new Date().toISOString(),
    instagram: ig,
    facebook: fb,
    ads,
    alerts: buildAlerts(ig, ads),
    platforms,
  };
}
