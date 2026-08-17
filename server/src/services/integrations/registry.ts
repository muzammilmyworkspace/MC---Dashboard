import {
  NotImplementedError,
  missingEnv,
  type ConnectionTest,
  type IntegrationProvider,
  type OAuthCredentials,
  type PlatformSnapshot,
} from "./types.js";
import { getAccount, isConfigured } from "../instagram/client.js";
import { getFollowerHistory } from "../instagram/sync.js";
import { buildAuthorizeUrl, metaConnectionStatus, signOAuthState } from "./meta-oauth.js";

interface Descriptor {
  key: string;
  name: string;
  category: IntegrationProvider["category"];
  docsUrl: string;
  authBase?: string;
  requiredEnv: string[];
  scopes: string[];
  apiKeyOnly?: boolean;
  /** Live implementation for providers that are wired up — merged over the stub. */
  impl?: Partial<IntegrationProvider>;
}

/**
 * Builds a provider from a descriptor. Live logic is filled in per provider
 * as each API is enabled — the API layer never changes.
 */
function defineProvider(d: Descriptor): IntegrationProvider {
  return {
    key: d.key,
    name: d.name,
    category: d.category,
    docsUrl: d.docsUrl,
    requiredEnv: d.requiredEnv,
    scopes: d.scopes,
    apiKeyOnly: d.apiKeyOnly,

    getAuthUrl(state: string) {
      if (d.apiKeyOnly) throw new NotImplementedError(d.key, "getAuthUrl");
      const clientId = process.env[d.requiredEnv[0]] ?? "";
      const redirect = process.env.OAUTH_REDIRECT_BASE ?? "http://localhost:4000/api/integrations/callback";
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: `${redirect}/${d.key}`,
        response_type: "code",
        scope: d.scopes.join(" "),
        state,
      });
      return `${d.authBase ?? "https://example.com/oauth/authorize"}?${params.toString()}`;
    },

    async exchangeCode(): Promise<OAuthCredentials> {
      throw new NotImplementedError(d.key, "exchangeCode");
    },

    async refreshCredentials(creds: OAuthCredentials): Promise<OAuthCredentials> {
      throw new NotImplementedError(d.key, "refreshCredentials");
    },

    async testConnection(creds: OAuthCredentials): Promise<ConnectionTest> {
      const missing = missingEnv(d.requiredEnv);
      if (missing.length) {
        return { ok: false, message: `Missing env: ${missing.join(", ")}`, checkedAt: new Date().toISOString() };
      }
      if (!creds.accessToken && !d.apiKeyOnly) {
        return { ok: false, message: "Not authorized — run the OAuth flow", checkedAt: new Date().toISOString() };
      }
      return { ok: true, message: "Configuration looks valid", checkedAt: new Date().toISOString() };
    },

    async fetchSnapshot(): Promise<PlatformSnapshot> {
      throw new NotImplementedError(d.key, "fetchSnapshot");
    },

    ...d.impl,
  };
}

const descriptors: Descriptor[] = [
  {
    key: "meta-graph", name: "Meta Graph API", category: "Social",
    docsUrl: "https://developers.facebook.com/docs/graph-api",
    // Kept in step with META_GRAPH_VERSION — an auth dialog on one version
    // and API calls on another is a subtle source of scope mismatches.
    authBase: "https://www.facebook.com/v23.0/dialog/oauth",
    requiredEnv: ["META_APP_ID", "META_APP_SECRET", "META_INSTAGRAM_CONFIG_ID", "META_REDIRECT_URI"],
    // Informational only. With Facebook Login for Business the granted
    // permissions come from the config_id's configuration in the Meta
    // dashboard, not from a scope parameter — see meta-oauth.ts.
    scopes: ["pages_show_list", "pages_read_engagement", "instagram_basic", "instagram_manage_insights"],
    impl: {
      createState: (userId: string) => signOAuthState(userId),

      getAuthUrl: (state: string) => buildAuthorizeUrl(state),

      /**
       * Present so the IntegrationProvider contract is honoured, but the real
       * flow runs in the callback route: it also needs the user id carried by
       * the signed state, which this signature has no room for.
       */
      async exchangeCode(): Promise<OAuthCredentials> {
        throw new NotImplementedError(
          "meta-graph",
          "exchangeCode — use the OAuth callback at GET /api/integrations/callback/meta"
        );
      },

      async testConnection(): Promise<ConnectionTest> {
        const status = await metaConnectionStatus();
        return { ok: status.connected, message: status.message, checkedAt: new Date().toISOString() };
      },
    },
  },
  {
    key: "instagram-graph", name: "Instagram Graph API", category: "Social",
    docsUrl: "https://developers.facebook.com/docs/instagram-api",
    authBase: "https://www.facebook.com/v23.0/dialog/oauth",
    // A System User token replaces the OAuth dance — these two are all the
    // sync needs. App id/secret are only used to inspect the token.
    requiredEnv: ["META_ACCESS_TOKEN", "IG_BUSINESS_ACCOUNT_ID"],
    scopes: ["instagram_basic", "instagram_content_publish", "instagram_manage_insights", "instagram_manage_comments"],
    impl: {
      async testConnection(): Promise<ConnectionTest> {
        const checkedAt = new Date().toISOString();
        if (!isConfigured()) {
          return { ok: false, message: "Set META_ACCESS_TOKEN and IG_BUSINESS_ACCOUNT_ID in server/.env", checkedAt };
        }
        try {
          const account = await getAccount();
          return {
            ok: true,
            message: `Connected to @${account.username} — ${account.followers_count.toLocaleString()} followers`,
            checkedAt,
          };
        } catch (err) {
          return { ok: false, message: (err as Error).message, checkedAt };
        }
      },

      async fetchSnapshot(): Promise<PlatformSnapshot> {
        const account = await getAccount();
        const history = await getFollowerHistory(30);
        const recent = history.filter((d) => d.gained !== null && d.lost !== null);
        const gained = recent.reduce((s, d) => s + (d.gained ?? 0), 0);
        const lost = recent.reduce((s, d) => s + (d.lost ?? 0), 0);
        const reach = history.reduce((s, d) => s + (d.reach ?? 0), 0);

        return {
          key: "instagram-graph",
          fetchedAt: new Date().toISOString(),
          metrics: [
            { label: "Followers", value: account.followers_count.toLocaleString(), delta: `${gained - lost >= 0 ? "+" : ""}${gained - lost} (30d)` },
            { label: "Gained", value: gained.toLocaleString() },
            { label: "Lost", value: lost.toLocaleString() },
            { label: "Posts", value: account.media_count.toLocaleString() },
            { label: "Reach (30d)", value: reach.toLocaleString() },
          ],
        };
      },
    },
  },
  {
    key: "facebook-graph", name: "Facebook Graph API", category: "Social",
    docsUrl: "https://developers.facebook.com/docs/pages-api",
    authBase: "https://www.facebook.com/v21.0/dialog/oauth",
    requiredEnv: ["META_APP_ID", "META_APP_SECRET", "FB_PAGE_ID"],
    scopes: ["pages_manage_posts", "pages_read_engagement", "read_page_mailboxes"],
  },
  {
    key: "google-ads", name: "Google Ads API", category: "Advertising",
    docsUrl: "https://developers.google.com/google-ads/api/docs/start",
    authBase: "https://accounts.google.com/o/oauth2/v2/auth",
    requiredEnv: ["GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_LOGIN_CUSTOMER_ID"],
    scopes: ["https://www.googleapis.com/auth/adwords"],
  },
  {
    key: "ga4", name: "Google Analytics 4 API", category: "Analytics",
    docsUrl: "https://developers.google.com/analytics/devguides/reporting/data/v1",
    authBase: "https://accounts.google.com/o/oauth2/v2/auth",
    requiredEnv: ["GA4_PROPERTY_ID", "GOOGLE_APPLICATION_CREDENTIALS"],
    scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
  },
  {
    key: "search-console", name: "Google Search Console API", category: "Analytics",
    docsUrl: "https://developers.google.com/webmaster-tools",
    authBase: "https://accounts.google.com/o/oauth2/v2/auth",
    requiredEnv: ["GSC_SITE_URL", "GOOGLE_APPLICATION_CREDENTIALS"],
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  },
  {
    key: "workspace", name: "Google Workspace Admin SDK", category: "Workspace",
    docsUrl: "https://developers.google.com/admin-sdk",
    authBase: "https://accounts.google.com/o/oauth2/v2/auth",
    requiredEnv: ["WORKSPACE_ADMIN_EMAIL", "GOOGLE_APPLICATION_CREDENTIALS"],
    scopes: [
      "https://www.googleapis.com/auth/admin.directory.user.readonly",
      "https://www.googleapis.com/auth/admin.reports.usage.readonly",
    ],
  },
  {
    key: "youtube", name: "YouTube Data API", category: "Social",
    docsUrl: "https://developers.google.com/youtube/v3",
    authBase: "https://accounts.google.com/o/oauth2/v2/auth",
    requiredEnv: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET"],
    scopes: ["https://www.googleapis.com/auth/youtube.readonly", "https://www.googleapis.com/auth/youtube.upload"],
  },
  {
    key: "linkedin", name: "LinkedIn API", category: "Social",
    docsUrl: "https://learn.microsoft.com/linkedin/marketing",
    authBase: "https://www.linkedin.com/oauth/v2/authorization",
    requiredEnv: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET", "LINKEDIN_ORG_URN"],
    scopes: ["r_organization_social", "w_organization_social", "rw_organization_admin"],
  },
  {
    key: "tiktok", name: "TikTok Business API", category: "Social",
    docsUrl: "https://developers.tiktok.com",
    authBase: "https://www.tiktok.com/v2/auth/authorize",
    requiredEnv: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "TIKTOK_REDIRECT_URI"],
    scopes: ["user.info.basic", "video.list", "video.publish"],
  },
  {
    key: "cloudinary", name: "Cloudinary", category: "Storage",
    docsUrl: "https://cloudinary.com/documentation",
    requiredEnv: ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"],
    scopes: ["upload", "admin"], apiKeyOnly: true,
  },
  {
    key: "google-drive", name: "Google Drive", category: "Storage",
    docsUrl: "https://developers.google.com/drive/api",
    authBase: "https://accounts.google.com/o/oauth2/v2/auth",
    requiredEnv: ["GDRIVE_CLIENT_ID", "GDRIVE_CLIENT_SECRET"],
    scopes: ["https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/drive.readonly"],
  },
  {
    key: "dropbox", name: "Dropbox", category: "Storage",
    docsUrl: "https://www.dropbox.com/developers/documentation",
    authBase: "https://www.dropbox.com/oauth2/authorize",
    requiredEnv: ["DROPBOX_APP_KEY", "DROPBOX_APP_SECRET"],
    scopes: ["files.content.read", "files.content.write", "sharing.read"],
  },
  {
    key: "openai", name: "OpenAI API", category: "AI",
    docsUrl: "https://platform.openai.com/docs",
    requiredEnv: ["OPENAI_API_KEY"],
    scopes: ["chat.completions", "embeddings"], apiKeyOnly: true,
  },
  {
    key: "smtp", name: "SMTP (Email)", category: "Email",
    docsUrl: "https://nodemailer.com",
    requiredEnv: ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD"],
    scopes: ["mail.send"], apiKeyOnly: true,
  },
];

export const providers: Record<string, IntegrationProvider> = Object.fromEntries(
  descriptors.map((d) => [d.key, defineProvider(d)])
);

export const providerList = Object.values(providers);

export function getProvider(key: string): IntegrationProvider | undefined {
  return providers[key];
}
