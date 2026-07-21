"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/layout/command-palette";
import { MobileNav } from "@/components/layout/mobile-nav";
import { PageTransition } from "@/components/layout/page-transition";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <div className="flex min-h-dvh">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 px-4 pb-24 pt-6 md:px-6 md:pb-10">
            <div className="mx-auto w-full max-w-[1400px]">
              <PageTransition>{children}</PageTransition>
            </div>
          </main>
        </div>
      </div>
      <MobileNav />
      <CommandPalette />
    </TooltipProvider>
  );
}
