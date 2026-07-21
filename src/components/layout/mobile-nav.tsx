"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CheckSquare, BadgeCheck, Search } from "lucide-react";
import { useUI } from "@/lib/store";
import { cn } from "@/lib/utils";

const items = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboard },
  { label: "Tasks", href: "/tasks", icon: CheckSquare },
  { label: "Approvals", href: "/approvals", icon: BadgeCheck },
];

export function MobileNav() {
  const pathname = usePathname();
  const { setCommandOpen } = useUI();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-border bg-background/90 px-2 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur-xl md:hidden">
      {items.map((i) => {
        const active = pathname === i.href;
        return (
          <Link
            key={i.href}
            href={i.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-[10px] font-medium transition-colors",
              active ? "text-accent" : "text-muted-foreground"
            )}
          >
            <i.icon className="size-5" />
            {i.label}
          </Link>
        );
      })}
      <button
        onClick={() => setCommandOpen(true)}
        className="flex flex-1 flex-col items-center gap-1 py-1.5 text-[10px] font-medium text-muted-foreground"
      >
        <Search className="size-5" />
        Search
      </button>
    </nav>
  );
}
