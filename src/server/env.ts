import "server-only";
import { z } from "zod";

/**
 * Server-side configuration.
 *
 * Differs from the Express version in one important way: it does NOT call
 * process.exit on invalid input. On Vercel each request runs in a fresh
 * invocation, so exiting would turn a single misconfigured variable into a
 * hard 500 with no explanation. Instead the parse result is kept and routes
 * report what is missing, by name.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),

  /** AES-256-GCM key, 64 hex chars. Required in production. */
  ENCRYPTION_KEY: z.string().optional(),

  /** Redis is optional — everything degrades to in-process caching. */
  REDIS_URL: z.string().optional(),
  REDIS_PREFIX: z.string().default("mcnexus"),

  // --- Meta / Instagram -----------------------------------------------
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_ACCESS_TOKEN: z.string().optional(),
  META_BUSINESS_ID: z.string().optional(),
  FB_PAGE_ID: z.string().optional(),
  IG_BUSINESS_ACCOUNT_ID: z.string().optional(),
  META_INSTAGRAM_CONFIG_ID: z.string().optional(),
  META_REDIRECT_URI: z.string().optional(),
  META_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  META_GRAPH_VERSION: z.string().default("v23.0"),
  IG_MEDIA_LIMIT: z.coerce.number().default(50),

  /** Shared secret proving a request came from Vercel Cron. */
  CRON_SECRET: z.string().optional(),

  // --- Vercel (Landing Pages) -----------------------------------------
  /**
   * Read-only Vercel API token. Optional on purpose: the Landing Pages
   * screen has to render a setup guide rather than 500 when it is absent.
   */
  VERCEL_TOKEN: z.string().optional(),
  /** Only needed when the projects live under a team rather than a personal account. */
  VERCEL_TEAM_ID: z.string().optional(),
  VERCEL_API_URL: z.string().default("https://api.vercel.com"),

  /** How long provider responses stay cached. */
  DEPLOY_CACHE_TTL_MS: z.coerce.number().default(60_000),
});

const parsed = schema.safeParse(process.env);

/** Variable names that failed validation. Never contains a value. */
export const envErrors: string[] = parsed.success
  ? []
  : parsed.error.issues.map((i) => i.path.join("."));

/**
 * Falls back to defaults when parsing fails so importing this module can
 * never throw at build time — Next evaluates route modules during the
 * build, where none of these variables exist.
 */
export const env = parsed.success
  ? parsed.data
  : ({
      ...process.env,
      META_GRAPH_VERSION: process.env.META_GRAPH_VERSION ?? "v23.0",
      REDIS_PREFIX: process.env.REDIS_PREFIX ?? "mcnexus",
      ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL ?? "15m",
      REFRESH_TOKEN_TTL_DAYS: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30),
      IG_MEDIA_LIMIT: Number(process.env.IG_MEDIA_LIMIT ?? 50),
      VERCEL_API_URL: process.env.VERCEL_API_URL ?? "https://api.vercel.com",
    } as unknown as z.infer<typeof schema>);

export const isProd = env.NODE_ENV === "production";
export const envReady = parsed.success;
