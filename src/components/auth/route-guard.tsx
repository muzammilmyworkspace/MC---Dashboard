"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUI } from "@/lib/store";
import { canAccess } from "@/lib/nav";
import { LogoMark } from "@/components/brand/logo";

const noop = () => () => {};
/** false while server-rendering, true once mounted in the browser. */
const useIsClient = () => useSyncExternalStore(noop, () => true, () => false);

/**
 * Protects the authenticated area:
 *  • no session  → /login
 *  • wrong role  → /dashboard (clients can't reach team-only screens)
 * Shows a calm splash until the persisted session is readable on the client.
 */
export function RouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { authed, viewAs } = useUI();
  const isClient = useIsClient();

  const allowed = authed && canAccess(viewAs, pathname);

  useEffect(() => {
    if (!isClient) return;
    if (!authed) router.replace("/login");
    else if (!canAccess(viewAs, pathname)) router.replace("/dashboard");
  }, [isClient, authed, viewAs, pathname, router]);

  if (!isClient || !allowed) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-background">
        <LogoMark size={40} className="animate-pulse text-foreground" />
        <p className="text-sm text-muted-foreground">Loading your workspace…</p>
      </div>
    );
  }

  return <>{children}</>;
}
