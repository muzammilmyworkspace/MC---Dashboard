/* ------------------------------------------------------------------ *
 *  MC Nexus — Deployment Center
 *  Projects, deployments and provider connections.
 *
 *  Mirrors the API shapes in server/src/routes/projects.routes.ts so the
 *  store can be swapped for `api.projects.*` without touching the UI.
 * ------------------------------------------------------------------ */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DeploymentState = "READY" | "BUILDING" | "QUEUED" | "ERROR" | "CANCELED";
export type Environment = "production" | "preview" | "development";
export type Framework = "nextjs" | "react" | "astro" | "vite" | "html" | "other";

export const frameworkLabel: Record<Framework, string> = {
  nextjs: "Next.js",
  react: "React",
  astro: "Astro",
  vite: "Vite",
  html: "HTML",
  other: "Other",
};

export const stateMeta: Record<DeploymentState, { label: string; tone: "success" | "warning" | "danger" | "muted"; color: string }> = {
  READY: { label: "Live", tone: "success", color: "#16a34a" },
  BUILDING: { label: "Building", tone: "warning", color: "#d97706" },
  QUEUED: { label: "Queued", tone: "muted", color: "#667085" },
  ERROR: { label: "Failed", tone: "danger", color: "#e5484d" },
  CANCELED: { label: "Canceled", tone: "muted", color: "#667085" },
};

export interface Deployment {
  id: string;
  number: number;
  state: DeploymentState;
  environment: Environment;
  branch: string;
  commitSha: string;
  commitMessage: string;
  commitAuthor: string;
  url: string | null;
  durationMs: number | null;
  createdAt: string;
  finishedAt: string | null;
  logs: { at: string; level: "info" | "warn" | "error"; message: string }[];
}

export interface Project {
  id: string;
  name: string;
  description: string;
  framework: Framework;
  environment: Environment;
  repoUrl: string;
  repoName: string;
  defaultBranch: string;
  vercelProject: string;
  productionUrl: string;
  previewUrl: string;
  customDomain: string;
  notes: string;
  state: DeploymentState;
  source: "manual" | "github" | "vercel";
  createdAt: string;
  updatedAt: string;
  lastDeployedAt: string | null;
  deployments: Deployment[];
}

export type ProviderKey = "github" | "vercel";

export interface ProviderConnection {
  status: "connected" | "not_connected";
  lastSync: string | null;
  webhook: "active" | "inactive";
  oauth: "authorized" | "not_authorized";
}

/** Field definitions for the Environment Variables page (values never rendered back in full). */
export interface CredentialField {
  key: string;
  label: string;
  hint: string;
  secret?: boolean;
  required?: boolean;
  placeholder?: string;
}

export const providerCredentials: Record<ProviderKey, { name: string; scopes: string[]; envVars: string[]; docsUrl: string; fields: CredentialField[] }> = {
  github: {
    name: "GitHub",
    scopes: ["repo", "read:org", "admin:repo_hook"],
    envVars: ["GITHUB_TOKEN", "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "GITHUB_WEBHOOK_SECRET"],
    docsUrl: "https://docs.github.com/rest",
    fields: [
      { key: "token", label: "Personal access token", hint: "Fine-grained token with repo + webhook access.", secret: true, required: true, placeholder: "github_pat_…" },
      { key: "clientId", label: "OAuth client ID", hint: "From your GitHub OAuth App — only needed for sign-in-with-GitHub." },
      { key: "clientSecret", label: "OAuth client secret", hint: "Kept server-side and never returned to the browser.", secret: true },
      { key: "webhookSecret", label: "Webhook secret", hint: "Used to verify each webhook signature.", secret: true },
    ],
  },
  vercel: {
    name: "Vercel",
    scopes: ["projects:read", "deployments:read", "domains:read"],
    envVars: ["VERCEL_TOKEN", "VERCEL_TEAM_ID", "VERCEL_PROJECT_ID", "VERCEL_WEBHOOK_SECRET"],
    docsUrl: "https://vercel.com/docs/rest-api",
    fields: [
      { key: "token", label: "Vercel API token", hint: "Account Settings → Tokens. Read access is enough.", secret: true, required: true, placeholder: "vercel_…" },
      { key: "teamId", label: "Team ID", hint: "Leave blank for a personal account.", placeholder: "team_…" },
      { key: "projectId", label: "Default project ID", hint: "Optional — used when a project has no ID of its own.", placeholder: "prj_…" },
      { key: "webhookSecret", label: "Webhook secret", hint: "Verifies deployment events sent by Vercel.", secret: true },
    ],
  },
};

/* --------------------------------- Store -------------------------------- */

export interface ProjectInput {
  name: string;
  description: string;
  repoUrl: string;
  vercelProject: string;
  productionUrl: string;
  previewUrl: string;
  customDomain: string;
  framework: Framework;
  environment: Environment;
  defaultBranch: string;
  state: DeploymentState;
  notes: string;
}

interface DeploymentStore {
  projects: Project[];
  connections: Record<ProviderKey, ProviderConnection>;
  credentials: Record<string, Record<string, string>>;
  lastSyncedAt: string | null;

  addProject: (input: ProjectInput) => Project;
  updateProject: (id: string, patch: Partial<Project>) => void;
  removeProject: (id: string) => void;
  getProject: (id: string) => Project | undefined;

  recordDeployment: (projectId: string, d: Omit<Deployment, "id" | "number">) => void;

  setCredential: (provider: ProviderKey, field: string, value: string) => void;
  connectProvider: (provider: ProviderKey) => { ok: boolean; message: string };
  disconnectProvider: (provider: ProviderKey) => void;
  markSynced: () => void;
}

const emptyConnection: ProviderConnection = { status: "not_connected", lastSync: null, webhook: "inactive", oauth: "not_authorized" };

/** Derives `owner/repo` from any GitHub URL shape. */
export function repoNameFromUrl(url: string) {
  const m = url.match(/github\.com[/:]([^/]+)\/([^/.\s]+)/i);
  return m ? `${m[1]}/${m[2]}` : "";
}

export const useDeployments = create<DeploymentStore>()(
  persist(
    (set, get) => ({
      projects: [],
      connections: { github: { ...emptyConnection }, vercel: { ...emptyConnection } },
      credentials: {},
      lastSyncedAt: null,

      addProject: (input) => {
        const now = new Date().toISOString();
        const project: Project = {
          ...input,
          id: crypto.randomUUID(),
          repoName: repoNameFromUrl(input.repoUrl),
          source: "manual",
          createdAt: now,
          updatedAt: now,
          lastDeployedAt: null,
          deployments: [],
        };
        set((s) => ({ projects: [project, ...s.projects] }));
        return project;
      },

      updateProject: (id, patch) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id
              ? { ...p, ...patch, repoName: patch.repoUrl ? repoNameFromUrl(patch.repoUrl) : p.repoName, updatedAt: new Date().toISOString() }
              : p
          ),
        })),

      removeProject: (id) => set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),
      getProject: (id) => get().projects.find((p) => p.id === id),

      recordDeployment: (projectId, d) =>
        set((s) => ({
          projects: s.projects.map((p) => {
            if (p.id !== projectId) return p;
            const deployment: Deployment = { ...d, id: crypto.randomUUID(), number: p.deployments.length + 1 };
            return {
              ...p,
              state: d.state,
              lastDeployedAt: d.createdAt,
              updatedAt: new Date().toISOString(),
              deployments: [deployment, ...p.deployments],
            };
          }),
        })),

      setCredential: (provider, field, value) =>
        set((s) => ({ credentials: { ...s.credentials, [provider]: { ...(s.credentials[provider] ?? {}), [field]: value } } })),

      connectProvider: (provider) => {
        const cfg = providerCredentials[provider];
        const creds = get().credentials[provider] ?? {};
        const missing = cfg.fields.filter((f) => f.required && !creds[f.key]?.trim()).map((f) => f.label);
        if (missing.length) return { ok: false, message: `Missing: ${missing.join(", ")}` };

        set((s) => ({
          connections: {
            ...s.connections,
            [provider]: { status: "connected", lastSync: new Date().toISOString(), webhook: "active", oauth: "authorized" },
          },
        }));
        return { ok: true, message: `${cfg.name} connected` };
      },

      disconnectProvider: (provider) =>
        set((s) => ({ connections: { ...s.connections, [provider]: { ...emptyConnection } } })),

      markSynced: () =>
        set((s) => ({
          lastSyncedAt: new Date().toISOString(),
          connections: Object.fromEntries(
            Object.entries(s.connections).map(([k, v]) => [k, v.status === "connected" ? { ...v, lastSync: new Date().toISOString() } : v])
          ) as Record<ProviderKey, ProviderConnection>,
        })),
    }),
    { name: "mc-nexus-deployments-v1" }
  )
);

export const emptyProjectInput: ProjectInput = {
  name: "", description: "", repoUrl: "", vercelProject: "", productionUrl: "", previewUrl: "",
  customDomain: "", framework: "nextjs", environment: "production", defaultBranch: "main",
  state: "READY", notes: "",
};

export function formatDuration(ms: number | null) {
  if (ms == null) return "—";
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}
