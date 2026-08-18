import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { corsOrigins, env, isProd } from "./env.js";
import { prisma } from "./lib/prisma.js";
import { redis } from "./lib/redis.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { authRouter } from "./routes/auth.routes.js";
import { dayPlanRouter } from "./routes/dayplans.routes.js";
import { integrationRouter, metaCallbackRouter } from "./routes/integrations.routes.js";
import { metaWebhookRouter } from "./routes/meta-webhooks.routes.js";
import { auditRouter, dashboardRouter, notificationRouter, userRouter } from "./routes/misc.routes.js";
import { taskRouter } from "./routes/tasks.routes.js";
import { deploymentRouter, webhookRouter } from "./routes/deployments.routes.js";
import { instagramRouter } from "./routes/instagram.routes.js";

/**
 * Redis-backed store for express-rate-limit, or nothing when Redis isn't
 * configured — in which case the library's in-memory store applies.
 *
 * Written as a function so the non-null client is captured in a local:
 * narrowing on the module-level `redis` doesn't survive into the callback.
 */
function redisRateLimitStore() {
  const client = redis;
  if (!client) return {};
  return {
    store: new RedisStore({
      prefix: `${env.REDIS_PREFIX}:rl:`,
      sendCommand: (...args: string[]) =>
        client.call(...(args as [string, ...string[]])) as Promise<never>,
    }),
  };
}

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({ origin: corsOrigins, credentials: true }));

  // Webhooks mount BEFORE the JSON parser so signatures can be verified
  // against the exact raw bytes the provider sent.
  app.use("/api/deployments/webhooks", webhookRouter);
  app.use("/api/integrations/webhooks", metaWebhookRouter);

  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  /**
   * Morgan logs the full request line, and an OAuth callback carries the
   * authorization code in its query string — so by default every completed
   * connection wrote a live credential to the console and to api.log.
   * Redact those parameters before the logger ever sees them.
   */
  morgan.token("url", (req) => {
    const raw = (req as express.Request).originalUrl ?? (req as express.Request).url ?? "";
    const split = raw.indexOf("?");
    if (split === -1) return raw;

    const params = new URLSearchParams(raw.slice(split + 1));
    let redacted = false;
    for (const key of ["code", "state", "access_token", "token", "client_secret", "fb_exchange_token"]) {
      if (params.has(key)) {
        params.set(key, "[redacted]");
        redacted = true;
      }
    }
    return redacted ? `${raw.slice(0, split)}?${params.toString()}` : raw;
  });

  if (!isProd) app.use(morgan("dev"));

  // Baseline throttle for the whole API (auth routes add a tighter limit).
  // Backed by Redis when available so the limit holds across restarts and
  // instances; the default in-memory store is per-process, which means a
  // restart hands an attacker a fresh budget.
  app.use(
    "/api",
    rateLimit({
      windowMs: 60 * 1000,
      limit: 300,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { error: { code: "RATE_LIMITED", message: "Too many requests" } },
      ...redisRateLimitStore(),
    })
  );

  /** Liveness + DB readiness — safe to call without a database. */
  app.get("/health", async (_req, res) => {
    let db: "up" | "down" = "down";
    try {
      await prisma.$queryRaw`SELECT 1`;
      db = "up";
    } catch {
      db = "down";
    }
    res.status(200).json({
      status: "ok",
      service: "mc-nexus-api",
      db,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/day-plans", dayPlanRouter);
  app.use("/api/tasks", taskRouter);
  app.use("/api/deployments", deploymentRouter);
  // Mounted at the same base as integrationRouter but BEFORE it, because
  // integrationRouter requires a Bearer token and Meta's redirect is a plain
  // browser navigation. Only /callback/meta lives here; the signed state
  // parameter is what authenticates it.
  app.use("/api/integrations", metaCallbackRouter);
  app.use("/api/integrations", integrationRouter);
  app.use("/api/instagram", instagramRouter);
  app.use("/api/notifications", notificationRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/users", userRouter);
  app.use("/api/audit", auditRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
