"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search as SearchIcon,
  CalendarDays,
  Home,
  Moon,
  Sun,
  ArrowRight,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useUI } from "@/lib/store";
import { allNavItems } from "@/lib/nav";
import { moduleFor } from "@/lib/modules-registry";
import { cn } from "@/lib/utils";

export function CommandPalette() {
  const { commandOpen, setCommandOpen } = useUI();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(!commandOpen);
      }
      if (e.key === "Escape") setCommandOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [commandOpen, setCommandOpen]);

  function go(href: string) {
    router.push(href);
    setCommandOpen(false);
  }

  const quickActions = [
    { label: "Open Social Media Posting", icon: CalendarDays, action: () => go("/calendar") },
    { label: "Review content awaiting approval", icon: Plus, action: () => go("/calendar") },
    { label: "Go to Dashboard", icon: Home, action: () => go("/dashboard") },
    {
      label: theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
      icon: theme === "dark" ? Sun : Moon,
      action: () => {
        setTheme(theme === "dark" ? "light" : "dark");
        setCommandOpen(false);
      },
    },
  ];

  return (
    <AnimatePresence>
      {commandOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[12vh]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setCommandOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -12 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-popover shadow-glow backdrop-blur-2xl"
          >
            <Command className="w-full" loop>
              <div className="flex items-center gap-3 border-b border-border px-4">
                <SearchIcon className="size-4 text-muted-foreground" />
                <Command.Input
                  autoFocus
                  placeholder="Search modules, run an action…"
                  className="h-14 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">ESC</kbd>
              </div>
              <Command.List className="max-h-[380px] overflow-y-auto p-2">
                <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
                  No results found.
                </Command.Empty>

                <Command.Group heading="Quick actions" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground">
                  {quickActions.map((a) => (
                    <Command.Item
                      key={a.label}
                      onSelect={a.action}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm data-[selected=true]:bg-accent/15 data-[selected=true]:text-foreground"
                    >
                      <span className="flex size-7 items-center justify-center rounded-md bg-muted">
                        <a.icon className="size-4 text-accent" />
                      </span>
                      {a.label}
                    </Command.Item>
                  ))}
                </Command.Group>

                <Command.Group heading="Navigate" className="mt-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground">
                  {allNavItems.map((item) => (
                    <Command.Item
                      key={item.href}
                      value={item.label}
                      onSelect={() => go(item.href)}
                      className="group flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm data-[selected=true]:bg-accent/15 data-[selected=true]:text-foreground"
                    >
                      <span className="flex size-7 items-center justify-center rounded-md bg-muted">
                        <item.icon className="size-4 text-muted-foreground" />
                      </span>
                      <span className="flex-1">{item.label}</span>
                      {/* Marks modules that aren't built yet, so the palette
                          doesn't imply every destination is functional. */}
                      {moduleFor(item.href)?.live === false && (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground/70">
                          soon
                        </span>
                      )}
                      <ArrowRight className={cn("size-3.5 text-muted-foreground opacity-0 group-data-[selected=true]:opacity-100")} />
                    </Command.Item>
                  ))}
                </Command.Group>
              </Command.List>
            </Command>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
