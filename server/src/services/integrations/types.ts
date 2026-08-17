/**
 * Common contract every platform integration implements.
 * Phase 2 ships the contract + metadata; individual providers plug in
 * their real OAuth/fetch logic without touching the API layer.
 */

export interface OAuthCredentials {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  accountId?: string;
  [key: string]: unknown;
}

export interface ConnectionTest {
  ok: boolean;
  message: string;
  checkedAt: string;
}

/** Normalised metric bag rendered by the dashboard platform widgets. */
export interface PlatformSnapshot {
  key: string;
  fetchedAt: string;
  metrics: { label: string; value: string; delta?: string }[];
}

export interface IntegrationProvider {
  key: string;
  name: string;
  category: "Social" | "Advertising" | "Analytics" | "Workspace" | "Storage" | "AI" | "Email";
  docsUrl: string;
  /** Env vars that must be present before this provider can connect. */
  requiredEnv: string[];
  /** OAuth scopes requested during authorization. */
  scopes: string[];
  /** True when the provider uses an API key rather than a user OAuth dance. */
  apiKeyOnly?: boolean;

  /** Step 1 — where to send the user to authorize. */
  getAuthUrl(state: string): string;
  /**
   * Optional: mint a state value bound to the user starting the flow.
   * Providers whose callback arrives unauthenticated (a browser redirect)
   * need this to know who to attribute the connection to. Providers without
   * it get an opaque random state instead.
   */
  createState?(userId: string): string;
  /** Step 2 — swap the callback code for tokens. */
  exchangeCode(code: string): Promise<OAuthCredentials>;
  /** Refresh an expiring access token. */
  refreshCredentials(creds: OAuthCredentials): Promise<OAuthCredentials>;
  /** Cheap liveness probe used by the Integration Center. */
  testConnection(creds: OAuthCredentials): Promise<ConnectionTest>;
  /** Pull the metrics the dashboard renders. */
  fetchSnapshot(creds: OAuthCredentials): Promise<PlatformSnapshot>;
}

export class NotImplementedError extends Error {
  constructor(provider: string, method: string) {
    super(`${provider}.${method}() is not implemented yet — wire the live API in Phase 2.`);
    this.name = "NotImplementedError";
  }
}

/** Missing env vars for a provider, so the UI can show a precise setup hint. */
export function missingEnv(required: string[]): string[] {
  return required.filter((k) => !process.env[k]);
}
