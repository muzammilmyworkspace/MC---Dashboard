"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar, MobileSidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/layout/command-palette";
import { PageTransition } from "@/components/layout/page-transition";
import { RouteGuard } from "@/components/auth/route-guard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard>
    <TooltipProvider>
      <div className="flex min-h-dvh">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 px-4 pb-12 pt-6 md:px-6 md:pb-10">
            <div className="mx-auto w-full max-w-[1440px]">
              <PageTransition>{children}</PageTransition>
            </div>
          </main>
        </div>
      </div>
      <MobileSidebar />
      <CommandPalette />
    </TooltipProvider>
    </RouteGuard>
  );
}
