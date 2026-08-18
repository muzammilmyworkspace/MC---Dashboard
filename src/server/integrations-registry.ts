import "server-only";

/**
 * Static metadata for the integrations the dashboard knows about.
 *
 * Trimmed to what the UI actually renders. The Express version carried
 * fifteen providers with stub OAuth methods; the ones without a backend were
 * indistinguishable from real ones, which is exactly the ambiguity the
 * dashboard's three-state status is meant to remove.
 */
export interface PlatformIntegration {
  key: string;
  name: string;
  category: string;
  docsUrl: string;
  requiredEnv: string[];
  scopes: string[];
}

export const platformIntegrations: PlatformIntegration[] = [
  {
    key: "meta-graph",
    name: "Meta Graph API",
    category: "Social",
    docsUrl: "https://developers.facebook.com/docs/graph-api",
    requiredEnv: ["META_APP_ID", "META_APP_SECRET", "META_INSTAGRAM_CONFIG_ID", "META_REDIRECT_URI"],
    scopes: ["pages_show_list", "pages_read_engagement", "instagram_basic", "instagram_manage_insights"],
  },
  {
    key: "instagram-graph",
    name: "Instagram Graph API",
    category: "Social",
    docsUrl: "https://developers.facebook.com/docs/instagram-api",
    requiredEnv: ["META_ACCESS_TOKEN", "IG_BUSINESS_ACCOUNT_ID"],
    scopes: ["instagram_basic", "instagram_manage_insights"],
  },
];
