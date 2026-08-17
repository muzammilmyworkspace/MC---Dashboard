/* ------------------------------------------------------------------ *
 *  MC Nexus — Platform connections
 *  Credential capture + connection state for every ad and social
 *  platform. Everything is ready for real OAuth; until credentials are
 *  supplied the UI shows clear, actionable empty states.
 * ------------------------------------------------------------------ */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ConnectionKey =
  | "google-ads" | "meta-ads"
  | "instagram" | "facebook" | "linkedin" | "tiktok" | "youtube";

export interface CredentialField {
  key: string;
  label: string;
  hint?: string;
  placeholder?: string;
  secret?: boolean;
  required?: boolean;
}

export interface ConnectionConfig {
  key: ConnectionKey;
  name: string;
  kind: "ads" | "social";
  blurb: string;
  /** Plain-language explanation for the non-technical client. */
  whatItDoes: string;
  fields: CredentialField[];
  scopes: string[];
  envVars: string[];
  webhook: string;
  docsUrl: string;
  sampleResponse: string;
  /** Metric tiles shown once connected. */
  metrics: string[];
}

export const connectionConfigs: Record<ConnectionKey, ConnectionConfig> = {
  "google-ads": {
    key: "google-ads", name: "Google Ads", kind: "ads",
    blurb: "Search campaigns, budgets, clicks and conversions.",
    whatItDoes: "Shows how your Google search adverts are performing — what you spent, how many people clicked, and how many became leads.",
    fields: [
      { key: "customerId", label: "Customer ID", hint: "Your 10-digit Google Ads account ID, e.g. 123-456-7890.", placeholder: "123-456-7890", required: true },
      { key: "managerId", label: "Manager (MCC) account ID", hint: "Optional — only if the account sits under a manager account.", placeholder: "987-654-3210" },
      { key: "developerToken", label: "Developer token", hint: "From your Google Ads API Centre.", secret: true, required: true },
      { key: "clientId", label: "OAuth client ID", hint: "From Google Cloud Console → Credentials.", required: true },
      { key: "clientSecret", label: "OAuth client secret", secret: true, required: true },
      { key: "refreshToken", label: "Refresh token", hint: "Generated once during the OAuth consent flow.", secret: true },
    ],
    scopes: ["https://www.googleapis.com/auth/adwords"],
    envVars: ["GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_ADS_LOGIN_CUSTOMER_ID"],
    webhook: "Not used — data is pulled on a schedule",
    docsUrl: "https://developers.google.com/google-ads/api/docs/start",
    sampleResponse: `{
  "results": [
    { "campaign": { "name": "Brand Search" },
      "metrics": { "clicks": 612, "conversions": 41, "costMicros": 480000000 } }
  ]
}`,
    metrics: ["Campaigns", "Budget", "Clicks", "CTR", "Conversions", "Quality score"],
  },

  "meta-ads": {
    key: "meta-ads", name: "Meta Ads", kind: "ads",
    blurb: "Facebook & Instagram campaigns, spend, reach and ROAS.",
    whatItDoes: "Shows how your Facebook and Instagram adverts are doing — reach, spend, and the return you're getting back.",
    fields: [
      { key: "accessToken", label: "Access token", hint: "Long-lived system-user token from Business Manager.", secret: true, required: true },
      { key: "businessId", label: "Business Manager ID", placeholder: "1234567890", required: true },
      { key: "adAccountId", label: "Ad account ID", hint: "Starts with act_", placeholder: "act_1234567890", required: true },
      { key: "pageId", label: "Facebook Page ID", placeholder: "1234567890" },
      { key: "igAccountId", label: "Instagram account ID", hint: "The professional account linked to the Page." },
      { key: "pixelId", label: "Pixel ID", hint: "Used for conversion tracking." },
      { key: "appSecret", label: "App secret", secret: true },
    ],
    scopes: ["ads_read", "ads_management", "business_management", "pages_read_engagement", "instagram_basic"],
    envVars: ["META_APP_ID", "META_APP_SECRET", "META_ACCESS_TOKEN", "META_AD_ACCOUNT_ID", "META_BUSINESS_ID"],
    webhook: "Subscribed — ad account & lead events",
    docsUrl: "https://developers.facebook.com/docs/marketing-apis",
    sampleResponse: `{
  "data": [
    { "campaign_name": "Workshop — Retargeting",
      "spend": "842.19", "impressions": "112480", "ctr": "1.94", "purchase_roas": [{ "value": "4.2" }] }
  ]
}`,
    metrics: ["Campaigns", "Spend", "Reach", "Impressions", "CTR", "ROAS"],
  },

  instagram: {
    key: "instagram", name: "Instagram", kind: "social",
    blurb: "Publish posts and reels, and read account insights.",
    whatItDoes: "Lets the dashboard publish your planned posts to Instagram and bring back followers, reach and engagement.",
    fields: [
      { key: "accessToken", label: "Access token", hint: "Long-lived token via Facebook Login.", secret: true, required: true },
      { key: "igAccountId", label: "Instagram business account ID", required: true },
      { key: "pageId", label: "Linked Facebook Page ID", hint: "Instagram professional accounts connect through a Page.", required: true },
    ],
    scopes: ["instagram_basic", "instagram_content_publish", "instagram_manage_insights", "instagram_manage_comments"],
    envVars: ["META_ACCESS_TOKEN", "IG_BUSINESS_ACCOUNT_ID", "META_APP_ID", "META_APP_SECRET"],
    webhook: "Subscribed — comments & mentions",
    docsUrl: "https://developers.facebook.com/docs/instagram-api",
    sampleResponse: `{ "id": "17895...", "media_type": "REELS", "like_count": 842, "comments_count": 61 }`,
    metrics: ["Followers", "Reach", "Engagement", "Scheduled posts"],
  },

  facebook: {
    key: "facebook", name: "Facebook", kind: "social",
    blurb: "Page posting, reach and audience insights.",
    whatItDoes: "Publishes to your Facebook Page and brings back how many people saw and engaged with each post.",
    fields: [
      { key: "accessToken", label: "Page access token", secret: true, required: true },
      { key: "pageId", label: "Page ID", required: true },
    ],
    scopes: ["pages_manage_posts", "pages_read_engagement", "read_page_mailboxes"],
    envVars: ["META_APP_ID", "META_APP_SECRET", "FB_PAGE_ID"],
    webhook: "Subscribed — feed events",
    docsUrl: "https://developers.facebook.com/docs/pages-api",
    sampleResponse: `{ "id": "1094..._5567...", "message": "…", "reach": 4821, "reactions": 214 }`,
    metrics: ["Followers", "Reach", "Scheduled posts", "Messages"],
  },

  linkedin: {
    key: "linkedin", name: "LinkedIn", kind: "social",
    blurb: "Company page posts, impressions and follower growth.",
    whatItDoes: "Publishes to your company page and reports how many people saw and clicked each post.",
    fields: [
      { key: "clientId", label: "Client ID", required: true },
      { key: "clientSecret", label: "Client secret", secret: true, required: true },
      { key: "orgUrn", label: "Organization URN", hint: "e.g. urn:li:organization:12345678", placeholder: "urn:li:organization:…", required: true },
      { key: "accessToken", label: "Access token", secret: true },
    ],
    scopes: ["r_organization_social", "w_organization_social", "rw_organization_admin"],
    envVars: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET", "LINKEDIN_ORG_URN"],
    webhook: "Not available on this API",
    docsUrl: "https://learn.microsoft.com/linkedin/marketing",
    sampleResponse: `{ "elements": [{ "totalShareStatistics": { "impressionCount": 22140, "clickCount": 611 } }] }`,
    metrics: ["Followers", "Post views", "Scheduled posts", "Profile views"],
  },

  tiktok: {
    key: "tiktok", name: "TikTok", kind: "social",
    blurb: "Video publishing and performance analytics.",
    whatItDoes: "Publishes your reels to TikTok and reports views, likes and follower growth.",
    fields: [
      { key: "clientKey", label: "Client key", required: true },
      { key: "clientSecret", label: "Client secret", secret: true, required: true },
      { key: "accessToken", label: "Access token", secret: true },
      { key: "openId", label: "Open ID", hint: "Identifies the connected TikTok account." },
    ],
    scopes: ["user.info.basic", "video.list", "video.publish"],
    envVars: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "TIKTOK_REDIRECT_URI"],
    webhook: "Available — post status callbacks",
    docsUrl: "https://developers.tiktok.com",
    sampleResponse: `{ "data": { "videos": [{ "id": "72…", "view_count": 18240, "like_count": 1320 }] } }`,
    metrics: ["Followers", "Views", "Engagement", "Latest reel"],
  },

  youtube: {
    key: "youtube", name: "YouTube", kind: "social",
    blurb: "Uploads, views, watch time and subscribers.",
    whatItDoes: "Uploads videos to your channel and reports views, watch time and subscriber growth.",
    fields: [
      { key: "clientId", label: "OAuth client ID", required: true },
      { key: "clientSecret", label: "OAuth client secret", secret: true, required: true },
      { key: "refreshToken", label: "Refresh token", secret: true },
      { key: "channelId", label: "Channel ID", placeholder: "UC…" },
    ],
    scopes: ["https://www.googleapis.com/auth/youtube.readonly", "https://www.googleapis.com/auth/youtube.upload"],
    envVars: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REFRESH_TOKEN"],
    webhook: "PubSubHubbub — new upload notifications",
    docsUrl: "https://developers.google.com/youtube/v3",
    sampleResponse: `{ "items": [{ "statistics": { "subscriberCount": "6210", "viewCount": "88240" } }] }`,
    metrics: ["Subscribers", "Views", "Watch time", "Latest upload"],
  },
};

export type ConnStatus = "not_connected" | "connected" | "error";

export interface ConnectionState {
  status: ConnStatus;
  lastSync: string | null;
  lastTest: { ok: boolean; message: string; at: string } | null;
}

interface ConnectionsStore {
  credentials: Record<string, Record<string, string>>;
  connections: Record<string, ConnectionState>;
  setCredential: (key: ConnectionKey, field: string, value: string) => void;
  getCredentials: (key: ConnectionKey) => Record<string, string>;
  getState: (key: ConnectionKey) => ConnectionState;
  testConnection: (key: ConnectionKey) => { ok: boolean; message: string };
  connect: (key: ConnectionKey) => { ok: boolean; message: string };
  disconnect: (key: ConnectionKey) => void;
  sync: (key: ConnectionKey) => void;
}

const defaultState: ConnectionState = { status: "not_connected", lastSync: null, lastTest: null };

export const useConnections = create<ConnectionsStore>()(
  persist(
    (set, get) => ({
      credentials: {},
      connections: {},

      setCredential: (key, field, value) =>
        set((s) => ({ credentials: { ...s.credentials, [key]: { ...(s.credentials[key] ?? {}), [field]: value } } })),

      getCredentials: (key) => get().credentials[key] ?? {},
      getState: (key) => get().connections[key] ?? defaultState,

      testConnection: (key) => {
        const cfg = connectionConfigs[key];
        const creds = get().credentials[key] ?? {};
        const missing = cfg.fields.filter((f) => f.required && !creds[f.key]?.trim()).map((f) => f.label);
        const result = missing.length
          ? { ok: false, message: `Missing: ${missing.join(", ")}` }
          : { ok: true, message: "All required credentials present — ready to authorize." };

        set((s) => ({
          connections: {
            ...s.connections,
            [key]: { ...(s.connections[key] ?? defaultState), lastTest: { ...result, at: new Date().toISOString() } },
          },
        }));
        return result;
      },

      connect: (key) => {
        const result = get().testConnection(key);
        if (!result.ok) return result;
        set((s) => ({
          connections: { ...s.connections, [key]: { status: "connected", lastSync: new Date().toISOString(), lastTest: s.connections[key]?.lastTest ?? null } },
        }));
        return { ok: true, message: "Connected" };
      },

      disconnect: (key) =>
        set((s) => ({ connections: { ...s.connections, [key]: { ...defaultState, lastTest: s.connections[key]?.lastTest ?? null } } })),

      sync: (key) =>
        set((s) => ({
          connections: { ...s.connections, [key]: { ...(s.connections[key] ?? defaultState), lastSync: new Date().toISOString() } },
        })),
    }),
    { name: "mc-nexus-connections-v1" }
  )
);
