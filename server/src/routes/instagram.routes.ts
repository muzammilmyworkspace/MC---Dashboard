import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { badRequest } from "../lib/errors.js";
import { audit } from "../lib/audit.js";
import { env } from "../env.js";
import { debugToken, discoverAccounts, getFollowerDemographics, isConfigured } from "../services/instagram/client.js";
import { getFollowerHistory, syncInstagram } from "../services/instagram/sync.js";

export const instagramRouter = Router();
instagramRouter.use(requireAuth);

/**
 * Everything here reads from Postgres, never from Meta directly — the Graph
 * API has a hard 24h call quota, so page loads must not touch it. The
 * scheduler in services/instagram/sync.ts is the only writer.
 */

const daysQuery = z.object({ days: z.coerce.number().min(1).max(365).default(30) });

/** Headline numbers + the derived daily movement. */
instagramRouter.get("/overview", validate(daysQuery, "query"), async (req, res, next) => {
  try {
    const { days } = req.query as unknown as { days: number };
    const accountId = env.IG_BUSINESS_ACCOUNT_ID;

    if (!isConfigured() || !accountId) {
      return res.json({
        configured: false,
        message: "Set META_ACCESS_TOKEN and IG_BUSINESS_ACCOUNT_ID in server/.env, then run a sync.",
        history: [], totals: null, latest: null,
      });
    }

    const history = await getFollowerHistory(days, accountId);

    // Only days with a real profile reading can anchor a total — backfilled
    // days carry insights but no follower count.
    const observed = history.filter((d) => d.followers !== null);
    const latest = observed.at(-1) ?? null;
    const first = observed[0] ?? null;

    const integration = await prisma.integration.findUnique({ where: { key: "instagram-graph" } });

    // Sum only the days we actually have gained/lost figures for, so a
    // partial window doesn't read as a suspiciously round zero.
    const withDeltas = history.filter((d) => d.gained !== null && d.lost !== null);
    const totals = {
      gained: withDeltas.reduce((s, d) => s + (d.gained ?? 0), 0),
      lost: withDeltas.reduce((s, d) => s + (d.lost ?? 0), 0),
      net: first && latest ? (latest.followers ?? 0) - (first.followers ?? 0) : 0,
      reach: history.reduce((s, d) => s + (d.reach ?? 0), 0),
      profileViews: history.reduce((s, d) => s + (d.profileViews ?? 0), 0),
      daysCovered: withDeltas.length,
    };

    res.json({
      configured: true,
      latest,
      totals,
      history,
      lastSyncAt: integration?.lastSyncAt ?? null,
      health: integration?.health ?? "UNKNOWN",
    });
  } catch (err) {
    next(err);
  }
});

/** Raw daily series — followers, gained, derived unfollows. */
instagramRouter.get("/followers", validate(daysQuery, "query"), async (req, res, next) => {
  try {
    const { days } = req.query as unknown as { days: number };
    res.json({ history: await getFollowerHistory(days) });
  } catch (err) {
    next(err);
  }
});

const mediaQuery = z.object({
  limit: z.coerce.number().min(1).max(100).default(24),
  type: z.enum(["ALL", "FEED", "REELS", "STORY"]).default("ALL"),
});

instagramRouter.get("/media", validate(mediaQuery, "query"), async (req, res, next) => {
  try {
    const { limit, type } = req.query as unknown as { limit: number; type: string };
    const media = await prisma.igMedia.findMany({
      where: {
        igAccountId: env.IG_BUSINESS_ACCOUNT_ID ?? "",
        ...(type === "ALL" ? {} : { productType: type }),
      },
      orderBy: { timestamp: "desc" },
      take: limit,
    });

    res.json({
      media: media.map((m) => ({
        ...m,
        engagementRate: m.reach && m.reach > 0
          ? Number((((m.totalInteractions ?? m.likeCount + m.commentsCount) / m.reach) * 100).toFixed(2))
          : null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

const demoQuery = z.object({ breakdown: z.enum(["age", "city", "country", "gender"]).default("country") });

/** Live call — demographics change slowly and aren't worth a table. */
instagramRouter.get("/demographics", validate(demoQuery, "query"), async (req, res, next) => {
  try {
    if (!isConfigured()) return next(badRequest("Instagram is not configured"));
    const { breakdown } = req.query as unknown as { breakdown: "age" | "city" | "country" | "gender" };
    const data = await getFollowerDemographics(breakdown);
    res.json({
      breakdown,
      data,
      // An empty result is almost always the <100 follower threshold rather
      // than a real zero, so say so instead of rendering an empty chart.
      note: Object.keys(data).length === 0 ? "Requires at least 100 followers" : null,
    });
  } catch (err) {
    next(err);
  }
});

instagramRouter.post("/sync", requireRole("TEAM"), async (req, res, next) => {
  try {
    const result = await syncInstagram("manual");
    audit(req, "instagram.sync", "Integration", "instagram-graph", { ...result });
    res.status(result.ok ? 200 : 502).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * Setup probe. Verifies the token and lists Pages with their linked IG
 * account so a broken Page↔Instagram link is visible in the UI rather than
 * showing up as permanently empty charts.
 */
instagramRouter.get("/diagnostics", requireRole("TEAM"), async (_req, res, next) => {
  try {
    // Only the token is required. This endpoint exists to FIND
    // IG_BUSINESS_ACCOUNT_ID, so demanding it up front would be circular —
    // you could never get past the very state it's meant to diagnose.
    if (!env.META_ACCESS_TOKEN) {
      return res.json({
        configured: false,
        missing: ["META_ACCESS_TOKEN"],
        token: null,
        accounts: [],
      });
    }

    // Account discovery walks /me/accounts and never touches the IG id.
    const probe = {
      token: env.META_ACCESS_TOKEN,
      igAccountId: env.IG_BUSINESS_ACCOUNT_ID ?? "",
      version: env.META_GRAPH_VERSION,
    };

    const [token, accounts] = await Promise.allSettled([debugToken(probe), discoverAccounts()]);
    res.json({
      configured: true,
      missing: [],
      token: token.status === "fulfilled" ? token.value : { valid: false, message: token.reason?.message },
      accounts: accounts.status === "fulfilled" ? accounts.value : [],
      accountsError: accounts.status === "rejected" ? accounts.reason?.message : null,
      configuredAccountId: env.IG_BUSINESS_ACCOUNT_ID,
    });
  } catch (err) {
    next(err);
  }
});
