import { Router, type NextFunction, type Response } from "express";
import { z } from "zod";
import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { notFound, unauthorized } from "../lib/errors.js";
import { audit } from "../lib/audit.js";
import { corsOrigins } from "../env.js";
import { emitWorkspace } from "../realtime/io.js";
import { getProvider, providerList } from "../services/integrations/registry.js";
import { missingEnv } from "../services/integrations/types.js";
import {
  completeOAuth,
  disconnectMeta,
  metaConnectionStatus,
  MetaOAuthError,
  signOAuthState,
  verifyOAuthState,
  META_INTEGRATION_KEY,
} from "../services/integrations/meta-oauth.js";
import { MetaNotConfiguredError } from "../services/integrations/meta-config.js";
import {
  capabilities,
  connectionMetadata,
  getComments,
  messagingReadiness,
  NotConnectedError,
  replyToComment,
  requireOauthConfig,
  setCommentHidden,
} from "../services/integrations/meta-instagram.js";
// Reused as-is from the System User integration: these take an injected
// config, so the OAuth page token drives the same tested request logic.
import {
  getAccount,
  getDailyInsights,
  getMedia,
  getMediaInsights,
  getTodayTotals,
} from "../services/instagram/client.js";

export const integrationRouter = Router();
integrationRouter.use(requireAuth);

const keyParam = z.object({ key: z.string().min(1) });

/* ------------------------------ Meta OAuth ------------------------------- *
 *  Registered before the generic /:key routes so these literal paths win.
 *  Every handler here is behind requireAuth via the router-level guard, and
 *  none of them can reach token material — the service layer returns
 *  metadata only.
 * ------------------------------------------------------------------------ */

/** Turns "nobody has connected yet" into a 409 the dashboard can render. */
function handleDataError(err: unknown, res: Response, next: NextFunction) {
  if (err instanceof NotConnectedError) {
    return res.status(409).json({ error: { code: "NOT_CONNECTED", message: err.message } });
  }
  if (err instanceof MetaNotConfiguredError) {
    return res.status(400).json({ error: { code: "NOT_CONFIGURED", message: err.message } });
  }
  next(err);
}

/** Connection state for the Integration Center. Never includes token material. */
integrationRouter.get("/meta-graph/status", async (_req, res, next) => {
  try {
    res.json(await metaConnectionStatus());
  } catch (err) {
    next(err);
  }
});

integrationRouter.post("/meta-graph/disconnect", requireRole("TEAM"), async (req, res, next) => {
  try {
    await disconnectMeta();
    audit(req, "integration.disconnect", "Integration", META_INTEGRATION_KEY, { via: "oauth" });
    emitWorkspace("integration:updated", { key: META_INTEGRATION_KEY, status: "NOT_CONNECTED" });
    res.json(await metaConnectionStatus());
  } catch (err) {
    next(err);
  }
});

/** Which features the granted permissions actually unlock. */
integrationRouter.get("/meta-graph/capabilities", async (_req, res, next) => {
  try {
    const [caps, messaging] = await Promise.all([capabilities(), messagingReadiness()]);
    res.json({ capabilities: caps, messaging });
  } catch (err) {
    next(err);
  }
});

/** Profile — served by the shared Instagram client, driven by the OAuth token. */
integrationRouter.get("/meta-graph/profile", async (_req, res, next) => {
  try {
    const cfg = await requireOauthConfig();
    const [account, metadata] = await Promise.all([getAccount(cfg), connectionMetadata()]);
    res.json({
      profile: {
        id: account.id,
        username: account.username,
        name: account.name ?? null,
        biography: account.biography ?? null,
        website: account.website ?? null,
        profilePictureUrl: account.profile_picture_url ?? null,
        followersCount: account.followers_count,
        followsCount: account.follows_count,
        mediaCount: account.media_count,
      },
      page: metadata ? { id: metadata.pageId, name: metadata.pageName } : null,
      connectedAt: metadata?.connectedAt ?? null,
    });
  } catch (err) {
    handleDataError(err, res, next);
  }
});

const mediaQuery = z.object({
  limit: z.coerce.number().min(1).max(50).default(12),
  insights: z.coerce.boolean().default(true),
});

integrationRouter.get("/meta-graph/media", validate(mediaQuery, "query"), async (req, res, next) => {
  try {
    const { limit, insights } = req.query as unknown as { limit: number; insights: boolean };
    const cfg = await requireOauthConfig();
    const items = await getMedia(limit, cfg);

    // Insights are one call per item, so they're opt-out for large pulls.
    const enriched = insights
      ? await Promise.all(
          items.map(async (m) => ({
            item: m,
            stats: await getMediaInsights(m.id, m.media_product_type ?? "FEED", cfg),
          }))
        )
      : items.map((m) => ({ item: m, stats: {} as Awaited<ReturnType<typeof getMediaInsights>> }));

    res.json({
      media: enriched.map(({ item, stats }) => ({
        id: item.id,
        caption: item.caption ?? "",
        mediaType: item.media_type,
        productType: item.media_product_type ?? "FEED",
        mediaUrl: item.media_url ?? null,
        thumbnailUrl: item.thumbnail_url ?? null,
        permalink: item.permalink ?? "",
        timestamp: item.timestamp,
        likeCount: item.like_count ?? 0,
        commentsCount: item.comments_count ?? 0,
        reach: stats.reach ?? null,
        views: stats.views ?? null,
        saved: stats.saved ?? null,
        shares: stats.shares ?? null,
        totalInteractions: stats.totalInteractions ?? null,
      })),
    });
  } catch (err) {
    handleDataError(err, res, next);
  }
});

const insightsQuery = z.object({ days: z.coerce.number().min(1).max(90).default(28) });

integrationRouter.get("/meta-graph/insights", validate(insightsQuery, "query"), async (req, res, next) => {
  try {
    const { days } = req.query as unknown as { days: number };
    const cfg = await requireOauthConfig();

    const until = new Date();
    const since = new Date(until.getTime() - days * 86_400_000);

    // Both are best-effort: Meta retires insight metric names between
    // versions, and a renamed metric shouldn't 500 the whole panel.
    const [daily, totals] = await Promise.all([
      getDailyInsights(since, until, cfg).catch(() => null),
      getTodayTotals(cfg).catch(() => ({})),
    ]);

    const series = daily
      ? Object.keys({ ...daily.reach, ...daily.newFollowers })
          .sort()
          .map((date) => ({
            date,
            reach: daily.reach[date] ?? null,
            newFollowers: daily.newFollowers[date] ?? null,
          }))
      : [];

    res.json({
      days,
      series,
      today: totals,
      // Says plainly when Meta served nothing, rather than rendering zeros.
      available: series.length > 0 || Object.values(totals).some((v) => v !== undefined),
    });
  } catch (err) {
    handleDataError(err, res, next);
  }
});

const commentsQuery = z.object({
  mediaId: z.string().min(1),
  limit: z.coerce.number().min(1).max(50).default(25),
});

integrationRouter.get("/meta-graph/comments", validate(commentsQuery, "query"), async (req, res, next) => {
  try {
    const { mediaId, limit } = req.query as unknown as { mediaId: string; limit: number };
    const cfg = await requireOauthConfig();
    res.json({ comments: await getComments(mediaId, cfg, limit) });
  } catch (err) {
    handleDataError(err, res, next);
  }
});

const replyBody = z.object({ commentId: z.string().min(1), message: z.string().min(1).max(2200) });

integrationRouter.post("/meta-graph/comments/reply", requireRole("TEAM"), validate(replyBody), async (req, res, next) => {
  try {
    const { commentId, message } = req.body as { commentId: string; message: string };
    const cfg = await requireOauthConfig();
    const result = await replyToComment(commentId, message, cfg);
    audit(req, "instagram.comment.reply", "IgComment", commentId, {});
    res.json({ id: result.id });
  } catch (err) {
    handleDataError(err, res, next);
  }
});

const hideBody = z.object({ commentId: z.string().min(1), hide: z.boolean() });

integrationRouter.post("/meta-graph/comments/hide", requireRole("TEAM"), validate(hideBody), async (req, res, next) => {
  try {
    const { commentId, hide } = req.body as { commentId: string; hide: boolean };
    const cfg = await requireOauthConfig();
    await setCommentHidden(commentId, hide, cfg);
    audit(req, "instagram.comment.moderate", "IgComment", commentId, { hide });
    res.json({ ok: true, hidden: hide });
  } catch (err) {
    handleDataError(err, res, next);
  }
});

/**
 * Messaging is permission- and webhook-gated. Reports readiness rather than
 * returning an empty conversation list that would read as "no messages".
 */
integrationRouter.get("/meta-graph/messages", async (_req, res, next) => {
  try {
    const readiness = await messagingReadiness();
    res.json({
      ...readiness,
      conversations: [],
      setupRequired: !readiness.available,
    });
  } catch (err) {
    handleDataError(err, res, next);
  }
});

/** Merges DB connection state with static provider metadata. Credentials never leave the server. */
integrationRouter.get("/", async (_req, res, next) => {
  try {
    const rows = await prisma.integration.findMany({ orderBy: { name: "asc" } });
    const byKey = new Map(rows.map((r) => [r.key, r]));

    const list = providerList.map((p) => {
      const row = byKey.get(p.key);
      return {
        key: p.key,
        name: p.name,
        category: p.category,
        docsUrl: p.docsUrl,
        scopes: p.scopes,
        requiredEnv: p.requiredEnv,
        missingEnv: missingEnv(p.requiredEnv),
        apiKeyOnly: !!p.apiKeyOnly,
        status: row?.status ?? "NOT_CONNECTED",
        health: row?.health ?? "UNKNOWN",
        lastSyncAt: row?.lastSyncAt ?? null,
        configured: missingEnv(p.requiredEnv).length === 0,
      };
    });

    res.json({ integrations: list });
  } catch (err) {
    next(err);
  }
});

/** OAuth step 1 — the URL the user is sent to. */
integrationRouter.get("/:key/auth-url", validate(keyParam, "params"), (req, res, next) => {
  try {
    const provider = getProvider(req.params.key);
    if (!provider) return next(notFound("Unknown integration"));
    if (provider.apiKeyOnly) {
      return res.json({ apiKeyOnly: true, message: "This provider uses an API key — set the env vars instead." });
    }
    if (!req.user) return next(unauthorized());

    // Providers that need the callback tied back to the initiating user sign
    // their own state; the rest keep the opaque random one.
    const state = provider.createState
      ? provider.createState(req.user.sub)
      : crypto.randomBytes(16).toString("hex");

    res.json({ url: provider.getAuthUrl(state), state, scopes: provider.scopes });
  } catch (err) {
    // A provider whose env isn't filled in yet is a 400 with instructions,
    // not a 500 — the dashboard renders this message verbatim.
    if (err instanceof MetaNotConfiguredError) {
      return res.status(400).json({ error: { code: "NOT_CONFIGURED", message: err.message, details: err.missing } });
    }
    next(err);
  }
});

/** Liveness probe used by the Integration Center. */
integrationRouter.post("/:key/test", validate(keyParam, "params"), async (req, res, next) => {
  try {
    const provider = getProvider(req.params.key);
    if (!provider) return next(notFound("Unknown integration"));
    const row = await prisma.integration.findUnique({ where: { key: provider.key } });
    const result = await provider.testConnection((row?.credentials as Record<string, unknown>) ?? {});
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** Marks an integration connected. Real token exchange lands here per provider. */
integrationRouter.post("/:key/connect", requireRole("TEAM"), validate(keyParam, "params"), async (req, res, next) => {
  try {
    const provider = getProvider(req.params.key);
    if (!provider) return next(notFound("Unknown integration"));

    const row = await prisma.integration.upsert({
      where: { key: provider.key },
      create: {
        key: provider.key, name: provider.name, category: provider.category,
        scopes: provider.scopes, status: "CONNECTED", health: "HEALTHY", lastSyncAt: new Date(),
      },
      update: { status: "CONNECTED", health: "HEALTHY", lastSyncAt: new Date() },
    });

    audit(req, "integration.connect", "Integration", row.id, { key: provider.key });
    emitWorkspace("integration:updated", { key: provider.key, status: "CONNECTED" });
    res.json({ key: provider.key, status: row.status, health: row.health, lastSyncAt: row.lastSyncAt });
  } catch (err) {
    next(err);
  }
});

integrationRouter.post("/:key/disconnect", requireRole("TEAM"), validate(keyParam, "params"), async (req, res, next) => {
  try {
    const provider = getProvider(req.params.key);
    if (!provider) return next(notFound("Unknown integration"));

    const row = await prisma.integration.upsert({
      where: { key: provider.key },
      create: { key: provider.key, name: provider.name, category: provider.category, scopes: provider.scopes, status: "NOT_CONNECTED" },
      // Prisma treats `undefined` as "leave this column alone", so the previous
      // `credentials: undefined` left the stored token in the database after a
      // disconnect. DbNull actually clears it.
      update: {
        status: "NOT_CONNECTED",
        health: "UNKNOWN",
        credentials: Prisma.DbNull,
        metadata: Prisma.DbNull,
        lastSyncAt: null,
      },
    });

    audit(req, "integration.disconnect", "Integration", row.id, { key: provider.key });
    emitWorkspace("integration:updated", { key: provider.key, status: "NOT_CONNECTED" });
    res.json({ key: provider.key, status: row.status });
  } catch (err) {
    next(err);
  }
});

/* --------------------------- OAuth callback ------------------------------ *
 *  Mounted separately in app.ts WITHOUT requireAuth.
 *
 *  Meta redirects the browser here, and a plain navigation carries no
 *  Authorization header — the same reason webhookRouter is mounted apart.
 *  The signed `state` parameter is the credential: it proves this server
 *  started the flow and identifies who started it.
 * ------------------------------------------------------------------------ */
export const metaCallbackRouter = Router();

/**
 * Fixed destination from CORS_ORIGIN — never a value from the query string,
 * so this cannot become an open redirect.
 *
 * Lands on /instagram because that is where the Connect button and the
 * connection card live; sending the user to /integrations instead meant the
 * page that started the flow never saw the result.
 */
function dashboardUrl(params: Record<string, string>): string {
  const base = corsOrigins[0] ?? "http://localhost:3001";
  const qs = new URLSearchParams(params).toString();
  return `${base}/instagram?${qs}`;
}

/** Keeps redirect URLs sane and avoids reflecting anything long back to the browser. */
const trim = (msg: string) => (msg.length > 220 ? `${msg.slice(0, 217)}…` : msg);

metaCallbackRouter.get("/callback/meta", async (req, res) => {
  // `code` and `state` are read but never logged, echoed, or persisted raw.
  const code = typeof req.query.code === "string" ? req.query.code : undefined;
  const state = typeof req.query.state === "string" ? req.query.state : undefined;
  const oauthError = typeof req.query.error === "string" ? req.query.error : undefined;

  // The user pressed Cancel, or Meta declined before issuing a code.
  if (oauthError) {
    const reason = req.query.error_reason === "user_denied" || oauthError === "access_denied";
    return res.redirect(
      dashboardUrl({
        integration: "instagram",
        status: "error",
        reason: reason ? "cancelled" : "denied",
        message: reason
          ? "Connection cancelled — you didn't authorize MC Nexus."
          : "Meta declined the authorization request.",
      })
    );
  }

  try {
    // Presence flags only — the values themselves are credentials.
    console.log(
      `[meta-oauth] callback reached · code=${code ? "present" : "absent"} state=${state ? "present" : "absent"}`
    );

    const { userId } = verifyOAuthState(state);
    console.log(`[meta-oauth] state valid · user=${userId}`);

    if (!code) throw new MetaOAuthError("no_code", "Meta didn't return an authorization code. Please try again.");

    const account = await completeOAuth(code, userId);
    console.log(
      `[meta-oauth] connected · ig=${account.igAccountId} page=${account.pageId} stored=yes`
    );

    emitWorkspace("integration:updated", { key: META_INTEGRATION_KEY, status: "CONNECTED" });

    return res.redirect(
      dashboardUrl({
        integration: "instagram",
        status: "connected",
        account: account.igUsername,
      })
    );
  } catch (err) {
    if (err instanceof MetaNotConfiguredError) {
      return res.redirect(
        dashboardUrl({ integration: "instagram", status: "error", reason: "not_configured", message: trim(err.message) })
      );
    }
    if (err instanceof MetaOAuthError) {
      // Meta's own error code, which is safe and the single most useful
      // thing to have in the log when a real connection attempt fails.
      console.warn(`[meta-oauth] failed · reason=${err.code}`);
      return res.redirect(
        dashboardUrl({ integration: "instagram", status: "error", reason: err.code, message: trim(err.message) })
      );
    }

    // Unknown failure: log the type only. The message could contain a Meta
    // payload, and payloads are where credentials leak into logs.
    console.error("[meta-oauth] callback failed:", (err as Error)?.name ?? "UnknownError");
    return res.redirect(
      dashboardUrl({
        integration: "instagram",
        status: "error",
        reason: "server_error",
        message: "Something went wrong completing the connection. Check the server logs.",
      })
    );
  }
});

/** Recent sync history for the detail drawer. */
integrationRouter.get("/:key/sync-runs", validate(keyParam, "params"), async (req, res, next) => {
  try {
    const row = await prisma.integration.findUnique({ where: { key: req.params.key } });
    if (!row) return res.json({ runs: [] });
    const runs = await prisma.syncRun.findMany({
      where: { integrationId: row.id },
      orderBy: { startedAt: "desc" },
      take: 20,
    });
    res.json({ runs });
  } catch (err) {
    next(err);
  }
});
