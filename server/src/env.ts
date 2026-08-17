import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET must be at least 16 chars"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 chars"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),

  // 3002: 3000 and 3001 are taken by other apps on this dev machine. The
  // OAuth callback redirects to this origin, so a stale value would hand the
  // connection result to whatever else is listening.
  CORS_ORIGIN: z.string().default("http://localhost:3002"),
  COOKIE_DOMAIN: z.string().optional(),

  // Credential encryption (64 hex chars). Falls back to a derived key in dev.
  ENCRYPTION_KEY: z.string().optional(),

  // --- Deployment Center ---------------------------------------------------
  GITHUB_TOKEN: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
  GITHUB_API_URL: z.string().default("https://api.github.com"),
  OAUTH_REDIRECT_BASE: z.string().optional(),

  VERCEL_TOKEN: z.string().optional(),
  VERCEL_TEAM_ID: z.string().optional(),
  VERCEL_PROJECT_ID: z.string().optional(),
  VERCEL_WEBHOOK_SECRET: z.string().optional(),
  VERCEL_API_URL: z.string().default("https://api.vercel.com"),

  /** Polling fallback when webhooks aren't available. 0 disables it. */
  DEPLOY_SYNC_INTERVAL_MS: z.coerce.number().default(0),
  DEPLOY_CACHE_TTL_MS: z.coerce.number().default(60_000),

  // --- Meta Graph / Instagram ----------------------------------------------
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  /** System User token from Business Settings. Server-side only — never ship this to the browser. */
  META_ACCESS_TOKEN: z.string().optional(),
  META_BUSINESS_ID: z.string().optional(),
  FB_PAGE_ID: z.string().optional(),
  IG_BUSINESS_ACCOUNT_ID: z.string().optional(),
  META_GRAPH_VERSION: z.string().default("v23.0"),

  /** Daily snapshot cadence. Default 6h — four attempts a day so one blip doesn't lose a day of history. */
  IG_SYNC_INTERVAL_MS: z.coerce.number().default(21_600_000),
  /** Posts pulled per sync. */
  IG_MEDIA_LIMIT: z.coerce.number().default(50),

  // --- Meta OAuth (Facebook Login for Business) ----------------------------
  // Every one is optional on purpose. This schema runs at boot and exits the
  // process on failure, so a required-but-empty Meta value here would take the
  // whole dashboard down before anyone has entered credentials. Shape and
  // completeness are checked at point of use instead — see
  // services/integrations/meta-config.ts.
  /** "MC Nexus Instagram" login configuration id. */
  META_INSTAGRAM_CONFIG_ID: z.string().optional(),
  /** Must match a redirect URI registered on the Meta app byte for byte. */
  META_REDIRECT_URI: z.string().optional(),
  /** Echoed back during the webhook subscription handshake. Server-only. */
  META_WEBHOOK_VERIFY_TOKEN: z.string().optional(),

  // Optional SMTP — mail becomes a no-op when unset.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().default("MC Nexus <no-reply@maincharacter.nl>"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  • ${i.path.join(".")}: ${i.message}`).join("\n");
  console.error(`\n✖ Invalid environment configuration:\n${issues}\n\nCopy .env.example to .env and fill it in.\n`);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
export const corsOrigins = env.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean);
