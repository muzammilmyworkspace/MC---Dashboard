/* ------------------------------------------------------------------ *
 *  MC Nexus — Mission Control · Mock data layer
 *  Realistic seed data. Swap for API/Prisma queries in Phase 2.
 * ------------------------------------------------------------------ */
import { julyPlans } from "./july";

export type Role = "super_admin" | "team_member" | "client";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  title: string;
  avatarColor: string;
  online?: boolean;
}

export const users: User[] = [
  {
    id: "u_muz",
    name: "Muzammil",
    email: "muzammil.myworkspace@gmail.com",
    role: "super_admin",
    title: "Marketing Lead",
    avatarColor: "#2456d6",
    online: true,
  },
  {
    id: "u_hash",
    name: "Hashaam",
    email: "hashaamzafar999@gmail.com",
    role: "team_member",
    title: "Team Member · Creative",
    avatarColor: "#475569",
    online: true,
  },
  {
    id: "u_client",
    name: "Onyema",
    email: "onyema@maincharacter.nl",
    role: "client",
    title: "Client · Reviewer",
    avatarColor: "#16a34a",
    online: false,
  },
];

export const currentUser: User = users[0];

export const roleLabel: Record<Role, string> = {
  super_admin: "Admin",
  team_member: "Team Member",
  client: "Client",
};

export function userById(id: string): User {
  return users.find((u) => u.id === id) ?? currentUser;
}

/* ------------------------------- Content -------------------------------- */

export type Platform = "instagram" | "facebook" | "linkedin" | "tiktok" | "youtube";
export type PostType = "image" | "reel" | "carousel";

export type ContentStatus =
  | "draft"
  | "internal_review"
  | "client_review"
  | "approved"
  | "scheduled"
  | "published";

export const platformMeta: Record<Platform, { label: string; color: string; emoji: string }> = {
  instagram: { label: "Instagram", color: "#2456d6", emoji: "📷" },
  facebook: { label: "Facebook", color: "#3b82f6", emoji: "📘" },
  linkedin: { label: "LinkedIn", color: "#1e40af", emoji: "💼" },
  tiktok: { label: "TikTok", color: "#0f172a", emoji: "🎵" },
  youtube: { label: "YouTube", color: "#dc2626", emoji: "📺" },
};

export const allPlatforms: Platform[] = ["instagram", "facebook", "linkedin", "tiktok", "youtube"];

export const contentStatusMeta: Record<ContentStatus, { label: string; color: string }> = {
  draft: { label: "Draft", color: "#6b7280" },
  internal_review: { label: "Internal Review", color: "#f59e0b" },
  client_review: { label: "Client Review", color: "#2456d6" },
  approved: { label: "Approved", color: "#16a34a" },
  scheduled: { label: "Scheduled", color: "#3b82f6" },
  published: { label: "Published", color: "#0f172a" },
};

export const workflow: ContentStatus[] = [
  "draft",
  "internal_review",
  "client_review",
  "approved",
  "scheduled",
  "published",
];

export type ReviewStatus = "approved" | "changes" | "rejected" | "comment";

export interface Review {
  id: string;
  author: string;
  at: string;
  status: ReviewStatus;
  comment: string;
}

/* ------------------------- Day-centric content -------------------------- */

export interface DayReel {
  topic: string;
  hook: string;
  script: string;
  bRoll: string[];
  closingCta: string;
  thumbnailConcept: string;
  editorNotes: string;
}

export interface DayPost {
  type: "image" | "carousel";
  topic: string;
  imageConcept: string;
  photographyDirection: string;
  graphicText: string;
  designerNotes: string;
  slides?: number;
}

export interface DayPlan {
  date: string; // YYYY-MM-DD
  goal: string;
  purpose: string;
  primaryPlatform: Platform;
  time: string; // HH:MM
  status: ContentStatus;
  reel: DayReel;
  post?: DayPost;
  captions: Record<Platform, string>; // per-platform caption (EN)
  captionNl: string; // Dutch for the primary platform
  hashtags: string[];
  cta: string;
  storyIdeas: string[];
  gradient: string;
  emoji: string;
  reviews: Review[];
}

export const dayPlans: DayPlan[] = julyPlans;

export function dayPlanFor(date: string): DayPlan | undefined {
  return dayPlans.find((p) => p.date === date);
}
export function datesWithContent(): Record<string, number> {
  return dayPlans.reduce<Record<string, number>>((acc, p) => {
    acc[p.date] = 1 + (p.post ? 1 : 0);
    return acc;
  }, {});
}

/* ------------------------------ Dashboard ------------------------------- */

export const kpis = [
  { id: "k1", label: "Posts Awaiting Review", value: 3, delta: 1, suffix: "", icon: "review", tone: "accent" },
  { id: "k2", label: "Scheduled This Week", value: 8, delta: 2, suffix: "", icon: "calendar", tone: "info" },
  { id: "k3", label: "Approval Rate", value: 94, delta: 6, suffix: "%", icon: "check", tone: "success" },
  { id: "k4", label: "Reach (30d)", value: 284000, delta: 18, suffix: "", icon: "reach", tone: "accent", compact: true },
] as const;

export const weeklyPerformance = [
  { day: "Mon", reach: 32, engagement: 18 },
  { day: "Tue", reach: 41, engagement: 24 },
  { day: "Wed", reach: 38, engagement: 21 },
  { day: "Thu", reach: 52, engagement: 33 },
  { day: "Fri", reach: 61, engagement: 39 },
  { day: "Sat", reach: 48, engagement: 29 },
  { day: "Sun", reach: 44, engagement: 27 },
];

export const channelSplit = [
  { name: "Instagram", value: 38, color: "#2456d6" },
  { name: "TikTok", value: 27, color: "#3b82f6" },
  { name: "LinkedIn", value: 18, color: "#60a5fa" },
  { name: "YouTube", value: 11, color: "#1e40af" },
  { name: "Facebook", value: 6, color: "#93c5fd" },
];

export const roasTrend = [
  { m: "Jan", value: 2.4 },
  { m: "Feb", value: 2.9 },
  { m: "Mar", value: 3.1 },
  { m: "Apr", value: 3.4 },
  { m: "May", value: 3.6 },
  { m: "Jun", value: 3.9 },
  { m: "Jul", value: 4.2 },
];

export interface Activity {
  id: string;
  user: string;
  action: string;
  target: string;
  at: string;
  type: "approval" | "comment" | "schedule" | "content" | "publish";
}

export const activity: Activity[] = [
  { id: "a1", user: "u_client", action: "approved", target: "Every leader needs one signature story", at: "2026-07-22T10:00:00", type: "approval" },
  { id: "a2", user: "u_hash", action: "submitted for review", target: "The 3-part framework to never go blank", at: "2026-07-21T11:05:00", type: "content" },
  { id: "a3", user: "u_client", action: "commented on", target: "The 3-part framework to never go blank", at: "2026-07-21T11:20:00", type: "comment" },
  { id: "a4", user: "u_muz", action: "requested changes on", target: "Last seats: Speaking Workshop reel", at: "2026-07-21T08:40:00", type: "comment" },
  { id: "a5", user: "u_hash", action: "scheduled", target: "Give hard feedback people thank you for", at: "2026-07-20T18:40:00", type: "schedule" },
  { id: "a6", user: "u_hash", action: "published", target: "5 speaking tips from this week", at: "2026-07-20T18:00:00", type: "publish" },
];

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  at: string;
  read: boolean;
  tone: "success" | "warning" | "danger" | "info" | "accent";
}

export const notifications: AppNotification[] = [
  { id: "n1", title: "Content approved", body: "Onyema approved the July 23 signature-story reel.", at: "2026-07-22T10:00:00", read: false, tone: "success" },
  { id: "n2", title: "New comment", body: "Onyema left a note on today's 3-part framework reel.", at: "2026-07-21T11:20:00", read: false, tone: "accent" },
  { id: "n3", title: "Changes requested", body: "Workshop 'last seats' reel needs a clearer end card.", at: "2026-07-21T08:40:00", read: false, tone: "warning" },
  { id: "n4", title: "Post scheduled", body: "Signature-story reel scheduled for Jul 23, 4:00 PM.", at: "2026-07-20T18:40:00", read: true, tone: "info" },
  { id: "n5", title: "Post published", body: "‘5 speaking tips this week’ is now live on Instagram.", at: "2026-07-20T18:00:00", read: true, tone: "success" },
];

export const upcomingMeetings = [
  { id: "mtg1", title: "Weekly content review with Onyema", time: "2026-07-22T15:00:00", attendees: ["u_muz", "u_client"] },
  { id: "mtg2", title: "Creative planning — August calendar", time: "2026-07-23T11:00:00", attendees: ["u_muz", "u_hash"] },
];

/* ------------------- Command-center platform widgets -------------------- */

export interface PlatformStat {
  label: string;
  value: string;
  delta?: string;
}
export interface PlatformWidget {
  key: string;
  name: string;
  emoji: string;
  accent: string;
  href: string;
  action: string;
  stats: PlatformStat[];
  status?: string;
}

export const platformWidgets: PlatformWidget[] = [
  {
    key: "meta-ads", name: "Meta Ads", emoji: "📣", accent: "#2456d6", href: "/meta-ads", action: "Open Meta Ads",
    status: "Active",
    stats: [
      { label: "Active campaigns", value: "4" }, { label: "Spend (30d)", value: "€8.5k", delta: "+12%" },
      { label: "Reach", value: "312k" }, { label: "CTR", value: "1.9%" },
      { label: "CPC", value: "€0.42" }, { label: "ROAS", value: "4.2x", delta: "+0.6" },
    ],
  },
  {
    key: "google-ads", name: "Google Ads", emoji: "🔎", accent: "#16a34a", href: "/google-ads", action: "Open Google Ads",
    stats: [
      { label: "Campaigns", value: "3" }, { label: "Budget", value: "€2.5k" },
      { label: "Clicks", value: "6.1k", delta: "+8%" }, { label: "CTR", value: "5.4%" },
      { label: "Conversions", value: "148" }, { label: "Quality score", value: "8.4/10" },
    ],
  },
  {
    key: "search-console", name: "Search Console", emoji: "🧭", accent: "#0ea5e9", href: "/search-console", action: "Open Search Console",
    stats: [
      { label: "Clicks (28d)", value: "9.2k", delta: "+15%" }, { label: "Impressions", value: "184k" },
      { label: "Avg. position", value: "12.4" }, { label: "Indexed pages", value: "212" },
      { label: "Coverage", value: "96%" }, { label: "Errors", value: "3" },
    ],
  },
  {
    key: "analytics", name: "Google Analytics", emoji: "📈", accent: "#f59e0b", href: "/analytics", action: "Open Analytics",
    stats: [
      { label: "Users (30d)", value: "24.8k", delta: "+18%" }, { label: "Sessions", value: "41.2k" },
      { label: "Engagement", value: "62%" }, { label: "Bounce rate", value: "38%" },
      { label: "Realtime", value: "37" }, { label: "Top source", value: "Instagram" },
    ],
  },
  {
    key: "instagram", name: "Instagram", emoji: "📷", accent: "#2456d6", href: "/instagram", action: "Open Instagram",
    stats: [
      { label: "Followers", value: "38.4k", delta: "+920" }, { label: "Reach (30d)", value: "112k" },
      { label: "Engagement", value: "4.9%" }, { label: "Scheduled", value: "9" },
      { label: "Messages", value: "24" }, { label: "Latest reel", value: "3-part framework" },
    ],
  },
  {
    key: "facebook", name: "Facebook", emoji: "📘", accent: "#3b82f6", href: "/facebook", action: "Open Facebook",
    stats: [
      { label: "Followers", value: "12.1k" }, { label: "Reach (30d)", value: "48k", delta: "+6%" },
      { label: "Scheduled", value: "7" }, { label: "Messages", value: "11" },
    ],
  },
  {
    key: "linkedin", name: "LinkedIn", emoji: "💼", accent: "#1e40af", href: "/linkedin", action: "Open LinkedIn",
    stats: [
      { label: "Followers", value: "9.4k", delta: "+310" }, { label: "Post views (7d)", value: "22k" },
      { label: "Scheduled", value: "5" }, { label: "Profile views", value: "1.3k" },
    ],
  },
  {
    key: "tiktok", name: "TikTok", emoji: "🎵", accent: "#0f172a", href: "/tiktok", action: "Open TikTok",
    stats: [
      { label: "Followers", value: "27.1k", delta: "+1.4k" }, { label: "Views (30d)", value: "540k" },
      { label: "Engagement", value: "7.2%" }, { label: "Latest reel", value: "Pause power" },
    ],
  },
  {
    key: "youtube", name: "YouTube", emoji: "📺", accent: "#dc2626", href: "/youtube", action: "Open YouTube",
    stats: [
      { label: "Subscribers", value: "6.2k", delta: "+180" }, { label: "Views (30d)", value: "88k" },
      { label: "Watch time", value: "3.1k h" }, { label: "Latest upload", value: "Signature story" },
    ],
  },
];

export interface ApiConnection {
  name: string;
  connected: boolean;
  lastSync: string;
  health: "healthy" | "degraded" | "down" | "—";
}

export const apiConnections: ApiConnection[] = [
  { name: "Meta API", connected: true, lastSync: "2 min ago", health: "healthy" },
  { name: "Google Ads API", connected: true, lastSync: "5 min ago", health: "healthy" },
  { name: "Google Analytics API", connected: true, lastSync: "8 min ago", health: "healthy" },
  { name: "Search Console API", connected: true, lastSync: "1 h ago", health: "degraded" },
  { name: "Instagram API", connected: true, lastSync: "3 min ago", health: "healthy" },
  { name: "Facebook API", connected: true, lastSync: "3 min ago", health: "healthy" },
  { name: "LinkedIn API", connected: false, lastSync: "Never", health: "—" },
  { name: "TikTok API", connected: false, lastSync: "Never", health: "—" },
  { name: "YouTube API", connected: true, lastSync: "12 min ago", health: "healthy" },
  { name: "Google Workspace API", connected: true, lastSync: "20 min ago", health: "healthy" },
];
