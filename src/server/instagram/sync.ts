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
  getAccount, getDailyInsights, getMedia, getMediaInsights, getTodayTotals,
  igConfig, isConfigured, MetaApiError,
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
            reach: daily.reach[key],
            newFollowers: daily.newFollowers[key],
          },
          update: {
            reach: daily.reach[key],
            newFollowers: daily.newFollowers[key],
          },
        });
        daysBackfilled++;
      }
    } catch (err) {
      console.warn(`[instagram] daily insights skipped: ${(err as Error).message}`);
    }

    /* 3 — Today's total_value metrics. */
    try {
      const totals = await getTodayTotals(cfg);
      if (Object.values(totals).some((v) => v !== undefined)) {
        await prisma.igDailySnapshot.update({
          where: { igAccountId_date: { igAccountId: account.id, date: dateOnly(today) } },
          data: {
            views: totals.views,
            profileViews: totals.profileViews,
            accountsEngaged: totals.accountsEngaged,
            totalInteractions: totals.totalInteractions,
          },
        });
      }
    } catch (err) {
      console.warn(`[instagram] totals skipped: ${(err as Error).message}`);
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
    return { ok: true, followers: account.followers_count, mediaSynced, daysBackfilled };
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
  /**
   * Derived, not reported: Meta exposes no unfollow data at all.
   * unfollows = gained − net. Clamped at 0 because the two figures are
   * sampled at different moments and can disagree by a follower or two.
   */
  lost: number | null;
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
    const lost = gained !== null && net !== null ? Math.max(0, gained - net) : null;

    return {
      date: row.date.toISOString().slice(0, 10),
      followers: row.followersCount,
      net,
      gained,
      lost,
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
