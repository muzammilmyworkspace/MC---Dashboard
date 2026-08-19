import type { LandingPageStatus } from "@/lib/api";

/**
 * One place that decides how a deployment state is worded and coloured.
 *
 * The labels are deliberately plain: a non-technical reader should not have
 * to know what "READY" or "CANCELED" means in Vercel's vocabulary.
 */
export const statusMeta: Record<
  LandingPageStatus,
  { label: string; tone: "success" | "warning" | "danger" | "muted"; help: string }
> = {
  LIVE: { label: "Live", tone: "success", help: "The page is published and reachable." },
  BUILDING: { label: "Building", tone: "warning", help: "A new version is being published right now." },
  QUEUED: { label: "Queued", tone: "warning", help: "A new version is waiting to start building." },
  FAILED: { label: "Failed", tone: "danger", help: "The last publish failed, so the previous version is still live." },
  CANCELED: { label: "Canceled", tone: "muted", help: "The last publish was stopped before it finished." },
  UNKNOWN: { label: "Unknown", tone: "muted", help: "We could not read the current state from Vercel." },
};

/** Framework ids Vercel returns are lowercase slugs; these are the readable forms. */
const FRAMEWORKS: Record<string, string> = {
  nextjs: "Next.js",
  react: "React",
  vue: "Vue",
  nuxtjs: "Nuxt",
  svelte: "Svelte",
  sveltekit: "SvelteKit",
  astro: "Astro",
  gatsby: "Gatsby",
  remix: "Remix",
  vite: "Vite",
  angular: "Angular",
  hugo: "Hugo",
  jekyll: "Jekyll",
  html: "Static HTML",
  other: "Other",
};

export function frameworkLabel(slug: string): string {
  if (!slug) return "Unknown";
  return FRAMEWORKS[slug.toLowerCase()] ?? slug;
}

/** "example.com" from "https://example.com/" — the link text a client reads. */
export function displayUrl(url: string): string {
  if (!url) return "";
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

export function formatDuration(ms: number | null): string {
  if (ms === null || ms <= 0) return "—";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}
