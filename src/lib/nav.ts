import {
  Home,
  CalendarDays,
  BarChart3,
  Megaphone,
  LineChart,
  Search,
  LayoutTemplate,
  Globe,
  Workflow,
  Mail,
  Camera,
  Contact,
  Briefcase,
  Music2,
  MonitorPlay,
  MessagesSquare,
  Users,
  PhoneCall,
  Clapperboard,
  Video,
  BookOpen,
  Image,
  FileText,
  Wallet,
  Bot,
  NotebookPen,
  PieChart,
  FileBarChart,
  PanelsTopLeft,
  KeyRound,
  Plug,
  UserCog,
  Filter,
  type LucideIcon,
} from "lucide-react";
import { type Role } from "./data";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
}

/* Metadata for every routable item, keyed by href. */
export const itemMeta: Record<string, { label: string; icon: LucideIcon }> = {
  "/dashboard": { label: "Dashboard", icon: Home },
  "/calendar": { label: "Social Media Posting", icon: CalendarDays },

  // Muzammil
  "/google-ads": { label: "Google Ads", icon: BarChart3 },
  "/meta-ads": { label: "Meta Ads", icon: Megaphone },
  "/analytics": { label: "Google Analytics", icon: LineChart },
  "/search-console": { label: "Search Console", icon: Search },
  "/landing-pages": { label: "Landing Pages", icon: LayoutTemplate },
  "/website": { label: "Website", icon: Globe },
  "/automation": { label: "Automation", icon: Workflow },
  "/workspace": { label: "Google Workspace", icon: Mail },
  "/instagram": { label: "Instagram", icon: Camera },
  "/facebook": { label: "Facebook", icon: Contact },
  "/linkedin": { label: "LinkedIn", icon: Briefcase },
  "/tiktok": { label: "TikTok", icon: Music2 },
  "/youtube": { label: "YouTube", icon: MonitorPlay },

  // Hashaam
  "/community": { label: "Community Management", icon: MessagesSquare },
  "/huddles": { label: "Huddle Management", icon: Users },
  "/gold-calls": { label: "Gold Calls Management", icon: PhoneCall },
  "/video-editing": { label: "Video Editing", icon: Clapperboard },
  "/reels": { label: "Reels", icon: Video },
  "/workbooks": { label: "Workbook Designs", icon: BookOpen },
  "/thumbnails": { label: "Thumbnail Designs", icon: Image },

  // Phase 2 (command palette only)
  "/crm": { label: "CRM", icon: Contact },
  "/leads": { label: "Lead Pipeline", icon: Filter },
  "/invoices": { label: "Invoices", icon: FileText },
  "/finance": { label: "Finance", icon: Wallet },
  "/ai-assistant": { label: "AI Assistant", icon: Bot },
  "/meeting-notes": { label: "Meeting Notes", icon: NotebookPen },
  "/knowledge-base": { label: "Knowledge Base", icon: BookOpen },
  "/analytics-hub": { label: "Analytics Hub", icon: PieChart },
  "/automation-center": { label: "Automation Center", icon: Workflow },
  "/reports": { label: "Reports", icon: FileBarChart },
  "/client-portal": { label: "Client Portal", icon: PanelsTopLeft },
  "/vault": { label: "Password Vault", icon: KeyRound },
  "/integrations": { label: "API Integrations", icon: Plug },
  "/user-management": { label: "Advanced User Management", icon: UserCog },
};

export function itemFor(href: string): NavItem {
  const m = itemMeta[href] ?? { label: href, icon: Home };
  return { label: m.label, href, icon: m.icon };
}

/* Pinned — fixed at the top, never scrolls away. */
export const pinnedItems: NavItem[] = [{ ...itemFor("/dashboard") }];

/* Draggable task sections. */
export type SectionKey = "muzammil" | "hashaam" | "future";

export interface SidebarSections {
  muzammil: string[];
  hashaam: string[];
  future: string[];
}

export const defaultSections: SidebarSections = {
  muzammil: [
    "/google-ads",
    "/meta-ads",
    "/analytics",
    "/search-console",
    "/landing-pages",
    "/website",
    "/automation",
    "/workspace",
    "/instagram",
    "/facebook",
    "/linkedin",
    "/tiktok",
    "/youtube",
  ],
  hashaam: ["/calendar", "/community", "/huddles", "/gold-calls", "/video-editing", "/reels", "/workbooks", "/thumbnails"],
  future: [],
};

export const sectionMeta: { key: SectionKey; title: string; roles: Role[] }[] = [
  { key: "muzammil", title: "Muzammil Tasks", roles: ["super_admin"] },
  { key: "hashaam", title: "Hashaam Tasks", roles: ["super_admin", "team_member"] },
  { key: "future", title: "Future Assignments", roles: ["super_admin", "team_member"] },
];

/* Phase 2 items — reachable via ⌘K but not shown in the sidebar. */
export const phase2Hrefs = [
  "/crm",
  "/leads",
  "/invoices",
  "/finance",
  "/ai-assistant",
  "/meeting-notes",
  "/knowledge-base",
  "/analytics-hub",
  "/automation-center",
  "/reports",
  "/client-portal",
  "/vault",
  "/integrations",
  "/user-management",
];

/* Everything reachable — used for the ⌘K palette and breadcrumb titles. */
export const allNavItems: NavItem[] = Object.keys(itemMeta).map((href) => itemFor(href));

export function sectionsForRole(role: Role): SectionKey[] {
  return sectionMeta.filter((s) => s.roles.includes(role)).map((s) => s.key);
}
