import { DeployState } from "@prisma/client";
import { env } from "../../env.js";
import { providerRequest } from "./http.js";

/* ------------------------------ Shared types ----------------------------- */

export interface NormalizedRepo {
  id: string;
  name: string; // owner/repo
  url: string;
  defaultBranch: string;
  description: string;
}

export interface NormalizedCommit {
  sha: string;
  message: string;
  author: string;
  at: string;
}

export interface NormalizedDeployment {
  externalId: string;
  state: DeployState;
  environment: "PRODUCTION" | "PREVIEW" | "DEVELOPMENT";
  branch: string;
  commitSha: string;
  commitMessage: string;
  commitAuthor: string;
  url: string | null;
  createdAt: string;
  finishedAt: string | null;
  durationMs: number | null;
}

export interface ProviderCredentials {
  token?: string;
  clientId?: string;
  clientSecret?: string;
  webhookSecret?: string;
  teamId?: string;
  projectId?: string;
}

export interface ConnectionCheck {
  ok: boolean;
  message: string;
  account?: string;
}

/* --------------------------------- GitHub -------------------------------- */

export const github = {
  key: "github" as const,
  scopes: ["repo", "read:org", "admin:repo_hook"],
  requiredEnv: ["GITHUB_TOKEN"],

  token: (creds?: ProviderCredentials) => creds?.token ?? env.GITHUB_TOKEN,

  authorizeUrl(state: string, redirectUri: string) {
    const params = new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID ?? "",
      redirect_uri: redirectUri,
      scope: github.scopes.join(" "),
      state,
    });
    return `https://github.com/login/oauth/authorize?${params}`;
  },

  async check(creds?: ProviderCredentials): Promise<ConnectionCheck> {
    const token = github.token(creds);
    if (!token) return { ok: false, message: "No GitHub token configured" };
    try {
      const me = await providerRequest<{ login: string }>({
        provider: "github", url: `${env.GITHUB_API_URL}/user`, token, cacheTtlMs: 30_000,
      });
      return { ok: true, message: `Authenticated as ${me.login}`, account: me.login };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Connection failed" };
    }
  },

  async getRepo(fullName: string, creds?: ProviderCredentials): Promise<NormalizedRepo> {
    const r = await providerRequest<{ id: number; full_name: string; html_url: string; default_branch: string; description: string | null }>({
      provider: "github", url: `${env.GITHUB_API_URL}/repos/${fullName}`, token: github.token(creds),
    });
    return { id: String(r.id), name: r.full_name, url: r.html_url, defaultBranch: r.default_branch, description: r.description ?? "" };
  },

  async listCommits(fullName: string, branch: string, creds?: ProviderCredentials): Promise<NormalizedCommit[]> {
    const list = await providerRequest<Array<{ sha: string; commit: { message: string; author: { name: string; date: string } } }>>({
      provider: "github",
      url: `${env.GITHUB_API_URL}/repos/${fullName}/commits?sha=${encodeURIComponent(branch)}&per_page=10`,
      token: github.token(creds),
    });
    return list.map((c) => ({
      sha: c.sha,
      message: c.commit.message.split("\n")[0],
      author: c.commit.author?.name ?? "unknown",
      at: c.commit.author?.date ?? new Date().toISOString(),
    }));
  },
};

/* --------------------------------- Vercel -------------------------------- */

/** Vercel readyState → our DeployState. */
export function mapVercelState(state: string | undefined): DeployState {
  switch ((state ?? "").toUpperCase()) {
    case "READY": return DeployState.READY;
    case "BUILDING":
    case "INITIALIZING": return DeployState.BUILDING;
    case "QUEUED": return DeployState.QUEUED;
    case "ERROR": return DeployState.ERROR;
    case "CANCELED": return DeployState.CANCELED;
    default: return DeployState.QUEUED;
  }
}

interface VercelDeployment {
  uid: string;
  url: string;
  readyState?: string;
  state?: string;
  target?: string | null;
  createdAt: number;
  ready?: number;
  buildingAt?: number;
  meta?: Record<string, string>;
}

export const vercel = {
  key: "vercel" as const,
  scopes: ["projects:read", "deployments:read", "domains:read"],
  requiredEnv: ["VERCEL_TOKEN"],

  token: (creds?: ProviderCredentials) => creds?.token ?? env.VERCEL_TOKEN,
  teamQuery: (creds?: ProviderCredentials) => {
    const team = creds?.teamId ?? env.VERCEL_TEAM_ID;
    return team ? `teamId=${encodeURIComponent(team)}` : "";
  },

  async check(creds?: ProviderCredentials): Promise<ConnectionCheck> {
    const token = vercel.token(creds);
    if (!token) return { ok: false, message: "No Vercel token configured" };
    try {
      const me = await providerRequest<{ user?: { username: string } }>({
        provider: "vercel", url: `${env.VERCEL_API_URL}/v2/user`, token, cacheTtlMs: 30_000,
      });
      return { ok: true, message: `Authenticated as ${me.user?.username ?? "Vercel user"}`, account: me.user?.username };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Connection failed" };
    }
  },

  async listProjects(creds?: ProviderCredentials) {
    const q = vercel.teamQuery(creds);
    const res = await providerRequest<{ projects: Array<{ id: string; name: string; framework: string | null; link?: { type: string; org: string; repo: string } }> }>({
      provider: "vercel", url: `${env.VERCEL_API_URL}/v9/projects${q ? `?${q}` : ""}`, token: vercel.token(creds),
    });
    return res.projects.map((p) => ({
      id: p.id,
      name: p.name,
      framework: p.framework ?? "other",
      repoName: p.link ? `${p.link.org}/${p.link.repo}` : "",
    }));
  },

  async listDeployments(projectId: string, creds?: ProviderCredentials): Promise<NormalizedDeployment[]> {
    const q = [vercel.teamQuery(creds), `projectId=${encodeURIComponent(projectId)}`, "limit=20"].filter(Boolean).join("&");
    const res = await providerRequest<{ deployments: VercelDeployment[] }>({
      provider: "vercel", url: `${env.VERCEL_API_URL}/v6/deployments?${q}`, token: vercel.token(creds),
    });

    return res.deployments.map((d) => {
      const finished = d.ready ?? null;
      const started = d.buildingAt ?? d.createdAt;
      return {
        externalId: d.uid,
        state: mapVercelState(d.readyState ?? d.state),
        environment: d.target === "production" ? "PRODUCTION" : "PREVIEW",
        branch: d.meta?.githubCommitRef ?? d.meta?.gitBranch ?? "main",
        commitSha: d.meta?.githubCommitSha ?? "",
        commitMessage: d.meta?.githubCommitMessage ?? "",
        commitAuthor: d.meta?.githubCommitAuthorName ?? "",
        url: d.url ? `https://${d.url}` : null,
        createdAt: new Date(d.createdAt).toISOString(),
        finishedAt: finished ? new Date(finished).toISOString() : null,
        durationMs: finished ? finished - started : null,
      };
    });
  },

  /** Placeholder for the future one-click redeploy. */
  async redeploy(): Promise<never> {
    throw new Error("Redeploy is not enabled yet — it lands with the Vercel write scope.");
  },
};

export const deploymentProviders = { github, vercel };
