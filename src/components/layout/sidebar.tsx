"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Search,
  Star,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
} from "lucide-react";
import { navGroups, allNavItems, type NavItem } from "@/lib/nav";
import { useUI } from "@/lib/store";
import { Logo, LogoMark } from "@/components/brand/logo";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggleCollapsed, setCommandOpen } = useUI();
  const [query, setQuery] = useState("");
  const [favorites] = useState<string[]>(["/dashboard", "/approvals", "/vault"]);

  const filtered = query
    ? allNavItems.filter((i) => i.label.toLowerCase().includes(query.toLowerCase()))
    : null;

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 76 : 268 }}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
      className="sticky top-0 z-30 hidden h-dvh shrink-0 flex-col border-r border-border bg-background-subtle/60 backdrop-blur-xl md:flex"
    >
      {/* Header */}
      <div className={cn("flex h-16 items-center border-b border-border px-4", collapsed && "justify-center px-0")}>
        {collapsed ? (
          <LogoMark size={30} />
        ) : (
          <div className="flex w-full items-center justify-between">
            <Logo size={32} />
          </div>
        )}
      </div>

      {/* Search / collapse */}
      <div className={cn("flex items-center gap-2 p-3", collapsed && "justify-center")}>
        {collapsed ? (
          <Tooltip content="Search ( ⌘K )">
            <button
              onClick={() => setCommandOpen(true)}
              className="flex size-10 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-accent/40 hover:text-foreground"
            >
              <Search className="size-4" />
            </button>
          </Tooltip>
        ) : (
          <button
            onClick={() => setCommandOpen(true)}
            className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-border bg-background/40 px-3 text-sm text-muted-foreground transition-colors hover:border-accent/40"
          >
            <Search className="size-4" />
            <span>Search…</span>
            <kbd className="ml-auto rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
          </button>
        )}
      </div>

      {/* Inline filter when expanded */}
      {!collapsed && (
        <div className="px-3 pb-2">
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter modules"
              className="h-8 w-full rounded-md border border-transparent bg-muted/60 px-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-accent/40 focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="no-scrollbar flex-1 space-y-5 overflow-y-auto px-3 pb-4 pt-1">
        {filtered ? (
          <div className="space-y-1">
            {filtered.map((item) => (
              <NavLink key={item.href} item={item} active={pathname === item.href} collapsed={collapsed} />
            ))}
            {filtered.length === 0 && (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">No modules found.</p>
            )}
          </div>
        ) : (
          <>
            {!collapsed && favorites.length > 0 && (
              <div className="space-y-1">
                <GroupLabel icon={<Star className="size-3" />}>Favorites</GroupLabel>
                {allNavItems
                  .filter((i) => favorites.includes(i.href))
                  .map((item) => (
                    <NavLink key={item.href} item={item} active={pathname === item.href} collapsed={collapsed} />
                  ))}
              </div>
            )}

            {navGroups.map((group) => (
              <div key={group.title} className="space-y-1">
                {!collapsed && <GroupLabel>{group.title}</GroupLabel>}
                {collapsed && <div className="mx-auto my-2 h-px w-8 bg-border" />}
                {group.items.map((item) => (
                  <NavLink key={item.href} item={item} active={pathname === item.href} collapsed={collapsed} />
                ))}
              </div>
            ))}
          </>
        )}
      </nav>

      {/* Upgrade / footer */}
      {!collapsed && (
        <div className="p-3">
          <div className="relative overflow-hidden rounded-xl border border-accent/25 bg-accent/10 p-3.5">
            <Sparkles className="mb-2 size-4 text-accent" />
            <p className="text-xs font-semibold">Phase 2 — Live Integrations</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Connect Meta, Google & TikTok APIs for real-time data.
            </p>
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <div className="border-t border-border p-3">
        <button
          onClick={toggleCollapsed}
          className={cn(
            "flex h-9 w-full items-center gap-2 rounded-lg px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            collapsed && "justify-center px-0"
          )}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          {!collapsed && "Collapse"}
        </button>
      </div>
    </motion.aside>
  );
}

function GroupLabel({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
      {icon}
      {children}
    </div>
  );
}

function NavLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  const inner = (
    <Link
      href={item.href}
      className={cn(
        "group relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
        collapsed && "justify-center px-0"
      )}
    >
      {active && (
        <motion.div
          layoutId="nav-active"
          className="absolute inset-0 rounded-lg border border-accent/30 bg-accent/12"
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
        />
      )}
      {active && !collapsed && (
        <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-accent" />
      )}
      <Icon className={cn("relative z-10 size-[18px] shrink-0", active && "text-accent")} />
      {!collapsed && (
        <span className="relative z-10 flex-1 truncate">{item.label}</span>
      )}
      {!collapsed && item.badge ? (
        <span
          className={cn(
            "relative z-10 flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold",
            active ? "bg-accent text-white" : "bg-muted text-muted-foreground"
          )}
        >
          {item.badge}
        </span>
      ) : null}
      {!collapsed && !item.live && !item.badge && (
        <span className="relative z-10 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground/60">
          soon
        </span>
      )}
      {collapsed && item.badge ? (
        <span className="absolute right-1.5 top-1.5 z-10 flex size-2 rounded-full bg-accent" />
      ) : null}
    </Link>
  );

  return (
    <Tooltip content={item.label} hidden={!collapsed}>
      {inner}
    </Tooltip>
  );
}
