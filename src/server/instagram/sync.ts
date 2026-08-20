import "server-only";
/* ------------------------------------------------------------------ *
 *  Instagram sync
 *
 *  Pulls the account, its daily insights and recent media into Postgres.
 *  Triggered by Vercel Cron and on demand from the UI.
 *
 *  Ordering matters here: the profile snapshot is written FIRST and
 *  committed on its own. Insights and media are best-effort on top. That
 *  way a metric Meta renamed overnight costs us a chart, not a day of
 *  irreplaceable follower history.
 * ------------------------------------------------------------------ */
import { env } from "../env";
import { prisma } from "../prisma";
import {
  getAccount, getDailyInsights, getDayTotals, getFollowActivity, getMedia, getMediaInsights,
  getStories, igConfig, isConfigured, MetaApiError,
} from "./client";

const INTEGRATION_KEY = "instagram-graph";

let running = false;

/** Midnight-UTC Date for a YYYY-MM-DD key, matching Prisma's @db.Date. */
function dateOnly(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}
function dayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

async function integrationRow() {
  return prisma.integration.upsert({
    where: { key: INTEGRATION_KEY },
    create: {
      key: INTEGRATION_KEY, name: "Instagram Graph API", category: "Social",
      scopes: ["instagram_basic", "instagram_manage_insights"],
    },
    update: {},
  });
}

export interface SyncResult {
  ok: boolean;
  followers?: number;
  mediaSynced?: number;
  daysBackfilled?: number;
  storiesSynced?: number;
  error?: string;
}

export async function syncInstagram(trigger = "manual"): Promise<SyncResult> {
  if (!isConfigured()) {
    return { ok: false, error: "Instagram is not configured — set META_ACCESS_TOKEN and IG_BUSINESS_ACCOUNT_ID" };
  }
  if (running) return { ok: false, error: "A sync is already in progress" };
  running = true;

  const integration = await integrationRow();
  const run = await prisma.syncRun.create({ data: { integrationId: integration.id } });
  let records = 0;

  try {
    const cfg = igConfig();

    /* 1 — Profile snapshot. The one call that must succeed. */
    const account = await getAccount(cfg);
    const today = dayKey();

    await prisma.igDailySnapshot.upsert({
      where: { igAccountId_date: { igAccountId: account.id, date: dateOnly(today) } },
      create: {
        igAccountId: account.id,
        date: dateOnly(today),
        followersCount: account.followers_count,
        followsCount: account.follows_count,
        mediaCount: account.media_count,
      },
      update: {
        followersCount: account.followers_count,
        followsCount: account.follows_count,
        mediaCount: account.media_count,
      },
    });
    records++;

    /* 2 — Daily insights for the last 30 days (all Meta retains for
           follower_count). Backfills any day the scheduler missed. */
    let daysBackfilled = 0;
    try {
      const until = new Date();
      const since = new Date(until.getTime() - 30 * 86_400_000);
      const daily = await getDailyInsights(since, until, cfg);
      const keys = new Set([...Object.keys(daily.reach), ...Object.keys(daily.newFollowers)]);

      for (const key of keys) {
        await prisma.igDailySnapshot.upsert({
          where: { igAccountId_date: { igAccountId: account.id, date: dateOnly(key) } },
          create: {
            igAccountId: account.id,
            date: dateOnly(key),
            // Counts stay null: we never observed this day's profile, and
            // substituting today's total would silently zero out `net` and
            // make every derived unfollow figure wrong.
            //
            // newFollowers is deliberately NOT written here. This endpoint
            // buckets days by Meta's end_time minus one day, while the
            // measured follows/unfollows pair buckets by the day itself. Two
            // conventions writing one column disagreed by a day and produced
            // a follows figure that did not belong with its unfollows —
            // yielding a net change that never happened. The measured pair
            // below is the single source for both halves.
            reach: daily.reach[key],
          },
          update: {
            reach: daily.reach[key],
          },
        });
        daysBackfilled++;
      }
    } catch (err) {
      console.warn(`[instagram] daily insights skipped: ${(err as Error).message}`);
    }

    /* 3 — Real follows/unfollows for today. Measured by Meta rather than
           derived, so the report can state them as fact. Meta usually has no
           data for the current day until it closes, hence yesterday too. */
    // Meta's follow/unfollow data lags roughly two days, so a today-and-
    // yesterday window finds nothing.
    //
    // Thirty days, not seven. Probing the API showed it serves this metric for
    // at least 32 days back, and the shorter window left older days holding a
    // follows figure with no unfollows beside it — a half-filled row the chart
    // could only draw as a one-sided bar.
    //
    // It also repairs history. Rows written before the date convention was
    // fixed are shifted a day late, and since this endpoint is authoritative
    // for both halves, re-reading the full window overwrites them with the
    // figures Meta actually reports for each date.
    // 33, not 30: probing showed Meta still serves this metric at 32 days
    // back, and the window has to reach at least as far as the retention or a
    // row can age out still holding a pre-fix value. Days beyond retention
    // simply return nothing and are skipped, so overshooting is free.
    const ACTIVITY_BACKFILL_DAYS = 33;
    const activityDays = Array.from({ length: ACTIVITY_BACKFILL_DAYS }, (_, i) =>
      dayKey(new Date(Date.now() - i * 86_400_000))
    );

    for (const target of activityDays) {
      try {
        // Two calls per day: the follow pair and the eleven account-wide
        // totals. Both are per-day figures Meta will not break out of a
        // range, so a daily series has to be assembled a day at a time.
        const [activity, totals] = await Promise.all([
          getFollowActivity(target, cfg),
          getDayTotals(target, cfg),
        ]);

        // Only write columns Meta actually returned. Writing 0 for an absent
        // metric would make "no data" indistinguishable from "none happened".
        const measured = {
          ...(activity.follows !== null ? { newFollowers: activity.follows } : {}),
          ...(activity.unfollows !== null ? { unfollows: activity.unfollows } : {}),
          ...(totals.reach !== null ? { reach: totals.reach } : {}),
          ...(totals.views !== null ? { views: totals.views } : {}),
          ...(totals.profileViews !== null ? { profileViews: totals.profileViews } : {}),
          ...(totals.accountsEngaged !== null ? { accountsEngaged: totals.accountsEngaged } : {}),
          ...(totals.totalInteractions !== null ? { totalInteractions: totals.totalInteractions } : {}),
          ...(totals.websiteClicks !== null ? { websiteClicks: totals.websiteClicks } : {}),
          ...(totals.likes !== null ? { likes: totals.likes } : {}),
          ...(totals.comments !== null ? { comments: totals.comments } : {}),
          ...(totals.shares !== null ? { shares: totals.shares } : {}),
          ...(totals.saves !== null ? { saves: totals.saves } : {}),
          ...(totals.replies !== null ? { replies: totals.replies } : {}),
        };

        if (Object.keys(measured).length > 0) {
          await prisma.igDailySnapshot.upsert({
            where: { igAccountId_date: { igAccountId: account.id, date: dateOnly(target) } },
            create: { igAccountId: account.id, date: dateOnly(target), ...measured },
            update: measured,
          });
        }
      } catch (err) {
        console.warn(`[instagram] daily metrics for ${target} skipped: ${(err as Error).message}`);
      }
    }

    /* 3b — Stories. Only the last 24 hours exist in the API, so whatever is
            live right now is captured; anything missed is unrecoverable. */
    let storiesSynced = 0;
    try {
      for (const story of await getStories(cfg)) {
        const data = {
          igAccountId: account.id,
          mediaType: story.mediaType,
          permalink: story.permalink,
          timestamp: new Date(story.timestamp),
          reach: story.reach,
          views: story.views,
          replies: story.replies,
          navigation: story.navigation,
          totalInteractions: story.totalInteractions,
        };
        await prisma.igStory.upsert({ where: { id: story.id }, create: { id: story.id, ...data }, update: data });
        storiesSynced++;
      }
    } catch (err) {
      console.warn(`[instagram] stories skipped: ${(err as Error).message}`);
    }

    /* 4 — Media + per-post insights. */
    let mediaSynced = 0;
    try {
      const media = await getMedia(env.IG_MEDIA_LIMIT, cfg);
      for (const m of media) {
        const productType = m.media_product_type ?? "FEED";
        const insights = await getMediaInsights(m.id, productType, cfg);

        const data = {
          igAccountId: account.id,
          caption: m.caption ?? "",
          mediaType: m.media_type,
          productType,
          mediaUrl: m.media_url ?? null,
          thumbnailUrl: m.thumbnail_url ?? null,
          permalink: m.permalink ?? "",
          timestamp: new Date(m.timestamp),
          likeCount: m.like_count ?? 0,
          commentsCount: m.comments_count ?? 0,
          reach: insights.reach ?? null,
          views: insights.views ?? null,
          saved: insights.saved ?? null,
          shares: insights.shares ?? null,
          totalInteractions: insights.totalInteractions ?? null,
          avgWatchTimeMs: insights.avgWatchTimeMs ?? null,
          profileVisits: insights.profileVisits ?? null,
          followsFromPost: insights.follows ?? null,
        };

        await prisma.igMedia.upsert({ where: { id: m.id }, create: { id: m.id, ...data }, update: data });
        mediaSynced++;
        records++;
      }
    } catch (err) {
      console.warn(`[instagram] media sync skipped: ${(err as Error).message}`);
    }

    await prisma.syncRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), success: true, recordCount: records },
    });
    await prisma.integration.update({
      where: { id: integration.id },
      data: { status: "CONNECTED", health: "HEALTHY", lastSyncAt: new Date() },
    });


    console.log(`[instagram] ${trigger} sync ok — ${account.followers_count} followers, ${mediaSynced} posts`);
    return { ok: true, followers: account.followers_count, mediaSynced, daysBackfilled, storiesSynced };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    const authFailure = err instanceof MetaApiError && err.authFailure;

    await prisma.syncRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), success: false, recordCount: records, error: message },
    });
    await prisma.integration.update({
      where: { id: integration.id },
      data: { status: authFailure ? "ERROR" : undefined, health: authFailure ? "DOWN" : "DEGRADED" },
    });

    console.error(`[instagram] ${trigger} sync failed: ${message}`);
    return { ok: false, error: message };
  } finally {
    running = false;
  }
}

/* ------------------------- Derived follower series ----------------------- */

export interface FollowerDay {
  date: string;
  /** Null on days reconstructed from insights before we started snapshotting. */
  followers: number | null;
  /** Change in total followers vs the previous day. */
  net: number | null;
  /** Gross new follows, straight from Meta. */
  gained: number | null;
  /** Unfollows. Measured by Meta where available; see lostSource. */
  lost: number | null;
  /** Whether  came from Meta or from the legacy (gained - net) estimate. */
  lostSource: "measured" | "derived" | null;
  reach: number | null;
  views: number | null;
  profileViews: number | null;
}

export async function getFollowerHistory(days = 30, igAccountId?: string): Promise<FollowerDay[]> {
  const accountId = igAccountId ?? env.IG_BUSINESS_ACCOUNT_ID;
  if (!accountId) return [];

  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await prisma.igDailySnapshot.findMany({
    where: { igAccountId: accountId, date: { gte: dateOnly(dayKey(since)) } },
    orderBy: { date: "asc" },
  });

  return rows.map((row, i) => {
    const prev = i > 0 ? rows[i - 1] : null;
    // Both days need a real observation — a gap in the series means the
    // movement across it is unknowable, not zero.
    const net =
      prev && row.followersCount !== null && prev.followersCount !== null
        ? row.followersCount - prev.followersCount
        : null;
    const gained = row.newFollowers ?? null;

    // Prefer Meta's measured figure. The old (gained - net) estimate stays as
    // a fallback for days recorded before the metric was wired up, and the
    // caller is told which one it got.
    const measuredLost = row.unfollows ?? null;
    const derivedLost = gained !== null && net !== null ? Math.max(0, gained - net) : null;
    const lost = measuredLost ?? derivedLost;
    const lostSource: "measured" | "derived" | null =
      measuredLost !== null ? "measured" : derivedLost !== null ? "derived" : null;

    return {
      date: row.date.toISOString().slice(0, 10),
      followers: row.followersCount,
      net,
      gained,
      lost,
      lostSource,
      reach: row.reach,
      views: row.views,
      profileViews: row.profileViews,
    };
  });
}

/* ------------------------------ Scheduling -------------------------------- *
 *  There is no in-process scheduler here.
 *
 *  Serverless functions do not stay resident, so setInterval would never
 *  fire. The sync is triggered instead by Vercel Cron hitting
 *  /api/cron/instagram-sync. IgDailySnapshot is the only source of follower
 *  history and Meta sells none, so a missed run is a permanent gap in the
 *  chart — the cron schedule is load-bearing, not a nicety.
 * ------------------------------------------------------------------------- */
