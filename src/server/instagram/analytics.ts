import "server-only";
import { prisma } from "../prisma";
import { env } from "../env";
import { getAccount, isConfigured } from "./client";
import {
  DAY_MS as DAY, isoDay as iso, midnightUtc as midnight, eachDay, groupDays,
  labelFor, sumOrNull, lastOrNull, engagementRate as rate, netGrowth,
  type Granularity,
} from "@/lib/instagram-math";

/* ------------------------------------------------------------------ *
 *  Instagram analytics
 *
 *  One query, one response. Everything the analytics screen shows is
 *  assembled here so the browser makes a single request rather than a
 *  card-by-card fan-out at Meta.
 *
 *  Two rules run through the whole file:
 *
 *   1. A metric Meta did not return stays null. Null means "not
 *      reported"; 0 means "reported as zero". Collapsing the two would
 *      turn a gap in reporting into a claim about performance.
 *
 *   2. Totals sum only the days that carry the figure, and rates are
 *      recomputed from summed numerator and denominator rather than
 *      averaged from daily rates — averaging percentages weights a day
 *      with 3 views the same as a day with 3,000.
 * ------------------------------------------------------------------ */

export type { Granularity };

export interface AnalyticsQuery {
  startDate: string;
  endDate: string;
  granularity: Granularity;
}

/** A metric that may legitimately have no value. */
type Nullable = number | null;

export interface Bucket {
  /** ISO date of the bucket start — also the row key. */
  key: string;
  label: string;
  startDate: string;
  endDate: string;
  /** Follower count at the close of the bucket, when a snapshot exists. */
  followers: Nullable;
  newFollowers: Nullable;
  unfollows: Nullable;
  netGrowth: Nullable;
  reach: Nullable;
  views: Nullable;
  profileViews: Nullable;
  websiteClicks: Nullable;
  accountsEngaged: Nullable;
  totalInteractions: Nullable;
  likes: Nullable;
  comments: Nullable;
  shares: Nullable;
  saves: Nullable;
  replies: Nullable;
  /** Content published inside the bucket. */
  posts: number;
  reels: number;
  carousels: number;
  stories: number;
  /** Interactions ÷ reach, as a percentage. Null when reach is unknown. */
  engagementRate: Nullable;
}

export interface ContentItem {
  id: string;
  type: "Reel" | "Carousel" | "Post";
  caption: string;
  permalink: string;
  thumbnailUrl: string | null;
  timestamp: string;
  reach: Nullable;
  views: Nullable;
  likes: number;
  comments: number;
  shares: Nullable;
  saves: Nullable;
  totalInteractions: Nullable;
  engagementRate: Nullable;
  avgWatchTimeMs: Nullable;
  profileVisits: Nullable;
  followsFromPost: Nullable;
}

export interface Totals {
  newFollowers: Nullable;
  unfollows: Nullable;
  netGrowth: Nullable;
  reach: Nullable;
  views: Nullable;
  profileViews: Nullable;
  websiteClicks: Nullable;
  accountsEngaged: Nullable;
  totalInteractions: Nullable;
  likes: Nullable;
  comments: Nullable;
  shares: Nullable;
  saves: Nullable;
  replies: Nullable;
  engagementRate: Nullable;
  /** How many days in the range carried each side of the follow pair. */
  daysWithFollowData: number;
  daysInRange: number;
}

export interface ContentBreakdown {
  total: number;
  reels: number;
  carousels: number;
  posts: number;
  stories: number;
}

export interface GroupStats {
  count: number;
  reach: Nullable;
  views: Nullable;
  likes: number;
  comments: number;
  shares: Nullable;
  saves: Nullable;
  totalInteractions: Nullable;
  avgReach: Nullable;
  avgViews: Nullable;
  engagementRate: Nullable;
}

export interface StoryStats {
  published: number;
  reach: Nullable;
  views: Nullable;
  replies: Nullable;
  navigation: Nullable;
  totalInteractions: Nullable;
}

export interface PublishingDay {
  /** 0 = Sunday. */
  weekday: number;
  label: string;
  posts: number;
  reels: number;
  total: number;
}

export type Provenance = "measured" | "derived" | "unavailable";

export interface AnalyticsResponse {
  configured: boolean;
  range: { startDate: string; endDate: string; granularity: Granularity; days: number };
  profile: {
    username: string | null;
    followers: Nullable;
    following: Nullable;
    contentCount: Nullable;
  } | null;
  /** Change in followers across the range, from the measured pair. */
  followerChange: { net: Nullable; percent: Nullable };
  totals: Totals;
  buckets: Bucket[];
  content: ContentBreakdown;
  reels: GroupStats;
  posts: GroupStats;
  stories: StoryStats;
  topContent: ContentItem[];
  needsAttention: ContentItem[];
  publishing: {
    byWeekday: PublishingDay[];
    perDay: number | null;
    perWeek: number | null;
  };
  provenance: Record<string, Provenance>;
  lastSyncAt: string | null;
  /** Days at the end of the range Meta has not published yet. */
  pendingDays: number;
}

/* -------------------------------- the query ------------------------------ */

const empty: AnalyticsResponse = {
  configured: false,
  range: { startDate: "", endDate: "", granularity: "daily", days: 0 },
  profile: null,
  followerChange: { net: null, percent: null },
  totals: {
    newFollowers: null, unfollows: null, netGrowth: null, reach: null, views: null,
    profileViews: null, websiteClicks: null, accountsEngaged: null, totalInteractions: null,
    likes: null, comments: null, shares: null, saves: null, replies: null,
    engagementRate: null, daysWithFollowData: 0, daysInRange: 0,
  },
  buckets: [],
  content: { total: 0, reels: 0, carousels: 0, posts: 0, stories: 0 },
  reels: emptyGroup(),
  posts: emptyGroup(),
  stories: { published: 0, reach: null, views: null, replies: null, navigation: null, totalInteractions: null },
  topContent: [],
  needsAttention: [],
  publishing: { byWeekday: [], perDay: null, perWeek: null },
  provenance: {},
  lastSyncAt: null,
  pendingDays: 0,
};

function emptyGroup(): GroupStats {
  return {
    count: 0, reach: null, views: null, likes: 0, comments: 0, shares: null,
    saves: null, totalInteractions: null, avgReach: null, avgViews: null, engagementRate: null,
  };
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export async function getAnalytics(query: AnalyticsQuery): Promise<AnalyticsResponse> {
  const accountId = env.IG_BUSINESS_ACCOUNT_ID;
  if (!isConfigured() || !accountId) return { ...empty };

  const { startDate, endDate, granularity } = query;
  const days = eachDay(startDate, endDate);

  const [profile, snapshots, media, stories, integration] = await Promise.all([
    getAccount().catch(() => null),
    prisma.igDailySnapshot.findMany({
      where: { igAccountId: accountId, date: { gte: midnight(startDate), lte: midnight(endDate) } },
      orderBy: { date: "asc" },
    }),
    prisma.igMedia.findMany({
      where: {
        igAccountId: accountId,
        // The upper bound is the end of the last day, not its midnight.
        timestamp: { gte: midnight(startDate), lt: new Date(midnight(endDate).getTime() + DAY) },
      },
      orderBy: { timestamp: "desc" },
    }),
    prisma.igStory.findMany({
      where: {
        igAccountId: accountId,
        timestamp: { gte: midnight(startDate), lt: new Date(midnight(endDate).getTime() + DAY) },
      },
    }),
    prisma.integration.findUnique({ where: { key: "instagram-graph" } }).catch(() => null),
  ]);

  const snapByDay = new Map(snapshots.map((s) => [iso(s.date), s]));

  /* ------------------------------- buckets ------------------------------- */

  const groups = groupDays(days, granularity);

  const mediaCountsFor = (dayKeys: Set<string>) => {
    let posts = 0, reels = 0, carousels = 0;
    for (const m of media) {
      if (!dayKeys.has(iso(m.timestamp))) continue;
      if (m.productType === "REELS") reels++;
      else if (m.mediaType === "CAROUSEL_ALBUM") carousels++;
      else posts++;
    }
    return { posts, reels, carousels };
  };

  const buckets: Bucket[] = groups.map(({ key, days: dayKeys }) => {
    const set = new Set(dayKeys);
    const rows = dayKeys.map((d) => snapByDay.get(d)).filter((r) => r !== undefined);

    const col = (pick: (r: (typeof snapshots)[number]) => Nullable) => sumOrNull(rows.map(pick));

    const newFollowers = col((r) => r.newFollowers);
    const unfollows = col((r) => r.unfollows);
    const interactions = col((r) => r.totalInteractions);
    const reach = col((r) => r.reach);
    const counts = mediaCountsFor(set);

    // Follower count is a level, not a flow: the bucket takes the last
    // observed reading rather than a sum, which would be meaningless.

    return {
      key,
      label: labelFor(key, granularity, endDate, startDate),
      startDate: dayKeys[0],
      endDate: dayKeys[dayKeys.length - 1],
      followers: lastOrNull(rows.map((r) => r.followersCount)),
      newFollowers,
      unfollows,
      netGrowth: netGrowth(newFollowers, unfollows),
      reach,
      views: col((r) => r.views),
      profileViews: col((r) => r.profileViews),
      websiteClicks: col((r) => r.websiteClicks),
      accountsEngaged: col((r) => r.accountsEngaged),
      totalInteractions: interactions,
      likes: col((r) => r.likes),
      comments: col((r) => r.comments),
      shares: col((r) => r.shares),
      saves: col((r) => r.saves),
      replies: col((r) => r.replies),
      posts: counts.posts,
      reels: counts.reels,
      carousels: counts.carousels,
      stories: stories.filter((s) => set.has(iso(s.timestamp))).length,
      engagementRate: rate(interactions, reach),
    };
  });

  /* -------------------------------- totals ------------------------------- */

  const paired = snapshots.filter((s) => s.newFollowers !== null && s.unfollows !== null);
  const gainedTotal = paired.length ? paired.reduce((a, s) => a + (s.newFollowers ?? 0), 0) : null;
  const lostTotal = paired.length ? paired.reduce((a, s) => a + (s.unfollows ?? 0), 0) : null;

  const totalInteractions = sumOrNull(snapshots.map((s) => s.totalInteractions));
  const totalReach = sumOrNull(snapshots.map((s) => s.reach));

  const totals: Totals = {
    newFollowers: gainedTotal,
    unfollows: lostTotal,
    netGrowth: netGrowth(gainedTotal, lostTotal),
    reach: totalReach,
    views: sumOrNull(snapshots.map((s) => s.views)),
    profileViews: sumOrNull(snapshots.map((s) => s.profileViews)),
    websiteClicks: sumOrNull(snapshots.map((s) => s.websiteClicks)),
    accountsEngaged: sumOrNull(snapshots.map((s) => s.accountsEngaged)),
    totalInteractions,
    likes: sumOrNull(snapshots.map((s) => s.likes)),
    comments: sumOrNull(snapshots.map((s) => s.comments)),
    shares: sumOrNull(snapshots.map((s) => s.shares)),
    saves: sumOrNull(snapshots.map((s) => s.saves)),
    replies: sumOrNull(snapshots.map((s) => s.replies)),
    engagementRate: rate(totalInteractions, totalReach),
    daysWithFollowData: paired.length,
    daysInRange: days.length,
  };

  /* ------------------------------- content ------------------------------- */

  const toItem = (m: (typeof media)[number]): ContentItem => {
    const interactions = m.totalInteractions ?? m.likeCount + m.commentsCount;
    return {
      id: m.id,
      type: m.productType === "REELS" ? "Reel" : m.mediaType === "CAROUSEL_ALBUM" ? "Carousel" : "Post",
      caption: m.caption,
      permalink: m.permalink,
      thumbnailUrl: m.thumbnailUrl ?? m.mediaUrl,
      timestamp: m.timestamp.toISOString(),
      reach: m.reach,
      views: m.views,
      likes: m.likeCount,
      comments: m.commentsCount,
      shares: m.shares,
      saves: m.saved,
      totalInteractions: m.totalInteractions ?? interactions,
      engagementRate: rate(m.totalInteractions ?? interactions, m.reach),
      avgWatchTimeMs: m.avgWatchTimeMs,
      profileVisits: m.profileVisits,
      followsFromPost: m.followsFromPost,
    };
  };

  const items = media.map(toItem);
  const reelItems = items.filter((i) => i.type === "Reel");
  const postItems = items.filter((i) => i.type !== "Reel");

  const groupStats = (group: ContentItem[]): GroupStats => {
    if (group.length === 0) return emptyGroup();
    const reach = sumOrNull(group.map((g) => g.reach));
    const views = sumOrNull(group.map((g) => g.views));
    const interactions = sumOrNull(group.map((g) => g.totalInteractions));
    const withReach = group.filter((g) => g.reach !== null).length;
    const withViews = group.filter((g) => g.views !== null).length;
    return {
      count: group.length,
      reach,
      views,
      likes: group.reduce((a, g) => a + g.likes, 0),
      comments: group.reduce((a, g) => a + g.comments, 0),
      shares: sumOrNull(group.map((g) => g.shares)),
      saves: sumOrNull(group.map((g) => g.saves)),
      totalInteractions: interactions,
      // Averaged across the items that actually reported, not the whole group.
      avgReach: reach !== null && withReach > 0 ? Math.round(reach / withReach) : null,
      avgViews: views !== null && withViews > 0 ? Math.round(views / withViews) : null,
      engagementRate: rate(interactions, reach),
    };
  };

  // Only content Meta actually reported reach for can be ranked. An item with
  // no reach figure is unmeasured, not underperforming, and naming it the
  // worst would be a claim the data does not support.
  const rankable = items.filter((i) => i.reach !== null && i.reach > 0);
  const byReach = [...rankable].sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0));

  const topContent = byReach.slice(0, 10);
  const topIds = new Set(topContent.map((i) => i.id));
  /**
   * The weakest performers, excluding anything already shown as a top item.
   *
   * Below eight ranked pieces the two lists would largely be the same content
   * under two contradictory headings, so the section is simply empty instead.
   */
  const needsAttention =
    byReach.length >= 8 ? byReach.slice().reverse().filter((i) => !topIds.has(i.id)).slice(0, 5) : [];

  /* ----------------------------- publishing ------------------------------ */

  const byWeekday: PublishingDay[] = WEEKDAYS.map((label, weekday) => {
    const onDay = media.filter((m) => m.timestamp.getUTCDay() === weekday);
    const reels = onDay.filter((m) => m.productType === "REELS").length;
    return { weekday, label, reels, posts: onDay.length - reels, total: onDay.length };
  });

  /* ------------------------------ provenance ----------------------------- */

  const provenance: Record<string, Provenance> = {
    followers: "measured",
    following: "measured",
    newFollowers: "measured",
    unfollows: snapshots.some((s) => s.unfollows === null && s.newFollowers !== null) ? "derived" : "measured",
    netGrowth: "measured",
    reach: "measured",
    views: "measured",
    profileViews: "measured",
    websiteClicks: "measured",
    accountsEngaged: "measured",
    totalInteractions: "measured",
    likes: "measured",
    comments: "measured",
    shares: "measured",
    saves: "measured",
    replies: "measured",
    stories: "measured",
    // Computed here from two measured figures rather than reported by Meta.
    engagementRate: "derived",
    // Removed from the Instagram API by Meta; there is no substitute.
    impressions: "unavailable",
  };

  // Meta publishes follow data about two days late, so the tail of any range
  // ending today is legitimately empty rather than zero.
  const pendingDays = days.filter((d) => {
    const row = snapByDay.get(d);
    return !row || (row.newFollowers === null && row.unfollows === null);
  }).length;

  const publishedDays = days.length;

  return {
    configured: true,
    range: { startDate, endDate, granularity, days: days.length },
    profile: profile
      ? {
          username: profile.username,
          followers: profile.followers_count,
          following: profile.follows_count,
          contentCount: profile.media_count,
        }
      : null,
    followerChange: {
      net: totals.netGrowth,
      percent:
        totals.netGrowth !== null && profile?.followers_count
          ? Number(((totals.netGrowth / Math.max(1, profile.followers_count - totals.netGrowth)) * 100).toFixed(2))
          : null,
    },
    totals,
    buckets,
    content: {
      total: items.length,
      reels: reelItems.length,
      carousels: items.filter((i) => i.type === "Carousel").length,
      posts: items.filter((i) => i.type === "Post").length,
      stories: stories.length,
    },
    reels: groupStats(reelItems),
    posts: groupStats(postItems),
    stories: {
      published: stories.length,
      reach: sumOrNull(stories.map((s) => s.reach)),
      views: sumOrNull(stories.map((s) => s.views)),
      replies: sumOrNull(stories.map((s) => s.replies)),
      navigation: sumOrNull(stories.map((s) => s.navigation)),
      totalInteractions: sumOrNull(stories.map((s) => s.totalInteractions)),
    },
    topContent,
    needsAttention,
    publishing: {
      byWeekday,
      perDay: publishedDays > 0 ? Number((items.length / publishedDays).toFixed(2)) : null,
      perWeek: publishedDays > 0 ? Number(((items.length / publishedDays) * 7).toFixed(1)) : null,
    },
    provenance,
    lastSyncAt: integration?.lastSyncAt?.toISOString() ?? null,
    pendingDays,
  };
}
