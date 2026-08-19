import "server-only";
import { LandingPageStatus } from "@prisma/client";
import { vercelRequest } from "./client";

/* ------------------------------------------------------------------ *
 *  Vercel projects
 *
 *  Normalises the v9 project shape into the handful of fields the
 *  selection modal shows. Nothing here writes to the database — listing
 *  what is available must never be able to import anything.
 * ------------------------------------------------------------------ */

/** Vercel readyState → our status. Unknown states stay UNKNOWN rather than guessing LIVE. */
export function mapReadyState(state: string | null | undefined): LandingPageStatus {
  switch ((state ?? "").toUpperCase()) {
    case "READY":
      return LandingPageStatus.LIVE;
    case "BUILDING":
    case "INITIALIZING":
      return LandingPageStatus.BUILDING;
    case "QUEUED":
      return LandingPageStatus.QUEUED;
    case "ERROR":
      return LandingPageStatus.FAILED;
    case "CANCELED":
      return LandingPageStatus.CANCELED;
    default:
      return LandingPageStatus.UNKNOWN;
  }
}

interface VercelTarget {
  id?: string;
  url?: string;
  alias?: string[];
  readyState?: string;
  createdAt?: number;
}

interface VercelProject {
  id: string;
  name: string;
  framework?: string | null;
  updatedAt?: number;
  targets?: { production?: VercelTarget | null } | null;
  latestDeployments?: Array<{
    id?: string;
    uid?: string;
    url?: string;
    readyState?: string;
    target?: string | null;
    createdAt?: number;
    alias?: string[];
  }> | null;
}

export interface AvailableProject {
  vercelProjectId: string;
  name: string;
  productionUrl: string;
  framework: string;
  status: LandingPageStatus;
  environment: string;
  deploymentId: string | null;
  lastDeploymentAt: string | null;
}

/**
 * Prefers a real alias over the immutable deployment URL.
 *
 * Vercel's `url` for a production target is the per-deployment hostname
 * (`proj-abc123-team.vercel.app`), which changes on every deploy. The alias
 * list holds the stable addresses, and the shortest is reliably the cleanest
 * — a custom domain beats the generated one.
 */
function productionUrl(project: VercelProject): string {
  const target = project.targets?.production ?? null;
  const aliases = [...(target?.alias ?? [])].filter(Boolean);
  if (aliases.length) {
    const best = aliases.sort((a, b) => a.length - b.length)[0];
    return `https://${best.replace(/^https?:\/\//, "")}`;
  }
  if (target?.url) return `https://${target.url.replace(/^https?:\/\//, "")}`;
  return "";
}

function normalise(project: VercelProject): AvailableProject {
  const target = project.targets?.production ?? null;
  const latestProd =
    project.latestDeployments?.find((d) => d.target === "production") ?? project.latestDeployments?.[0] ?? null;

  const createdAt = target?.createdAt ?? latestProd?.createdAt ?? project.updatedAt ?? null;

  return {
    vercelProjectId: project.id,
    name: project.name,
    productionUrl: productionUrl(project),
    framework: project.framework ?? "other",
    status: mapReadyState(target?.readyState ?? latestProd?.readyState),
    environment: "production",
    deploymentId: target?.id ?? latestProd?.uid ?? latestProd?.id ?? null,
    lastDeploymentAt: createdAt ? new Date(createdAt).toISOString() : null,
  };
}

/**
 * Every project the token can see.
 *
 * Paginated deliberately: an account with more projects than one page would
 * otherwise present a truncated list as if it were complete, and the user
 * would have no way to know the page they wanted was missing.
 */
export async function listAvailableProjects(max = 200): Promise<AvailableProject[]> {
  const out: AvailableProject[] = [];
  let until: number | undefined;

  while (out.length < max) {
    const res = await vercelRequest<{
      projects: VercelProject[];
      pagination?: { next?: number | null };
    }>("/v9/projects", { limit: 100, until });

    out.push(...res.projects.map(normalise));

    const next = res.pagination?.next;
    if (!next || res.projects.length === 0) break;
    until = next;
  }

  return out.slice(0, max).sort((a, b) => a.name.localeCompare(b.name));
}

/** One project, for refreshing a page we already track. */
export async function getProject(vercelProjectId: string): Promise<AvailableProject> {
  const project = await vercelRequest<VercelProject>(`/v9/projects/${encodeURIComponent(vercelProjectId)}`, {}, 0);
  return normalise(project);
}
