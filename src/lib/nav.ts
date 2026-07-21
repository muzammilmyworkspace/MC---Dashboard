import {
  LayoutDashboard,
  Calendar,
  CheckSquare,
  FolderKanban,
  BadgeCheck,
  Clapperboard,
  Megaphone,
  BarChart3,
  Music2,
  MonitorPlay,
  Briefcase,
  Contact,
  Camera,
  Globe,
  LineChart,
  Search,
  Mail,
  KeyRound,
  StickyNote,
  Images,
  FolderOpen,
  MessagesSquare,
  Bell,
  Users,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
  live?: boolean; // built-out in this MVP
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    title: "Workspace",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, live: true },
      { label: "Tasks", href: "/tasks", icon: CheckSquare, badge: 6, live: true },
      { label: "Content Approval", href: "/approvals", icon: BadgeCheck, badge: 3, live: true },
      { label: "Calendar", href: "/calendar", icon: Calendar },
      { label: "Projects", href: "/projects", icon: FolderKanban },
      { label: "Content Studio", href: "/studio", icon: Clapperboard },
    ],
  },
  {
    title: "Marketing",
    items: [
      { label: "Meta Ads", href: "/meta-ads", icon: Megaphone },
      { label: "Google Ads", href: "/google-ads", icon: BarChart3 },
      { label: "Google Analytics", href: "/analytics", icon: LineChart },
      { label: "Search Console", href: "/search-console", icon: Search },
      { label: "Website", href: "/website", icon: Globe },
    ],
  },
  {
    title: "Channels",
    items: [
      { label: "Instagram", href: "/instagram", icon: Camera },
      { label: "TikTok", href: "/tiktok", icon: Music2 },
      { label: "YouTube", href: "/youtube", icon: MonitorPlay },
      { label: "LinkedIn", href: "/linkedin", icon: Briefcase },
      { label: "Facebook", href: "/facebook", icon: Contact },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Password Vault", href: "/vault", icon: KeyRound },
      { label: "Google Workspace", href: "/workspace", icon: Mail },
      { label: "Assets Library", href: "/assets", icon: Images },
      { label: "File Manager", href: "/files", icon: FolderOpen },
      { label: "Notes", href: "/notes", icon: StickyNote },
      { label: "Team Chat", href: "/chat", icon: MessagesSquare, badge: 2 },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Notifications", href: "/notifications", icon: Bell, badge: 3 },
      { label: "Team", href: "/team", icon: Users },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export const allNavItems = navGroups.flatMap((g) => g.items);
