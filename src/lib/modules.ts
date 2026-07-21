/* Per-module metadata for the module shells (breadth-first pages). */

export interface ModuleInfo {
  subtitle: string;
  category: "integration" | "internal";
  provider?: string;
  connected?: boolean;
  lastSync?: string;
  features: string[];
  stats?: { label: string; value: string }[];
}

export const moduleInfo: Record<string, ModuleInfo> = {
  "/calendar": {
    subtitle: "Plan, schedule and drag content across month, week and day views.",
    category: "internal",
    features: ["Month / Week / Day views", "Drag & drop scheduling", "Color-coded channels", "Export to iCal"],
    stats: [{ label: "Scheduled", value: "14" }, { label: "This week", value: "6" }, { label: "Drafts", value: "3" }],
  },
  "/projects": {
    subtitle: "Group tasks and content into client projects with milestones.",
    category: "internal",
    features: ["Milestone tracking", "Per-client workspaces", "Gantt timeline", "Budget & retainer hours"],
    stats: [{ label: "Active", value: "5" }, { label: "On track", value: "4" }, { label: "At risk", value: "1" }],
  },
  "/studio": {
    subtitle: "Draft hooks, headlines, captions and CTAs with brand voice presets.",
    category: "internal",
    features: ["Hook & headline library", "Caption composer", "Brand voice presets", "AI assist (Phase 2)"],
  },
  "/meta-ads": {
    subtitle: "Campaigns, ad sets, spend, ROAS, CTR and top creatives from Meta.",
    category: "integration",
    provider: "Meta Graph API",
    connected: false,
    features: ["Campaign → Ad Set → Ad tree", "Spend, ROAS, CPC, CPM, CTR", "Top creatives", "Frequency & conversions"],
    stats: [{ label: "Spend (30d)", value: "$8.5k" }, { label: "Blended ROAS", value: "4.2x" }, { label: "Conversions", value: "412" }],
  },
  "/google-ads": {
    subtitle: "Search campaigns, keywords, budget pacing, clicks and conversions.",
    category: "integration",
    provider: "Google Ads API",
    connected: false,
    features: ["Campaign performance", "Keyword & negative management", "Budget pacing", "Conversion tracking"],
    stats: [{ label: "Clicks (30d)", value: "6.1k" }, { label: "CTR", value: "5.4%" }, { label: "CPA", value: "$18" }],
  },
  "/analytics": {
    subtitle: "Sessions, users, engagement, conversions and revenue from GA4.",
    category: "integration",
    provider: "Google Analytics Data API (GA4)",
    connected: false,
    features: ["Sessions & users", "Traffic sources", "Top pages", "Live visitors & conversions"],
    stats: [{ label: "Sessions", value: "48.2k" }, { label: "Engagement", value: "62%" }, { label: "Revenue", value: "$21k" }],
  },
  "/search-console": {
    subtitle: "Impressions, clicks, average position and top queries.",
    category: "integration",
    provider: "Google Search Console API",
    connected: false,
    features: ["Query performance", "Page-level data", "Avg. position tracking", "Index coverage"],
  },
  "/website": {
    subtitle: "Uptime, Core Web Vitals, landing pages and SEO health.",
    category: "internal",
    features: ["Core Web Vitals", "Uptime monitoring", "Landing page library", "SEO / AEO / GEO checklist"],
  },
  "/instagram": {
    subtitle: "Upcoming posts, published grid, drafts, ideas and analytics.",
    category: "integration",
    provider: "Meta Graph API",
    connected: false,
    features: ["Content calendar", "Grid preview", "Story & Reels planner", "Engagement analytics"],
    stats: [{ label: "Followers", value: "38.4k" }, { label: "Eng. rate", value: "4.9%" }, { label: "Reach (30d)", value: "112k" }],
  },
  "/tiktok": {
    subtitle: "Video performance, trends, drafts and posting schedule.",
    category: "integration",
    provider: "TikTok Business API",
    connected: false,
    features: ["Video analytics", "Trending sounds", "Posting schedule", "Follower growth"],
    stats: [{ label: "Followers", value: "27.1k" }, { label: "Avg. views", value: "18k" }, { label: "Shares", value: "2.4k" }],
  },
  "/youtube": {
    subtitle: "Views, watch time, subscribers and thumbnail A/B tests.",
    category: "integration",
    provider: "YouTube Data API",
    connected: false,
    features: ["Views & watch time", "Subscriber growth", "Thumbnail A/B", "Top videos"],
  },
  "/linkedin": {
    subtitle: "Company page posts, impressions and follower demographics.",
    category: "integration",
    provider: "LinkedIn API",
    connected: false,
    features: ["Post scheduling", "Impressions & CTR", "Follower demographics", "Thought-leadership series"],
  },
  "/facebook": {
    subtitle: "Page posts, reach, engagement and audience insights.",
    category: "integration",
    provider: "Meta Graph API",
    connected: false,
    features: ["Page post scheduling", "Reach & engagement", "Audience insights", "Boosted posts"],
  },
  "/vault": {
    subtitle: "AES-256 encrypted credentials with permissioned access & audit logs.",
    category: "internal",
    features: ["AES-256 encryption", "Categories & tags", "Reveal / copy with audit log", "Expiration alerts"],
    stats: [{ label: "Credentials", value: "42" }, { label: "Categories", value: "11" }, { label: "Expiring", value: "3" }],
  },
  "/workspace": {
    subtitle: "Users, aliases, storage and subscription for Google Workspace.",
    category: "integration",
    provider: "Google Workspace Admin SDK",
    connected: false,
    features: ["Users & aliases", "Storage usage", "Recent logins", "Migration checklist"],
  },
  "/assets": {
    subtitle: "Central brand asset library — logos, fonts, images and video.",
    category: "internal",
    features: ["Folders & tags", "Version history", "Preview & download", "Cloudinary-backed"],
    stats: [{ label: "Assets", value: "318" }, { label: "Storage", value: "6.2 GB" }, { label: "Folders", value: "24" }],
  },
  "/files": {
    subtitle: "Documents, PDFs and deliverables with version history.",
    category: "internal",
    features: ["Folder tree", "Version history", "Inline preview", "Search & tags"],
  },
  "/notes": {
    subtitle: "Meeting notes, briefs and SOPs with rich formatting.",
    category: "internal",
    features: ["Rich text editor", "Templates & SOPs", "Pin & share", "Backlinks"],
  },
  "/chat": {
    subtitle: "Real-time team chat with mentions, threads and read receipts.",
    category: "internal",
    features: ["Real-time (Socket.io)", "Mentions & threads", "File attachments", "Read receipts"],
  },
  "/notifications": {
    subtitle: "Every approval, deadline, comment and campaign event in one feed.",
    category: "internal",
    features: ["Grouped by type", "Mark read / snooze", "Email & push (Phase 2)", "Per-module filters"],
  },
  "/team": {
    subtitle: "Members, roles, permissions and productivity scores.",
    category: "internal",
    features: ["Role-based access (RBAC)", "Productivity scores", "Assigned vs completed", "Activity log"],
  },
  "/settings": {
    subtitle: "Workspace, roles, themes, security, backups and integrations.",
    category: "internal",
    features: ["Workspace & branding", "Roles & permissions", "Theme (dark / light / system)", "Security & backups"],
  },
};

export const defaultModuleInfo: ModuleInfo = {
  subtitle: "This module is part of NEXUS HQ.",
  category: "internal",
  features: ["Premium UI", "Real-time updates", "Role-based access"],
};
