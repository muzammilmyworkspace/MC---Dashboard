import "server-only";
import type { LandingPageStatus } from "@prisma/client";
import { vercelRequest } from "./client";
import { mapReadyState } from "./projects";

/* ------------------------------------------------------------------ *
 *  Vercel deployments
 *
 *  Read-only history for a project's detail screen. Vercel remains the
 *  source of truth; none of this is persisted.
 * ------------------------------------------------------------------ */

interface RawDeployment {
  uid?: string;
  id?: string;
  url?: string;
  name?: string;
  readyState?: string;
  state?: string;
  target?: string | null;
  created?: number;
  createdAt?: number;
  ready?: number;
  buildingAt?: number;
  meta?: Record<string, string> | null;
  creator?: { username?: string; email?: string } | null;
}

export interface DeploymentRecord {
  id: string;
  url: string | null;
  status: LandingPageStatus;
  environment: "production" | "preview";
  createdAt: string | null;
  /** Null when the build never finished, or is still running. */
  durationMs: number | null;
  commitSha: string | null;
  commitMessage: string | null;
  branch: string | null;
  creator: string | null;
}

function normalise(d: RawDeployment): DeploymentRecord {
  const created = d.created ?? d.createdAt ?? null;
  const started = d.buildingAt ?? created;
  // Only a finished build has a duration. Reporting "now minus start" for a
  // running one would show a number that grows every time the page is opened.
  const durationMs = d.ready && started ? Math.max(0, d.ready - started) : null;

  return {
    id: d.uid ?? d.id ?? "",
    url: d.url ? `https://${d.url.replace(/^https?:\/\//, "")}` : null,
    status: mapReadyState(d.readyState ?? d.state),
    environment: d.target === "production" ? "production" : "preview",
    createdAt: created ? new Date(created).toISOString() : null,
    durationMs,
    commitSha: d.meta?.githubCommitSha ?? d.meta?.gitlabCommitSha ?? d.meta?.bitbucketCommitSha ?? null,
    commitMessage: d.meta?.githubCommitMessage ?? d.meta?.gitlabCommitMessage ?? d.meta?.bitbucketCommitMessage ?? null,
    branch: d.meta?.githubCommitRef ?? d.meta?.gitlabCommitRef ?? d.meta?.bitbucketCommitRef ?? d.meta?.gitBranch ?? null,
    creator: d.creator?.username ?? d.creator?.email ?? null,
  };
}

/** Recent deployments for a project, newest first. */
export async function listDeployments(vercelProjectId: string, limit = 20): Promise<DeploymentRecord[]> {
  const res = await vercelRequest<{ deployments: RawDeployment[] }>(
    "/v6/deployments",
    { projectId: vercelProjectId, limit },
    // Short TTL rather than none: the detail screen is opened repeatedly while
    // watching a build, and each open would otherwise be a fresh API call.
    15_000
  );
  return res.deployments.map(normalise).filter((d) => d.id);
}
