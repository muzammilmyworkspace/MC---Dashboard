/**
 * Dashboard response shape, mirrored from server/dashboard.ts.
 *
 * Declared separately because the server module imports "server-only",
 * which cannot be pulled into a client component even for its types.
 */
export type { DashboardOverview, InstagramBlock, FacebookBlock, AdsBlock, Alert, PlatformHealth, TopContent } from "@/server/dashboard";
