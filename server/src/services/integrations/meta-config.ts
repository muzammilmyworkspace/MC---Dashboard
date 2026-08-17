/* ------------------------------------------------------------------ *
 *  Meta / Instagram OAuth configuration — SERVER ONLY
 *
 *  Nothing in this file may be imported from `src/` (the Next.js app).
 *  It reads META_APP_SECRET, and no function here returns, logs or
 *  serialises that value — `status()` is the only shape intended to reach
 *  a client, and it carries variable *names* only.
 *
 *  Validation deliberately happens at point of use rather than at boot.
 *  `env.ts` exits the process when its schema fails, so treating Meta
 *  values as required there would stop the entire dashboard from starting
 *  before anyone has entered credentials. Here, an unconfigured
 *  integration reports itself and everything else keeps working.
 * ------------------------------------------------------------------ */
import { env } from "../../env.js";

/** The exact copy the UI shows when credentials are absent. */
export const META_NOT_CONFIGURED = "Instagram integration is not configured.";

/** Values needed before the OAuth flow can run at all. */
const REQUIRED_FOR_OAUTH = [
  "META_APP_ID",
  "META_APP_SECRET",
  "META_INSTAGRAM_CONFIG_ID",
  "META_REDIRECT_URI",
] as const;

/** Needed only once webhooks are implemented — not part of OAuth readiness. */
const REQUIRED_FOR_WEBHOOKS = ["META_WEBHOOK_VERIFY_TOKEN"] as const;

export type MetaEnvKey =
  | (typeof REQUIRED_FOR_OAUTH)[number]
  | (typeof REQUIRED_FOR_WEBHOOKS)[number];

export interface MetaConfigProblem {
  key: MetaEnvKey;
  reason: string;
}

export interface MetaConfigStatus {
  /** OAuth can run. Webhook readiness is tracked separately. */
  configured: boolean;
  webhooksConfigured: boolean;
  /** Variable names only — never values. */
  missing: MetaEnvKey[];
  invalid: MetaConfigProblem[];
  message: string;
}

export class MetaNotConfiguredError extends Error {
  readonly missing: MetaEnvKey[];
  readonly invalid: MetaConfigProblem[];

  constructor(status: MetaConfigStatus) {
    super(status.message);
    this.name = "MetaNotConfiguredError";
    this.missing = status.missing;
    this.invalid = status.invalid;
  }
}

/**
 * Reads process.env rather than the `env` snapshot on purpose.
 *
 * None of these keys carry a zod default — they are plain optional strings
 * that dotenv has already loaded into process.env — so the two are identical
 * in production. Using a single source keeps "unset" genuinely unset instead
 * of falling back to a value captured at boot.
 */
function read(key: MetaEnvKey): string {
  return process.env[key]?.trim() ?? "";
}

/**
 * Catches the classic mistake of pasting a placeholder from the template
 * instead of a real value — those parse fine but fail confusingly at Meta.
 */
function looksLikePlaceholder(value: string): boolean {
  return /^(<.*>|your[-_ ]|xxx+|todo|changeme|placeholder)/i.test(value);
}

function validate(key: MetaEnvKey, value: string): string | null {
  if (looksLikePlaceholder(value)) return "still set to a placeholder value";

  switch (key) {
    case "META_APP_ID":
    case "META_INSTAGRAM_CONFIG_ID":
      // Meta ids are numeric strings; they exceed Number.MAX_SAFE_INTEGER so
      // they must stay strings — never parse these into numbers.
      return /^\d{8,}$/.test(value) ? null : "should be a numeric Meta id";

    case "META_APP_SECRET":
      return value.length >= 32 ? null : "shorter than a valid Meta app secret";

    case "META_REDIRECT_URI":
      try {
        const url = new URL(value);
        if (url.protocol !== "https:" && url.hostname !== "localhost") {
          return "must use https outside localhost";
        }
        return null;
      } catch {
        return "is not a valid absolute URL";
      }

    case "META_WEBHOOK_VERIFY_TOKEN":
      return value.length >= 16 ? null : "should be at least 16 characters";
  }
}

function inspect(keys: readonly MetaEnvKey[]) {
  const missing: MetaEnvKey[] = [];
  const invalid: MetaConfigProblem[] = [];

  for (const key of keys) {
    const value = read(key);
    if (!value) {
      missing.push(key);
      continue;
    }
    const reason = validate(key, value);
    if (reason) invalid.push({ key, reason });
  }

  return { missing, invalid };
}

/** Safe to serialise into an API response — names and reasons, no values. */
export function metaConfigStatus(): MetaConfigStatus {
  const oauth = inspect(REQUIRED_FOR_OAUTH);
  const webhooks = inspect(REQUIRED_FOR_WEBHOOKS);

  const configured = oauth.missing.length === 0 && oauth.invalid.length === 0;
  const webhooksConfigured =
    webhooks.missing.length === 0 && webhooks.invalid.length === 0;

  let message = META_NOT_CONFIGURED;
  if (configured) {
    message = "Meta credentials present.";
  } else if (oauth.invalid.length) {
    message = `${META_NOT_CONFIGURED} ${oauth.invalid
      .map((p) => `${p.key} ${p.reason}`)
      .join("; ")}`;
  } else if (oauth.missing.length) {
    message = `${META_NOT_CONFIGURED} Set ${oauth.missing.join(", ")} in server/.env`;
  }

  return {
    configured,
    webhooksConfigured,
    missing: [...oauth.missing, ...webhooks.missing],
    invalid: [...oauth.invalid, ...webhooks.invalid],
    message,
  };
}

export function isMetaConfigured(): boolean {
  return metaConfigStatus().configured;
}

export interface MetaOAuthConfig {
  appId: string;
  /** Never log, return over HTTP, or include in an error message. */
  appSecret: string;
  configId: string;
  redirectUri: string;
  apiVersion: string;
}

/**
 * The only accessor for Meta credentials. Throws rather than returning a
 * half-populated object, so a caller can never silently build a request with
 * an empty secret.
 */
export function metaOAuthConfig(): MetaOAuthConfig {
  const status = metaConfigStatus();
  if (!status.configured) throw new MetaNotConfiguredError(status);

  return {
    appId: read("META_APP_ID"),
    appSecret: read("META_APP_SECRET"),
    configId: read("META_INSTAGRAM_CONFIG_ID"),
    redirectUri: read("META_REDIRECT_URI"),
    apiVersion: env.META_GRAPH_VERSION,
  };
}

export function metaWebhookVerifyToken(): string {
  const value = read("META_WEBHOOK_VERIFY_TOKEN");
  const reason = value ? validate("META_WEBHOOK_VERIFY_TOKEN", value) : "is not set";
  if (reason) {
    throw new MetaNotConfiguredError({
      configured: false,
      webhooksConfigured: false,
      missing: value ? [] : ["META_WEBHOOK_VERIFY_TOKEN"],
      invalid: value ? [{ key: "META_WEBHOOK_VERIFY_TOKEN", reason }] : [],
      message: `Webhook verify token ${reason}. Generate one with: openssl rand -hex 32`,
    });
  }
  return value;
}

/**
 * Boot-time guard for the client/server boundary.
 *
 * Anything under NEXT_PUBLIC_* is inlined into the browser bundle by Next.js.
 * A secret placed there is public the moment it ships, and nothing downstream
 * would catch it — so shout at startup instead. Warns rather than exits: this
 * must not be able to take the dashboard down.
 */
export function assertNoPublicSecrets(): void {
  const leaked = Object.keys(process.env).filter(
    (key) => key.startsWith("NEXT_PUBLIC_") && /SECRET|TOKEN|PASSWORD|PRIVATE/i.test(key)
  );

  if (leaked.length) {
    console.error(
      `\n  ⚠  SECURITY: these are exposed to the browser by Next.js —\n` +
        leaked.map((k) => `     • ${k}`).join("\n") +
        `\n     Remove the NEXT_PUBLIC_ prefix and read them server-side.\n`
    );
  }
}
