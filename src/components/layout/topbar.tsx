"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Search,
  Bell,
  Sun,
  Moon,
  Plus,
  Check,
  ChevronDown,
  LogOut,
  User as UserIcon,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { useUI } from "@/lib/store";
import { allNavItems } from "@/lib/nav";
import { notifications, roleLabel, users, currentUser, type Role } from "@/lib/data";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { relativeTime, cn } from "@/lib/utils";

const toneColor: Record<string, string> = {
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#3b82f6",
  accent: "#8b5cf6",
};

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { setCommandOpen, viewAs, setViewAs } = useUI();
  const { theme, setTheme } = useTheme();
  const [notifs, setNotifs] = useState(notifications);
  const unread = notifs.filter((n) => !n.read).length;

  const current = allNavItems.find((i) => i.href === pathname);
  const title = current?.label ?? "Dashboard";

  const viewingUser = users.find((u) => u.role === viewAs) ?? currentUser;

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/70 px-4 backdrop-blur-xl md:px-6">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>NEXUS HQ</span>
          <span className="opacity-40">/</span>
          <span className="text-foreground">{title}</span>
        </div>
        <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
      </div>

      {/* Search trigger */}
      <button
        onClick={() => setCommandOpen(true)}
        className="hidden h-9 w-64 items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:border-accent/40 lg:flex"
      >
        <Search className="size-4" />
        <span>Search anything…</span>
        <kbd className="ml-auto rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
      </button>

      <Button size="sm" className="hidden sm:inline-flex" onClick={() => router.push("/tasks")}>
        <Plus className="size-4" /> New
      </Button>

      {/* Role switcher */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="hidden items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs font-medium transition-colors hover:border-accent/40 md:flex">
            <ShieldCheck className="size-3.5 text-accent" />
            <span className="text-muted-foreground">Viewing as</span>
            <span>{roleLabel[viewAs]}</span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </button>
        </DropdownMenu.Trigger>
        <Menu>
          <MenuLabel>Preview permissions as</MenuLabel>
          {(["super_admin", "team_member", "client"] as Role[]).map((r) => (
            <MenuItem key={r} onSelect={() => setViewAs(r)}>
              <span className="flex-1">{roleLabel[r]}</span>
              {viewAs === r && <Check className="size-4 text-accent" />}
            </MenuItem>
          ))}
        </Menu>
      </DropdownMenu.Root>

      {/* Theme toggle */}
      <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-accent/40 hover:text-foreground"
        aria-label="Toggle theme"
      >
        <Sun className="size-4 dark:hidden" />
        <Moon className="hidden size-4 dark:block" />
      </button>

      {/* Notifications */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="relative flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-accent/40 hover:text-foreground">
            <Bell className="size-4" />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-white ring-2 ring-background">
                {unread}
              </span>
            )}
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={10}
            className="z-50 w-[340px] overflow-hidden rounded-xl border border-border bg-popover p-0 text-popover-foreground shadow-card backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-semibold">Notifications</span>
              <button
                onClick={() => setNotifs((n) => n.map((x) => ({ ...x, read: true })))}
                className="text-xs text-accent hover:underline"
              >
                Mark all read
              </button>
            </div>
            <div className="max-h-[380px] overflow-y-auto">
              {notifs.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "flex gap-3 border-b border-border/60 px-4 py-3 transition-colors last:border-0 hover:bg-muted/50",
                    !n.read && "bg-accent/[0.04]"
                  )}
                >
                  <span
                    className="mt-1.5 size-2 shrink-0 rounded-full"
                    style={{ background: toneColor[n.tone] }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground">{n.body}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground/70">{relativeTime(n.at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {/* User menu */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="flex items-center gap-2 rounded-lg p-0.5 pr-2 transition-colors hover:bg-muted">
            <Avatar name={viewingUser.name} color={viewingUser.avatarColor} size={34} online />
            <div className="hidden text-left lg:block">
              <div className="text-xs font-semibold leading-tight">{viewingUser.name}</div>
              <div className="text-[11px] leading-tight text-muted-foreground">{roleLabel[viewingUser.role]}</div>
            </div>
            <ChevronDown className="hidden size-3.5 text-muted-foreground lg:block" />
          </button>
        </DropdownMenu.Trigger>
        <Menu align="end" width={220}>
          <div className="border-b border-border px-3 py-2.5">
            <div className="text-sm font-semibold">{viewingUser.name}</div>
            <div className="text-xs text-muted-foreground">{viewingUser.email}</div>
          </div>
          <MenuItem onSelect={() => router.push("/team")}><UserIcon className="size-4" /> Profile</MenuItem>
          <MenuItem onSelect={() => router.push("/settings")}><Settings className="size-4" /> Settings</MenuItem>
          <div className="my-1 h-px bg-border" />
          <MenuItem onSelect={() => router.push("/login")} danger>
            <LogOut className="size-4" /> Sign out
          </MenuItem>
        </Menu>
      </DropdownMenu.Root>
    </header>
  );
}

/* --- Small dropdown helpers --- */
function Menu({ children, align = "start", width = 200 }: { children: React.ReactNode; align?: "start" | "end" | "center"; width?: number }) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={10}
        style={{ width }}
        className="z-50 overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-card backdrop-blur-xl"
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}
function MenuItem({ children, onSelect, danger }: { children: React.ReactNode; onSelect?: () => void; danger?: boolean }) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm outline-none transition-colors focus:bg-muted data-[highlighted]:bg-muted",
        danger && "text-danger focus:bg-danger/10"
      )}
    >
      {children}
    </DropdownMenu.Item>
  );
}
function MenuLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</div>;
}
