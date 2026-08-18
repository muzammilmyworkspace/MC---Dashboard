"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, PanelLeftClose, PanelLeftOpen, Settings, X } from "lucide-react";
import { navForRole, itemFor, type NavItem } from "@/lib/nav";
import { useUI } from "@/lib/store";
import { Logo, LogoMark } from "@/components/brand/logo";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/* ------------------------------ Desktop rail ------------------------------ */

export function Sidebar() {
  const { collapsed, toggleCollapsed } = useUI();
  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 248 }}
      transition={{ type: "spring", stiffness: 300, damping: 34 }}
      className="sticky top-0 z-30 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex"
    >
      <SidebarBody collapsed={collapsed} />

      <div className="border-t border-sidebar-border p-2.5">
        <Tooltip content="Expand sidebar" hidden={!collapsed}>
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex h-9 w-full items-center gap-3 rounded-lg px-3 text-[13px] font-medium text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground",
              collapsed && "justify-center px-0"
            )}
          >
            {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </Tooltip>
      </div>
    </motion.aside>
  );
}

/* ------------------------------ Mobile drawer ----------------------------- */

export function MobileSidebar() {
  const { mobileNavOpen, setMobileNavOpen } = useUI();
  return (
    <AnimatePresence>
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileNavOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            className="absolute inset-y-0 left-0 flex w-[82%] max-w-[280px] flex-col bg-sidebar text-sidebar-foreground shadow-2xl"
          >
            <button
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-4 z-10 flex size-8 items-center justify-center rounded-lg text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground"
            >
              <X className="size-4" />
            </button>
            <SidebarBody collapsed={false} onNavigate={() => setMobileNavOpen(false)} />
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------- Shared body ------------------------------ */

function SidebarBody({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { setCommandOpen, viewAs } = useUI();
  const items = navForRole(viewAs);

  return (
    <>
      <div className={cn("flex h-16 shrink-0 items-center border-b border-sidebar-border px-5", collapsed && "justify-center px-0")}>
        {collapsed ? <LogoMark size={26} className="text-white" /> : <Logo size={28} tone="light" />}
      </div>

      <div className={cn("px-3 pt-4", collapsed && "flex justify-center px-0")}>
        <Tooltip content="Search  ⌘K" hidden={!collapsed}>
          <button
            onClick={() => setCommandOpen(true)}
            aria-label="Search"
            className={cn(
              "flex items-center rounded-lg border border-sidebar-border bg-white/[0.02] text-sidebar-muted transition-colors hover:border-accent/40 hover:text-sidebar-foreground",
              collapsed ? "size-10 justify-center" : "h-9 w-full gap-2.5 px-3"
            )}
          >
            <Search className="size-4 shrink-0" />
            {!collapsed && (
              <>
                <span className="text-[13px]">Search</span>
                <kbd className="ml-auto rounded border border-sidebar-border px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
              </>
            )}
          </button>
        </Tooltip>
      </div>

      <nav className="no-scrollbar mt-4 flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {items.map((item) => (
          <NavRow
            key={item.href}
            item={item}
            active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className="border-t border-sidebar-border px-3 py-2.5">
        <NavRow
          item={itemFor("/settings")}
          active={pathname.startsWith("/settings")}
          collapsed={collapsed}
          onNavigate={onNavigate}
          icon={Settings}
        />
      </div>
    </>
  );
}

function NavRow({
  item,
  active,
  collapsed,
  onNavigate,
  icon,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
  icon?: NavItem["icon"];
}) {
  const Icon = icon ?? item.icon;
  return (
    <Tooltip content={item.label} hidden={!collapsed}>
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group relative flex h-10 items-center gap-3 rounded-lg text-[13px] font-medium transition-colors",
          collapsed ? "justify-center px-0" : "px-3",
          active
            ? "bg-sidebar-active text-white"
            : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground"
        )}
      >
        {/* The rail marker reads as "you are here" faster than colour alone. */}
        {active && !collapsed && (
          <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent" />
        )}
        <Icon className={cn("size-[18px] shrink-0", active && "text-accent")} />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </Link>
    </Tooltip>
  );
}
