import { Home, Settings, Plug, ServerCog, CalendarDays } from "lucide-react";
import { dashboardModule, platformModules, type ModuleIcon } from "./modules-registry";
import { type Role } from "./data";

export interface NavItem {
  label: string;
  href: string;
  icon: ModuleIcon;
  badge?: number;
}

/**
 * The primary navigation: Dashboard plus the seven platforms, nothing else.
 *
 * Derived from the module registry rather than duplicated, so the sidebar and
 * the dashboard cards can never disagree about what exists.
 */
export const primaryNav: NavItem[] = [
  { label: dashboardModule.name, href: dashboardModule.href, icon: dashboardModule.icon },
  ...platformModules.map((m) => ({ label: m.name, href: m.href, icon: m.icon })),
];

/**
 * Reachable but deliberately not in the sidebar — settings and operational
 * screens live behind the profile menu or a direct link. Keeping them out of
 * the nav is what makes the nav readable.
 */
export const secondaryMeta: Record<string, { label: string; icon: ModuleIcon }> = {
  "/settings": { label: "Settings", icon: Settings },
  "/integrations": { label: "Integrations", icon: Plug },
  "/deployments": { label: "Deployment Center", icon: ServerCog },
  "/calendar": { label: "Content Calendar", icon: CalendarDays },
};

/** Every routable label, for breadcrumbs and the ⌘K palette. */
export const itemMeta: Record<string, { label: string; icon: ModuleIcon }> = {
  ...Object.fromEntries(primaryNav.map((i) => [i.href, { label: i.label, icon: i.icon }])),
  ...secondaryMeta,
};

export function itemFor(href: string): NavItem {
  const m = itemMeta[href] ?? { label: href.replace(/^\//, "") || "Dashboard", icon: Home };
  return { label: m.label, href, icon: m.icon };
}

export const allNavItems: NavItem[] = Object.keys(itemMeta).map((href) => itemFor(href));

/** Clients see the overview and the platforms; settings stays available. */
const CLIENT_ROUTES = ["/dashboard", "/settings", ...platformModules.map((m) => m.href)];

export function canAccess(role: Role, pathname: string): boolean {
  if (role === "team") return true;
  return CLIENT_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

export function navForRole(role: Role): NavItem[] {
  if (role === "team") return primaryNav;
  return primaryNav.filter((i) => canAccess(role, i.href));
}
