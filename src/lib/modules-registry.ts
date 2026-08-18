import { LayoutDashboard } from "lucide-react";
import {
  InstagramIcon, FacebookIcon, MetaIcon, YouTubeIcon, TikTokIcon,
  GoogleAdsIcon, GoogleAnalyticsIcon, LandingPagesIcon,
} from "@/components/brand/platform-icons";

/**
 * Icons are plain components rather than LucideIcon, because the platform
 * marks are inline SVG — lucide dropped brand icons in v1, and a generic
 * camera standing in for Instagram made the nav harder to scan, not easier.
 */
export type ModuleIcon = React.ComponentType<{ size?: number; className?: string }>;

/**
 * The eight things in the product, in one place.
 *
 * Navigation, the dashboard cards and each module page all read from here, so
 * a module can't be renamed in one surface and stale in another. Adding a
 * platform later means one entry plus a route file.
 */
export interface PlatformModule {
  href: string;
  name: string;
  icon: ModuleIcon;
  /** One plain-language line. Used on the card and the page header. */
  description: string;
  /** What the module will cover. Written as scope, not as promises about today. */
  capabilities: string[];
  /**
   * Integration key on the API, when the backend knows about it.
   * null means there is no backend for this module yet — the UI must not
   * imply a connection it cannot check.
   */
  integrationKey: string | null;
  /** True only where the module actually does something today. */
  live: boolean;
}

export const platformModules: PlatformModule[] = [
  {
    href: "/google",
    name: "Google",
    icon: GoogleAdsIcon,
    description: "Ads, Search Console and Workspace in one place.",
    capabilities: ["Campaign performance", "Search rankings & queries", "Budget pacing", "Conversion tracking"],
    integrationKey: "google-ads",
    live: false,
  },
  {
    href: "/meta",
    name: "Meta",
    icon: MetaIcon,
    description: "Ad spend, campaign performance and return on ad spend.",
    capabilities: ["Campaign performance", "Spend and ROAS", "Clicks, CTR and CPC", "Conversions"],
    integrationKey: "meta-graph",
    live: true,
  },
  {
    href: "/facebook",
    name: "Facebook",
    icon: FacebookIcon,
    description: "Page followers, reach and post performance.",
    capabilities: ["Page followers", "Post engagement", "Page reach", "Recent posts"],
    integrationKey: "meta-graph",
    live: true,
  },
  {
    href: "/analytics",
    name: "Analytics",
    icon: GoogleAnalyticsIcon,
    description: "Traffic, engagement and conversions across the site.",
    capabilities: ["Sessions & users", "Traffic sources", "Conversion funnels", "Revenue attribution"],
    integrationKey: "ga4",
    live: false,
  },
  {
    href: "/landing-pages",
    name: "Landing Pages",
    icon: LandingPagesIcon,
    description: "Page performance, forms and conversion rates.",
    capabilities: ["Page-level conversion rates", "Form submissions", "A/B test results", "Load performance"],
    integrationKey: null,
    live: false,
  },
  {
    href: "/instagram",
    name: "Instagram",
    icon: InstagramIcon,
    description: "Content, insights, comments and account management.",
    capabilities: ["Follower growth", "Post & reel performance", "Reach and engagement", "Comment management"],
    integrationKey: "instagram-graph",
    live: true,
  },
  {
    href: "/youtube",
    name: "YouTube",
    icon: YouTubeIcon,
    description: "Channel growth, video performance and audience retention.",
    capabilities: ["Subscriber growth", "Views & watch time", "Audience retention", "Comment management"],
    integrationKey: "youtube",
    live: false,
  },
  {
    href: "/tiktok",
    name: "TikTok",
    icon: TikTokIcon,
    description: "Video performance, followers and engagement.",
    capabilities: ["Follower growth", "Video views & completion", "Engagement rate", "Trending sounds"],
    integrationKey: "tiktok",
    live: false,
  },
];

export const dashboardModule = {
  href: "/dashboard",
  name: "Dashboard",
  icon: LayoutDashboard,
  description: "Overview of every connected platform.",
} as const;

export function moduleFor(href: string): PlatformModule | undefined {
  return platformModules.find((m) => m.href === href);
}
