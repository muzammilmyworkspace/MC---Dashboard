import {
  LayoutDashboard,
  Search,
  Megaphone,
  LineChart,
  LayoutTemplate,
  Camera,
  MonitorPlay,
  Music2,
  type LucideIcon,
} from "lucide-react";

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
  icon: LucideIcon;
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
    icon: Search,
    description: "Ads, Search Console and Workspace in one place.",
    capabilities: ["Campaign performance", "Search rankings & queries", "Budget pacing", "Conversion tracking"],
    integrationKey: "google-ads",
    live: false,
  },
  {
    href: "/meta",
    name: "Meta",
    icon: Megaphone,
    description: "Facebook Pages and Meta advertising.",
    capabilities: ["Page posts & scheduling", "Ad spend and ROAS", "Audience insights", "Comments & messages"],
    integrationKey: "meta-graph",
    live: false,
  },
  {
    href: "/analytics",
    name: "Analytics",
    icon: LineChart,
    description: "Traffic, engagement and conversions across the site.",
    capabilities: ["Sessions & users", "Traffic sources", "Conversion funnels", "Revenue attribution"],
    integrationKey: "ga4",
    live: false,
  },
  {
    href: "/landing-pages",
    name: "Landing Pages",
    icon: LayoutTemplate,
    description: "Page performance, forms and conversion rates.",
    capabilities: ["Page-level conversion rates", "Form submissions", "A/B test results", "Load performance"],
    integrationKey: null,
    live: false,
  },
  {
    href: "/instagram",
    name: "Instagram",
    icon: Camera,
    description: "Content, insights, comments and account management.",
    capabilities: ["Follower growth", "Post & reel performance", "Reach and engagement", "Comment management"],
    integrationKey: "instagram-graph",
    live: true,
  },
  {
    href: "/youtube",
    name: "YouTube",
    icon: MonitorPlay,
    description: "Channel growth, video performance and audience retention.",
    capabilities: ["Subscriber growth", "Views & watch time", "Audience retention", "Comment management"],
    integrationKey: "youtube",
    live: false,
  },
  {
    href: "/tiktok",
    name: "TikTok",
    icon: Music2,
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
