"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Search, Bell, Sun, Moon, ChevronDown, LogOut, Menu as MenuIcon,
  User as UserIcon, Settings, CreditCard, Check,
} from "lucide-react";
import { useUI } from "@/lib/store";
import { itemMeta } from "@/lib/nav";
import { notifications, roleLabel, users, currentUser, type Role } from "@/lib/data";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { relativeTime, cn } from "@/lib/utils";

const toneColor: Record<string, string> = {
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  info: "var(--accent)",
  accent: "var(--accent)",
};

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { setCommandOpen, viewAs, setViewAs, setMobileNavOpen, signOut } = useUI();
  const { theme, setTheme } = useTheme();
  const [notifs, setNotifs] = useState(notifications);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const unread = notifs.filter((n) => !n.read).length;

  const title = itemMeta[pathname]?.label ?? "Dashboard";
  const viewingUser = users.find((u) => u.role === viewAs) ?? currentUser;

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl md:px-6">
        <button
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open menu"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-accent/40 hover:text-foreground md:hidden"
        >
          <MenuIcon className="size-4" />
        </button>

        <div className="min-w-0 flex-1">
          <p className="hidden text-[11px] uppercase tracking-wider text-muted-foreground sm:block">MC Nexus</p>
          <h1 className="truncate text-[15px] font-semibold tracking-tight">{title}</h1>
        </div>

        <button
          onClick={() => setCommandOpen(true)}
          className="hidden h-9 w-56 items-center gap-2.5 rounded-lg border border-border bg-muted/40 px-3 text-[13px] text-muted-foreground transition-colors hover:border-accent/40 hover:bg-muted lg:flex"
        >
          <Search className="size-4 shrink-0" />
          <span className="truncate">Search</span>
          <kbd className="ml-auto shrink-0 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
        </button>

        <IconButton onClick={() => setCommandOpen(true)} label="Search" className="lg:hidden">
          <Search className="size-4" />
        </IconButton>

        <IconButton onClick={() => setTheme(theme === "dark" ? "light" : "dark")} label="Toggle theme">
          <Sun className="size-4 dark:hidden" />
          <Moon className="hidden size-4 dark:block" />
        </IconButton>

        {/* Notifications */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
              className="relative flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-accent/40 hover:text-foreground"
            >
              <Bell className="size-4" />
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-accent text-[9px] font-semibold text-white ring-2 ring-background">
                  {unread}
                </span>
              )}
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={10}
              className="z-50 w-[min(340px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-card"
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <span className="text-sm font-semibold">Notifications</span>
                {unread > 0 && (
                  <button
                    onClick={() => setNotifs((n) => n.map((x) => ({ ...x, read: true })))}
                    className="text-xs text-accent hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-[360px] overflow-y-auto">
                {notifs.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
                ) : (
                  notifs.map((n) => (
                    <div
                      key={n.id}
                      className={cn(
                        "flex gap-3 border-b border-border/60 px-4 py-3 last:border-0",
                        !n.read && "bg-accent-soft"
                      )}
                    >
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full" style={{ background: toneColor[n.tone] }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium">{n.title}</p>
                        <p className="text-xs text-muted-foreground">{n.body}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground/70">{relativeTime(n.at)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        {/* Profile */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="flex shrink-0 items-center gap-2 rounded-lg p-0.5 pr-1.5 transition-colors hover:bg-muted">
              <Avatar name={viewingUser.name} color={viewingUser.avatarColor} size={32} online />
              <div className="hidden text-left xl:block">
                <div className="text-[13px] font-medium leading-tight">{viewingUser.name}</div>
                <div className="text-[11px] leading-tight text-muted-foreground">{roleLabel[viewingUser.role]}</div>
              </div>
              <ChevronDown className="hidden size-3.5 text-muted-foreground xl:block" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={10}
              className="z-50 w-60 overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-card"
            >
              <div className="flex items-center gap-3 border-b border-border px-3 py-3">
                <Avatar name={viewingUser.name} color={viewingUser.avatarColor} size={36} />
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold">{viewingUser.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{viewingUser.email}</div>
                </div>
              </div>

              <div className="py-1">
                <MenuItem onSelect={() => router.push("/settings?tab=account")}>
                  <UserIcon className="size-4" /> Profile
                </MenuItem>
                <MenuItem onSelect={() => router.push("/settings")}>
                  <Settings className="size-4" /> Settings
                </MenuItem>
                <MenuItem onSelect={() => router.push("/settings?tab=account")}>
                  <CreditCard className="size-4" /> Account
                </MenuItem>
              </div>

              {/* Demo-only role switch. Labelled so nobody mistakes it for real
                  permissions — the server decides the actual role at login. */}
              <div className="border-t border-border py-1">
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Preview as
                </p>
                {(["team", "client"] as Role[]).map((r) => (
                  <MenuItem key={r} onSelect={() => setViewAs(r)}>
                    <span className="flex-1">{roleLabel[r]}</span>
                    {viewAs === r && <Check className="size-4 text-accent" />}
                  </MenuItem>
                ))}
              </div>

              <div className="border-t border-border py-1">
                <MenuItem onSelect={() => setConfirmSignOut(true)} danger>
                  <LogOut className="size-4" /> Log out
                </MenuItem>
              </div>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </header>

      <Dialog open={confirmSignOut} onOpenChange={setConfirmSignOut}>
        <DialogContent className="max-w-sm p-6">
          <DialogTitle>Log out?</DialogTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            You&apos;ll need to sign in again to reach the dashboard. Connected platforms stay connected.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmSignOut(false)}>Cancel</Button>
            <Button
              onClick={() => {
                setConfirmSignOut(false);
                signOut();
                router.replace("/login");
              }}
            >
              <LogOut className="size-4" /> Log out
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function IconButton({
  children, onClick, label, className,
}: {
  children: React.ReactNode; onClick: () => void; label: string; className?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-accent/40 hover:text-foreground",
        className
      )}
    >
      {children}
    </button>
  );
}

function MenuItem({
  children, onSelect, danger,
}: {
  children: React.ReactNode; onSelect?: () => void; danger?: boolean;
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-[13px] outline-none transition-colors focus:bg-muted data-[highlighted]:bg-muted",
        danger && "text-danger data-[highlighted]:bg-danger/10"
      )}
    >
      {children}
    </DropdownMenu.Item>
  );
}
