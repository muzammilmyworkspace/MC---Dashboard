/* ------------------------------------------------------------------ *
 *  NEXUS HQ — Mock data layer
 *  Realistic seed data. Swap for API/Prisma queries in Phase 2.
 * ------------------------------------------------------------------ */

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

export const currentUser: User = {
  id: "u_muz",
  name: "Muzammil Khan",
  email: "muzammil@nexus.hq",
  role: "super_admin",
  title: "Founder · Growth Lead",
  avatarColor: "#8b5cf6",
  online: true,
};

export const users: User[] = [
  currentUser,
  {
    id: "u_hash",
    name: "Hashaam Ali",
    email: "hashaam@nexus.hq",
    role: "team_member",
    title: "Creative & Community",
    avatarColor: "#3b82f6",
    online: true,
  },
  {
    id: "u_client",
    name: "Elena Foster",
    email: "elena@brightwave.co",
    role: "client",
    title: "Brightwave Co · Client",
    avatarColor: "#10b981",
    online: false,
  },
];

export const roleLabel: Record<Role, string> = {
  super_admin: "Super Admin",
  team_member: "Team Member",
  client: "Client",
};

/* -------------------------------- Tasks --------------------------------- */

export type TaskStatus =
  | "pending"
  | "working"
  | "review"
  | "client_review"
  | "approved"
  | "completed"
  | "blocked";

export type Priority = "low" | "medium" | "high" | "critical";

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  assignee: string; // user id
  createdBy: string;
  deadline: string;
  progress: number;
  labels: string[];
  checklist: ChecklistItem[];
  comments: number;
  attachments: number;
  estimatedHours: number;
  actualHours: number;
}

export const statusMeta: Record<TaskStatus, { label: string; color: string; dot: string }> = {
  pending: { label: "Pending", color: "text-muted-foreground", dot: "#64748b" },
  working: { label: "Working", color: "text-info", dot: "#3b82f6" },
  review: { label: "In Review", color: "text-warning", dot: "#f59e0b" },
  client_review: { label: "Client Review", color: "text-accent", dot: "#8b5cf6" },
  approved: { label: "Approved", color: "text-success", dot: "#10b981" },
  completed: { label: "Completed", color: "text-success", dot: "#22c55e" },
  blocked: { label: "Blocked", color: "text-danger", dot: "#ef4444" },
};

export const priorityMeta: Record<Priority, { label: string; color: string; bg: string }> = {
  low: { label: "Low", color: "#64748b", bg: "rgba(100,116,139,0.14)" },
  medium: { label: "Medium", color: "#3b82f6", bg: "rgba(59,130,246,0.14)" },
  high: { label: "High", color: "#f59e0b", bg: "rgba(245,158,11,0.16)" },
  critical: { label: "Critical", color: "#ef4444", bg: "rgba(239,68,68,0.16)" },
};

export const tasks: Task[] = [
  {
    id: "t1",
    title: "Meta Ads — Q3 retargeting campaign launch",
    description:
      "Build and launch the retargeting funnel for warm audiences. 3 ad sets, 6 creatives, ROAS target 4.2x.",
    status: "working",
    priority: "critical",
    assignee: "u_muz",
    createdBy: "u_muz",
    deadline: "2026-07-24",
    progress: 62,
    labels: ["Meta Ads", "Paid"],
    checklist: [
      { id: "c1", label: "Audience research", done: true },
      { id: "c2", label: "Creative briefs", done: true },
      { id: "c3", label: "Pixel + conversion check", done: true },
      { id: "c4", label: "Launch ad sets", done: false },
      { id: "c5", label: "Set up reporting", done: false },
    ],
    comments: 8,
    attachments: 4,
    estimatedHours: 12,
    actualHours: 7.5,
  },
  {
    id: "t2",
    title: "Reels edit — 'Founder Story' series (3 videos)",
    description: "Cut 3 vertical reels from the podcast raw footage. Captions + trending audio.",
    status: "client_review",
    priority: "high",
    assignee: "u_hash",
    createdBy: "u_muz",
    deadline: "2026-07-22",
    progress: 90,
    labels: ["Reels", "Content"],
    checklist: [
      { id: "c1", label: "Rough cut", done: true },
      { id: "c2", label: "Color + captions", done: true },
      { id: "c3", label: "Client approval", done: false },
    ],
    comments: 12,
    attachments: 6,
    estimatedHours: 9,
    actualHours: 8,
  },
  {
    id: "t3",
    title: "Website — landing page speed optimization",
    description: "Improve LCP under 2s. Compress hero, lazy-load, defer non-critical JS.",
    status: "review",
    priority: "medium",
    assignee: "u_muz",
    createdBy: "u_muz",
    deadline: "2026-07-28",
    progress: 45,
    labels: ["Website", "SEO"],
    checklist: [
      { id: "c1", label: "Audit with Lighthouse", done: true },
      { id: "c2", label: "Optimize images", done: false },
      { id: "c3", label: "Defer scripts", done: false },
    ],
    comments: 3,
    attachments: 2,
    estimatedHours: 6,
    actualHours: 2.5,
  },
  {
    id: "t4",
    title: "Community — reply to weekend DMs & comments",
    description: "Clear the inbox backlog across IG + TikTok. Flag any leads for the sales sheet.",
    status: "completed",
    priority: "medium",
    assignee: "u_hash",
    createdBy: "u_muz",
    deadline: "2026-07-20",
    progress: 100,
    labels: ["Community", "Inbox"],
    checklist: [
      { id: "c1", label: "Instagram DMs", done: true },
      { id: "c2", label: "TikTok comments", done: true },
      { id: "c3", label: "Log leads", done: true },
    ],
    comments: 2,
    attachments: 0,
    estimatedHours: 3,
    actualHours: 2.5,
  },
  {
    id: "t5",
    title: "Thumbnail design — YouTube 'Scaling to 7-figures'",
    description: "3 concepts, A/B ready. High contrast, bold face crop, curiosity gap.",
    status: "pending",
    priority: "high",
    assignee: "u_hash",
    createdBy: "u_muz",
    deadline: "2026-07-25",
    progress: 0,
    labels: ["Thumbnail", "YouTube"],
    checklist: [
      { id: "c1", label: "Moodboard", done: false },
      { id: "c2", label: "3 concepts", done: false },
    ],
    comments: 1,
    attachments: 1,
    estimatedHours: 4,
    actualHours: 0,
  },
  {
    id: "t6",
    title: "Google Ads — search campaign keyword cleanup",
    description: "Prune low-intent keywords, add negatives, restructure ad groups by intent.",
    status: "blocked",
    priority: "high",
    assignee: "u_muz",
    createdBy: "u_muz",
    deadline: "2026-07-26",
    progress: 20,
    labels: ["Google Ads", "Paid"],
    checklist: [
      { id: "c1", label: "Export search terms", done: true },
      { id: "c2", label: "Waiting on client budget sign-off", done: false },
    ],
    comments: 5,
    attachments: 1,
    estimatedHours: 5,
    actualHours: 1,
  },
  {
    id: "t7",
    title: "Monthly performance report — June",
    description: "Compile cross-channel report. Highlights, wins, next-month plan.",
    status: "approved",
    priority: "low",
    assignee: "u_muz",
    createdBy: "u_muz",
    deadline: "2026-07-19",
    progress: 100,
    labels: ["Reporting"],
    checklist: [{ id: "c1", label: "Compile", done: true }],
    comments: 4,
    attachments: 1,
    estimatedHours: 4,
    actualHours: 3.5,
  },
  {
    id: "t8",
    title: "Story series — product launch countdown (5 frames)",
    description: "Animated countdown stories, brand kit colors, swipe-up to waitlist.",
    status: "working",
    priority: "medium",
    assignee: "u_hash",
    createdBy: "u_muz",
    deadline: "2026-07-23",
    progress: 40,
    labels: ["Stories", "Design"],
    checklist: [
      { id: "c1", label: "Frame templates", done: true },
      { id: "c2", label: "Animate", done: false },
    ],
    comments: 0,
    attachments: 3,
    estimatedHours: 4,
    actualHours: 1.5,
  },
];

/* --------------------------- Content Approval --------------------------- */

export type ContentStatus =
  | "draft"
  | "internal_review"
  | "client_review"
  | "approved"
  | "rejected"
  | "scheduled"
  | "published";

export type Platform =
  | "instagram"
  | "facebook"
  | "linkedin"
  | "tiktok"
  | "youtube";

export interface ContentComment {
  id: string;
  author: string;
  text: string;
  at: string;
}

export interface ContentItem {
  id: string;
  title: string;
  platform: Platform;
  status: ContentStatus;
  caption: string;
  hashtags: string[];
  creator: string;
  reviewer: string;
  publishAt: string;
  gradient: string;
  emoji: string;
  revision: number;
  comments: ContentComment[];
}

export const platformMeta: Record<Platform, { label: string; color: string; emoji: string }> = {
  instagram: { label: "Instagram", color: "#E1306C", emoji: "📷" },
  facebook: { label: "Facebook", color: "#1877F2", emoji: "📘" },
  linkedin: { label: "LinkedIn", color: "#0A66C2", emoji: "💼" },
  tiktok: { label: "TikTok", color: "#000000", emoji: "🎵" },
  youtube: { label: "YouTube", color: "#FF0000", emoji: "📺" },
};

export const contentStatusMeta: Record<ContentStatus, { label: string; color: string }> = {
  draft: { label: "Draft", color: "#64748b" },
  internal_review: { label: "Internal Review", color: "#f59e0b" },
  client_review: { label: "Client Review", color: "#8b5cf6" },
  approved: { label: "Approved", color: "#10b981" },
  rejected: { label: "Changes Requested", color: "#ef4444" },
  scheduled: { label: "Scheduled", color: "#3b82f6" },
  published: { label: "Published", color: "#22c55e" },
};

export const contentItems: ContentItem[] = [
  {
    id: "cx1",
    title: "Carousel — 5 growth mistakes killing your reach",
    platform: "instagram",
    status: "client_review",
    caption:
      "The 5 mistakes silently killing your reach in 2026 👇 Save this before your next post. Which one are you guilty of?",
    hashtags: ["#growth", "#socialmedia", "#marketingtips", "#creatoreconomy"],
    creator: "u_hash",
    reviewer: "u_muz",
    publishAt: "2026-07-23T14:00:00",
    gradient: "linear-gradient(135deg,#f472b6,#8b5cf6)",
    emoji: "🎠",
    revision: 2,
    comments: [
      { id: "m1", author: "u_muz", text: "Slide 3 hook is 🔥 — ship it.", at: "2026-07-21T09:10:00" },
      { id: "m2", author: "u_client", text: "Can we soften the CTA color? Feels loud.", at: "2026-07-21T10:02:00" },
    ],
  },
  {
    id: "cx2",
    title: "Reel — Founder story part 1",
    platform: "tiktok",
    status: "client_review",
    caption: "From 0 to 100k in 8 months. Here's what nobody tells you about going viral 🚀",
    hashtags: ["#founder", "#startup", "#viral", "#buildinpublic"],
    creator: "u_hash",
    reviewer: "u_muz",
    publishAt: "2026-07-22T18:30:00",
    gradient: "linear-gradient(135deg,#22d3ee,#3b82f6)",
    emoji: "🎬",
    revision: 1,
    comments: [
      { id: "m1", author: "u_muz", text: "Captions synced perfectly. Approve when ready.", at: "2026-07-21T08:40:00" },
    ],
  },
  {
    id: "cx3",
    title: "LinkedIn — Thought leadership post on AEO",
    platform: "linkedin",
    status: "internal_review",
    caption:
      "SEO is evolving into AEO — Answer Engine Optimization. If your brand isn't cited by AI assistants, you're invisible. Here's how we're adapting client strategies…",
    hashtags: ["#AEO", "#SEO", "#AI", "#B2Bmarketing"],
    creator: "u_muz",
    reviewer: "u_muz",
    publishAt: "2026-07-24T12:00:00",
    gradient: "linear-gradient(135deg,#0a66c2,#22d3ee)",
    emoji: "💡",
    revision: 1,
    comments: [],
  },
  {
    id: "cx4",
    title: "YouTube thumbnail — Scaling to 7 figures",
    platform: "youtube",
    status: "approved",
    caption: "The exact system we used to scale a DTC brand to 7 figures in 11 months.",
    hashtags: ["#youtube", "#business", "#scaling"],
    creator: "u_hash",
    reviewer: "u_muz",
    publishAt: "2026-07-25T16:00:00",
    gradient: "linear-gradient(135deg,#f59e0b,#ef4444)",
    emoji: "🎯",
    revision: 3,
    comments: [
      { id: "m1", author: "u_client", text: "Love the contrast. Approved! ✅", at: "2026-07-20T15:20:00" },
    ],
  },
  {
    id: "cx5",
    title: "Story set — Product launch countdown",
    platform: "instagram",
    status: "scheduled",
    caption: "48 hours. ⏳ The wait is almost over. Tap to join the waitlist.",
    hashtags: ["#launch", "#comingsoon"],
    creator: "u_hash",
    reviewer: "u_muz",
    publishAt: "2026-07-23T09:00:00",
    gradient: "linear-gradient(135deg,#a78bfa,#6366f1)",
    emoji: "⏳",
    revision: 1,
    comments: [],
  },
  {
    id: "cx6",
    title: "Facebook — Testimonial spotlight",
    platform: "facebook",
    status: "published",
    caption: "\"They 3x'd our leads in one quarter.\" — real results from real partners. 💬",
    hashtags: ["#testimonial", "#results", "#casestudy"],
    creator: "u_muz",
    reviewer: "u_muz",
    publishAt: "2026-07-18T11:00:00",
    gradient: "linear-gradient(135deg,#1877f2,#8b5cf6)",
    emoji: "⭐",
    revision: 1,
    comments: [
      { id: "m1", author: "u_client", text: "This performed amazingly — 4.1% engagement!", at: "2026-07-19T13:00:00" },
    ],
  },
];

/* ------------------------------ Dashboard ------------------------------- */

export const kpis = [
  { id: "k1", label: "Tasks Due Today", value: 6, delta: -2, suffix: "", icon: "check", tone: "accent" },
  { id: "k2", label: "Pending Approvals", value: 3, delta: 1, suffix: "", icon: "clock", tone: "warning" },
  { id: "k3", label: "Campaign ROAS", value: 4.2, delta: 0.6, suffix: "x", icon: "trending", tone: "success" },
  { id: "k4", label: "Reach (30d)", value: 284000, delta: 18, suffix: "", icon: "eye", tone: "info", compact: true },
] as const;

export const weeklyPerformance = [
  { day: "Mon", reach: 32, engagement: 18, spend: 12 },
  { day: "Tue", reach: 41, engagement: 24, spend: 14 },
  { day: "Wed", reach: 38, engagement: 21, spend: 13 },
  { day: "Thu", reach: 52, engagement: 33, spend: 16 },
  { day: "Fri", reach: 61, engagement: 39, spend: 18 },
  { day: "Sat", reach: 48, engagement: 29, spend: 11 },
  { day: "Sun", reach: 44, engagement: 27, spend: 10 },
];

export const channelSplit = [
  { name: "Instagram", value: 38, color: "#e1306c" },
  { name: "TikTok", value: 27, color: "#22d3ee" },
  { name: "LinkedIn", value: 18, color: "#0a66c2" },
  { name: "YouTube", value: 11, color: "#ef4444" },
  { name: "Facebook", value: 6, color: "#1877f2" },
];

export const roasTrend = [
  { m: "Jan", roas: 2.4 },
  { m: "Feb", roas: 2.9 },
  { m: "Mar", roas: 3.1 },
  { m: "Apr", roas: 3.0 },
  { m: "May", roas: 3.6 },
  { m: "Jun", roas: 3.9 },
  { m: "Jul", roas: 4.2 },
];

export const campaignHealth = [
  { name: "Meta — Retargeting Q3", status: "healthy", roas: 4.8, spend: 3200, budget: 5000 },
  { name: "Google — Brand Search", status: "healthy", roas: 6.1, spend: 1800, budget: 2500 },
  { name: "Meta — Prospecting", status: "watch", roas: 2.1, spend: 2400, budget: 3000 },
  { name: "TikTok — Awareness", status: "risk", roas: 1.3, spend: 900, budget: 1200 },
];

export interface Activity {
  id: string;
  user: string;
  action: string;
  target: string;
  at: string;
  type: "approval" | "task" | "comment" | "campaign" | "content";
}

export const activity: Activity[] = [
  { id: "a1", user: "u_client", action: "approved", target: "YouTube thumbnail — Scaling to 7 figures", at: "2026-07-21T15:20:00", type: "approval" },
  { id: "a2", user: "u_hash", action: "submitted for review", target: "Reel — Founder story part 1", at: "2026-07-21T11:05:00", type: "content" },
  { id: "a3", user: "u_muz", action: "launched", target: "Meta — Retargeting Q3", at: "2026-07-21T09:30:00", type: "campaign" },
  { id: "a4", user: "u_client", action: "commented on", target: "Carousel — 5 growth mistakes", at: "2026-07-21T10:02:00", type: "comment" },
  { id: "a5", user: "u_hash", action: "completed", target: "Community — weekend DMs & comments", at: "2026-07-20T18:40:00", type: "task" },
  { id: "a6", user: "u_muz", action: "created", target: "Thumbnail design — YouTube", at: "2026-07-20T14:15:00", type: "task" },
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
  { id: "n1", title: "Content approved", body: "Elena approved the YouTube thumbnail.", at: "2026-07-21T15:20:00", read: false, tone: "success" },
  { id: "n2", title: "New comment", body: "Elena requested a change on the growth carousel.", at: "2026-07-21T10:02:00", read: false, tone: "accent" },
  { id: "n3", title: "Deadline approaching", body: "Reel edits due tomorrow at 6:30 PM.", at: "2026-07-21T08:00:00", read: false, tone: "warning" },
  { id: "n4", title: "Campaign live", body: "Meta Retargeting Q3 is now spending.", at: "2026-07-21T09:30:00", read: true, tone: "info" },
  { id: "n5", title: "Task blocked", body: "Google Ads cleanup blocked on budget sign-off.", at: "2026-07-20T17:00:00", read: true, tone: "danger" },
];

export const upcomingMeetings = [
  { id: "mtg1", title: "Weekly client sync — Brightwave", time: "2026-07-22T15:00:00", attendees: ["u_muz", "u_client"] },
  { id: "mtg2", title: "Content planning — August", time: "2026-07-23T11:00:00", attendees: ["u_muz", "u_hash"] },
];

export function userById(id: string): User {
  return users.find((u) => u.id === id) ?? currentUser;
}
