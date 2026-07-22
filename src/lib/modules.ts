/* Per-module metadata for the module shells (breadth-first pages). */

export interface ModuleInfo {
  subtitle: string;
  category: "integration" | "internal";
  phase: "building" | "phase2";
  provider?: string;
  connected?: boolean;
  features?: string[];
  stats?: { label: string; value: string }[];
  description?: string; // for coming-soon pages
}

export const moduleInfo: Record<string, ModuleInfo> = {
  /* ---------------- Muzammil Tasks (building) ---------------- */
  "/google-ads": {
    subtitle: "Search campaigns, keywords, budget pacing, clicks and conversions.",
    category: "integration", phase: "building", provider: "Google Ads API", connected: false,
    features: ["Campaign performance", "Keyword & negative management", "Budget pacing", "Conversion tracking"],
    stats: [{ label: "Clicks (30d)", value: "6.1k" }, { label: "CTR", value: "5.4%" }, { label: "CPA", value: "$18" }],
  },
  "/meta-ads": {
    subtitle: "Campaigns, ad sets, spend, ROAS, CTR and top creatives from Meta.",
    category: "integration", phase: "building", provider: "Meta Graph API", connected: false,
    features: ["Campaign → Ad Set → Ad tree", "Spend, ROAS, CPC, CPM, CTR", "Top creatives", "Conversions & frequency"],
    stats: [{ label: "Spend (30d)", value: "$8.5k" }, { label: "Blended ROAS", value: "4.2x" }, { label: "Conversions", value: "412" }],
  },
  "/analytics": {
    subtitle: "Sessions, users, engagement, conversions and revenue from GA4.",
    category: "integration", phase: "building", provider: "Google Analytics Data API (GA4)", connected: false,
    features: ["Sessions & users", "Traffic sources", "Top pages", "Live visitors & conversions"],
    stats: [{ label: "Sessions", value: "48.2k" }, { label: "Engagement", value: "62%" }, { label: "Conversions", value: "1.1k" }],
  },
  "/search-console": {
    subtitle: "Impressions, clicks, average position and top queries.",
    category: "integration", phase: "building", provider: "Google Search Console API", connected: false,
    features: ["Query performance", "Page-level data", "Avg. position tracking", "Index coverage"],
  },
  "/landing-pages": {
    subtitle: "Build, preview and track your campaign landing pages.",
    category: "internal", phase: "building",
    features: ["Page library", "Conversion tracking", "A/B variants", "Core Web Vitals"],
  },
  "/website": {
    subtitle: "Uptime, Core Web Vitals, pages and SEO health for the main site.",
    category: "internal", phase: "building",
    features: ["Core Web Vitals", "Uptime monitoring", "Page inventory", "SEO / AEO checklist"],
  },
  "/automation": {
    subtitle: "Workflows that connect your tools and automate the busywork.",
    category: "internal", phase: "building",
    features: ["Trigger → action flows", "Scheduled jobs", "Cross-tool sync", "Run history"],
  },
  "/workspace": {
    subtitle: "Users, aliases, storage and subscription for Google Workspace.",
    category: "integration", phase: "building", provider: "Google Workspace Admin SDK", connected: false,
    features: ["Users & aliases", "Storage usage", "Recent logins", "Subscription info"],
  },
  "/instagram": {
    subtitle: "Upcoming posts, grid preview, drafts, ideas and analytics.",
    category: "integration", phase: "building", provider: "Meta Graph API", connected: false,
    features: ["Content calendar", "Grid preview", "Story & Reels planner", "Engagement analytics"],
    stats: [{ label: "Followers", value: "38.4k" }, { label: "Eng. rate", value: "4.9%" }, { label: "Reach (30d)", value: "112k" }],
  },
  "/facebook": {
    subtitle: "Page posts, reach, engagement and audience insights.",
    category: "integration", phase: "building", provider: "Meta Graph API", connected: false,
    features: ["Post scheduling", "Reach & engagement", "Audience insights", "Boosted posts"],
  },
  "/linkedin": {
    subtitle: "Company page posts, impressions and follower demographics.",
    category: "integration", phase: "building", provider: "LinkedIn API", connected: false,
    features: ["Post scheduling", "Impressions & CTR", "Follower demographics", "Thought-leadership series"],
  },
  "/tiktok": {
    subtitle: "Video performance, trends, drafts and posting schedule.",
    category: "integration", phase: "building", provider: "TikTok Business API", connected: false,
    features: ["Video analytics", "Trending sounds", "Posting schedule", "Follower growth"],
    stats: [{ label: "Followers", value: "27.1k" }, { label: "Avg. views", value: "18k" }, { label: "Shares", value: "2.4k" }],
  },
  "/youtube": {
    subtitle: "Views, watch time, subscribers and thumbnail A/B tests.",
    category: "integration", phase: "building", provider: "YouTube Data API", connected: false,
    features: ["Views & watch time", "Subscriber growth", "Thumbnail A/B", "Top videos"],
  },

  /* ---------------- Hashaam Tasks (building) ---------------- */
  "/community": {
    subtitle: "Comments, DMs and mentions across every platform in one inbox.",
    category: "internal", phase: "building",
    features: ["Unified inbox", "Comment & DM replies", "Lead flagging", "Response templates"],
    stats: [{ label: "Unread", value: "24" }, { label: "Avg. reply", value: "12m" }, { label: "Leads", value: "7" }],
  },
  "/huddles": {
    subtitle: "Plan and track community huddles, hosts and attendance.",
    category: "internal", phase: "building",
    features: ["Huddle schedule", "Host assignments", "Attendance", "Recaps"],
  },
  "/gold-calls": {
    subtitle: "Book, prep and follow up on Gold Calls with clients.",
    category: "internal", phase: "building",
    features: ["Call calendar", "Prep notes", "Outcomes", "Follow-ups"],
  },
  "/video-editing": {
    subtitle: "Long-form edits — briefs, versions and delivery.",
    category: "internal", phase: "building",
    features: ["Edit briefs", "Version history", "Review & approve", "Delivery"],
  },
  "/reels": {
    subtitle: "Short-form reels pipeline — from raw footage to publish.",
    category: "internal", phase: "building",
    features: ["Footage library", "Cut list", "Captions & audio", "Publish queue"],
    stats: [{ label: "In edit", value: "5" }, { label: "Ready", value: "3" }, { label: "Published (wk)", value: "6" }],
  },
  "/workbooks": {
    subtitle: "Design and manage client workbooks and printables.",
    category: "internal", phase: "building",
    features: ["Template library", "Brand kit", "Versioning", "Export to PDF"],
  },
  "/thumbnails": {
    subtitle: "Thumbnail concepts, A/B options and approvals.",
    category: "internal", phase: "building",
    features: ["Concept board", "A/B variants", "Approval flow", "Asset export"],
  },
};

/* ---------------- Phase 2 · Coming Soon ---------------- */
const phase2: Record<string, { subtitle: string; description: string }> = {
  "/crm": { subtitle: "Contacts, companies and every touchpoint in one place.", description: "A full CRM to manage relationships, deals and history — built natively into your workspace." },
  "/leads": { subtitle: "Track leads from first touch to closed.", description: "A visual pipeline with stages, values and automated follow-ups so no opportunity slips." },
  "/invoices": { subtitle: "Create, send and track invoices.", description: "Branded invoices, payment status and reminders — connected to your finances." },
  "/finance": { subtitle: "Revenue, expenses and profitability at a glance.", description: "A clear financial picture of the agency with budgets, cash flow and forecasts." },
  "/ai-assistant": { subtitle: "Your always-on marketing co-pilot.", description: "Draft captions, brainstorm hooks and answer questions across your workspace data." },
  "/meeting-notes": { subtitle: "Capture and share meeting notes.", description: "Structured notes, action items and recaps that sync to the right project automatically." },
  "/knowledge-base": { subtitle: "SOPs, playbooks and brand guidelines.", description: "A searchable home for how the team works — onboarding and reference in one place." },
  "/analytics-hub": { subtitle: "Every channel's numbers, unified.", description: "A cross-platform analytics hub blending social, ads and web into one report." },
  "/automation-center": { subtitle: "Advanced automations and recipes.", description: "Powerful multi-step automations across all connected tools and channels." },
  "/reports": { subtitle: "Beautiful client-ready reports.", description: "Auto-generated, on-brand performance reports you can schedule and share." },
  "/client-portal": { subtitle: "A dedicated space for each client.", description: "A branded portal where clients review, approve and track their work." },
  "/vault": { subtitle: "AES-256 encrypted password vault.", description: "Securely store and share credentials with permissioned access and audit logs." },
  "/integrations": { subtitle: "Connect the rest of your stack.", description: "One place to manage every API connection, sync status and connection health." },
  "/user-management": { subtitle: "Roles, permissions and access control.", description: "Fine-grained RBAC, team invites and advanced permission management." },
};

for (const [href, v] of Object.entries(phase2)) {
  moduleInfo[href] = { subtitle: v.subtitle, description: v.description, category: "internal", phase: "phase2" };
}

export const defaultModuleInfo: ModuleInfo = {
  subtitle: "This module is part of MC Nexus Mission Control.",
  category: "internal",
  phase: "building",
  features: ["Premium UI", "Real-time updates", "Role-based access"],
};
