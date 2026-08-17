import { Router, raw } from "express";
import { z } from "zod";
import { DeployState, ProviderName, type DeployEnvironment } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { notFound } from "../lib/errors.js";
import { audit } from "../lib/audit.js";
import { env } from "../env.js";
import { mask, verifyGithubSignature, verifyVercelSignature } from "../lib/crypto.js";
import { emitWorkspace } from "../realtime/io.js";
import {
  connectionsRepo, deploymentsRepo, projectsRepo, syncRepo, webhookRepo,
  type ProjectWithDeployments,
} from "../repositories/deployments.repo.js";
import { github, vercel } from "../services/deployments/providers.js";
import { syncAllProjects, syncProject } from "../services/deployments/sync.js";

/* ------------------------------ Serializer ------------------------------ */

const lower = (v: string) => v.toLowerCase();

function serializeProject(p: ProjectWithDeployments) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    framework: p.framework,
    environment: lower(p.environment),
    repoUrl: p.repoUrl,
    repoName: p.repoName,
    defaultBranch: p.defaultBranch,
    vercelProject: p.vercelProject,
    productionUrl: p.productionUrl,
    previewUrl: p.previewUrl,
    customDomain: p.customDomain,
    notes: p.notes,
    state: p.state,
    source: p.source,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    lastDeployedAt: p.lastDeployedAt?.toISOString() ?? null,
    deployments: p.deployments.map((d) => ({
      id: d.id,
      number: d.number,
      state: d.state,
      environment: lower(d.environment),
      branch: d.branch,
      commitSha: d.commitSha,
      commitMessage: d.commitMessage,
      commitAuthor: d.commitAuthor,
      url: d.url,
      durationMs: d.durationMs,
      createdAt: d.createdAt.toISOString(),
      finishedAt: d.finishedAt?.toISOString() ?? null,
      logs: d.logs.map((l) => ({ at: l.at.toISOString(), level: l.level, message: l.message })),
    })),
  };
}

/* -------------------------------- Projects ------------------------------- */

export const deploymentRouter = Router();
deploymentRouter.use(requireAuth);

const projectBody = z.object({
  name: z.string().min(1, "Give the project a name"),
  description: z.string().default(""),
  repoUrl: z.string().url().refine((v) => /github\.com/i.test(v), "Must be a GitHub URL"),
  repoName: z.string().default(""),
  vercelProject: z.string().default(""),
  vercelProjectId: z.string().optional(),
  productionUrl: z.string().default(""),
  previewUrl: z.string().default(""),
  customDomain: z.string().default(""),
  framework: z.string().default("nextjs"),
  environment: z.enum(["PRODUCTION", "PREVIEW", "DEVELOPMENT"]).default("PRODUCTION"),
  defaultBranch: z.string().min(1).default("main"),
  state: z.nativeEnum(DeployState).default(DeployState.QUEUED),
  notes: z.string().default(""),
});

deploymentRouter.get("/projects", async (_req, res, next) => {
  try {
    const projects = await projectsRepo.list();
    res.json({ projects: projects.map(serializeProject) });
  } catch (err) {
    next(err);
  }
});

deploymentRouter.get("/projects/:id", async (req, res, next) => {
  try {
    const project = await projectsRepo.byId(req.params.id);
    if (!project) return next(notFound("Project not found"));
    res.json({ project: serializeProject(project) });
  } catch (err) {
    next(err);
  }
});

deploymentRouter.post("/projects", requireRole("TEAM"), validate(projectBody), async (req, res, next) => {
  try {
    const b = req.body as z.infer<typeof projectBody>;
    const repoName = b.repoName || (b.repoUrl.match(/github\.com[/:]([^/]+)\/([^/.\s]+)/i)?.slice(1, 3).join("/") ?? "");
    const project = await projectsRepo.create({
      ...b,
      repoName,
      environment: b.environment as DeployEnvironment,
      createdById: req.user!.sub,
      source: "manual",
    });
    audit(req, "project.create", "Project", project.id, { repoName });
    emitWorkspace("project:updated", serializeProject(project));
    res.status(201).json({ project: serializeProject(project) });
  } catch (err) {
    next(err);
  }
});

deploymentRouter.patch("/projects/:id", requireRole("TEAM"), validate(projectBody.partial()), async (req, res, next) => {
  try {
    const existing = await projectsRepo.byId(req.params.id);
    if (!existing) return next(notFound("Project not found"));
    const project = await projectsRepo.update(existing.id, req.body as Record<string, unknown>);
    audit(req, "project.update", "Project", project.id);
    emitWorkspace("project:updated", serializeProject(project));
    res.json({ project: serializeProject(project) });
  } catch (err) {
    next(err);
  }
});

deploymentRouter.delete("/projects/:id", requireRole("TEAM"), async (req, res, next) => {
  try {
    await projectsRepo.remove(req.params.id);
    audit(req, "project.delete", "Project", req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

/** Manual sync for one project or all of them. */
deploymentRouter.post("/projects/:id/sync", requireRole("TEAM"), async (req, res, next) => {
  try {
    const result = await syncProject(req.params.id, "manual");
    audit(req, "project.sync", "Project", req.params.id, result);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

deploymentRouter.post("/sync", requireRole("TEAM"), async (req, res, next) => {
  try {
    const result = await syncAllProjects("manual");
    audit(req, "deployments.sync_all", "Project", undefined, result);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

deploymentRouter.get("/sync-history", async (_req, res, next) => {
  try {
    res.json({ history: await syncRepo.recent() });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------ Connections ------------------------------ */

const providerParam = z.object({ provider: z.enum(["github", "vercel"]) });
const toEnum = (p: string) => (p === "github" ? ProviderName.GITHUB : ProviderName.VERCEL);

/** Connection status — credentials are never returned, only masked hints. */
deploymentRouter.get("/connections", async (_req, res, next) => {
  try {
    const [gh, vc] = await Promise.all([
      connectionsRepo.get(ProviderName.GITHUB),
      connectionsRepo.get(ProviderName.VERCEL),
    ]);
    const shape = (row: Awaited<ReturnType<typeof connectionsRepo.get>>, envToken?: string, scopes: string[] = []) => ({
      status: row?.status ?? (envToken ? "CONNECTED" : "NOT_CONNECTED"),
      webhookActive: row?.webhookActive ?? false,
      oauthAuthorized: row?.oauthAuthorized ?? false,
      lastSyncAt: row?.lastSyncAt ?? null,
      lastError: row?.lastError ?? null,
      scopes: row?.scopes?.length ? row.scopes : scopes,
      tokenHint: mask(envToken),
    });
    res.json({
      github: shape(gh, env.GITHUB_TOKEN, github.scopes),
      vercel: shape(vc, env.VERCEL_TOKEN, vercel.scopes),
    });
  } catch (err) {
    next(err);
  }
});

const credentialsBody = z.object({
  token: z.string().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  webhookSecret: z.string().optional(),
  teamId: z.string().optional(),
  projectId: z.string().optional(),
});

/** Stores credentials encrypted. Write-only — they are never read back. */
deploymentRouter.put(
  "/connections/:provider/credentials",
  requireRole("TEAM"),
  validate(providerParam, "params"),
  validate(credentialsBody),
  async (req, res, next) => {
    try {
      const provider = toEnum(req.params.provider);
      const scopes = req.params.provider === "github" ? github.scopes : vercel.scopes;
      await connectionsRepo.saveCredentials(provider, req.body as z.infer<typeof credentialsBody>, scopes);
      audit(req, "connection.credentials_saved", "ProviderConnection", req.params.provider);
      res.json({ ok: true, provider: req.params.provider });
    } catch (err) {
      next(err);
    }
  }
);

deploymentRouter.post("/connections/:provider/test", validate(providerParam, "params"), async (req, res, next) => {
  try {
    const key = req.params.provider as "github" | "vercel";
    const creds = await connectionsRepo.credentials(toEnum(key));
    const result = key === "github" ? await github.check(creds) : await vercel.check(creds);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

deploymentRouter.post("/connections/:provider/disconnect", requireRole("TEAM"), validate(providerParam, "params"), async (req, res, next) => {
  try {
    await connectionsRepo.disconnect(toEnum(req.params.provider as "github" | "vercel"));
    audit(req, "connection.disconnect", "ProviderConnection", req.params.provider);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/** OAuth step 1 for GitHub sign-in (Vercel uses a token). */
deploymentRouter.get("/connections/github/auth-url", (req, res) => {
  const redirect = `${env.OAUTH_REDIRECT_BASE ?? "http://localhost:4000/api/deployments/callback"}/github`;
  const state = Math.random().toString(36).slice(2);
  res.json({ url: github.authorizeUrl(state, redirect), state, scopes: github.scopes });
});

/* -------------------------------- Webhooks ------------------------------- */
/**
 * Mounted separately with a raw body parser so signatures can be verified
 * against the exact bytes GitHub/Vercel sent. No auth — the signature is
 * the credential.
 */
export const webhookRouter = Router();

webhookRouter.post("/github", raw({ type: "*/*", limit: "2mb" }), async (req, res) => {
  const rawBody = req.body instanceof Buffer ? req.body.toString("utf8") : "";
  const signature = req.get("x-hub-signature-256");
  const eventType = req.get("x-github-event") ?? "unknown";
  const deliveryId = req.get("x-github-delivery") ?? null;
  const secret = env.GITHUB_WEBHOOK_SECRET ?? "";

  const verified = secret ? verifyGithubSignature(rawBody, signature, secret) : false;
  if (secret && !verified) return res.status(401).json({ error: { code: "BAD_SIGNATURE", message: "Invalid signature" } });

  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(rawBody); } catch { /* keep empty */ }

  let stored: Awaited<ReturnType<typeof webhookRepo.record>> = null;
  try {
    stored = await webhookRepo.record(ProviderName.GITHUB, eventType, deliveryId, payload, verified);
    if (!stored) return res.json({ ok: true, duplicate: true });

    if (eventType === "push") {
      const repoName = (payload.repository as { full_name?: string })?.full_name ?? "";
      const project = repoName ? await projectsRepo.byRepo(repoName) : null;
      if (project) {
        const head = (payload.head_commit as { id?: string; message?: string; author?: { name?: string } }) ?? {};
        const branch = String(payload.ref ?? "").replace("refs/heads/", "") || project.defaultBranch;
        const deployment = await deploymentsRepo.record(project.id, {
          state: DeployState.BUILDING,
          branch,
          commitSha: head.id ?? "",
          commitMessage: head.message?.split("\n")[0] ?? "",
          commitAuthor: head.author?.name ?? "",
        });
        await projectsRepo.update(project.id, { state: DeployState.BUILDING });
        emitWorkspace("deployment:updated", { projectId: project.id, deployment });
      }
    }
    await webhookRepo.markProcessed(stored.id);
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "processing failed";
    if (stored) await webhookRepo.markProcessed(stored.id, message).catch(() => undefined);
    console.error("[webhook:github]", message);
    // 202 tells the provider "received, don't retry forever".
    res.status(202).json({ ok: false, error: message });
  }
});

webhookRouter.post("/vercel", raw({ type: "*/*", limit: "2mb" }), async (req, res) => {
  const rawBody = req.body instanceof Buffer ? req.body.toString("utf8") : "";
  const signature = req.get("x-vercel-signature");
  const secret = env.VERCEL_WEBHOOK_SECRET ?? "";

  const verified = secret ? verifyVercelSignature(rawBody, signature, secret) : false;
  if (secret && !verified) return res.status(401).json({ error: { code: "BAD_SIGNATURE", message: "Invalid signature" } });

  let payload: { id?: string; type?: string; payload?: Record<string, unknown> } = {};
  try { payload = JSON.parse(rawBody); } catch { /* keep empty */ }

  const eventType = payload.type ?? "unknown";
  let stored: Awaited<ReturnType<typeof webhookRepo.record>> = null;

  try {
    stored = await webhookRepo.record(ProviderName.VERCEL, eventType, payload.id ?? null, payload, verified);
    if (!stored) return res.json({ ok: true, duplicate: true });

    const body = payload.payload ?? {};
    const deploymentInfo = (body.deployment ?? {}) as { id?: string; url?: string; meta?: Record<string, string> };
    const projectInfo = (body.project ?? {}) as { id?: string };

    const project = projectInfo.id ? await projectsRepo.byVercelProjectId(projectInfo.id) : null;
    if (project) {
      const state =
        eventType.includes("succeeded") || eventType.includes("ready") ? DeployState.READY
        : eventType.includes("error") || eventType.includes("failed") ? DeployState.ERROR
        : eventType.includes("canceled") ? DeployState.CANCELED
        : DeployState.BUILDING;

      const deployment = await deploymentsRepo.record(project.id, {
        externalId: deploymentInfo.id ?? null,
        state,
        branch: deploymentInfo.meta?.githubCommitRef ?? project.defaultBranch,
        commitSha: deploymentInfo.meta?.githubCommitSha ?? "",
        commitMessage: deploymentInfo.meta?.githubCommitMessage ?? "",
        commitAuthor: deploymentInfo.meta?.githubCommitAuthorName ?? "",
        url: deploymentInfo.url ? `https://${deploymentInfo.url}` : null,
        finishedAt: state === DeployState.READY || state === DeployState.ERROR ? new Date() : null,
      });

      await projectsRepo.update(project.id, {
        state,
        lastDeployedAt: new Date(),
        ...(state === DeployState.READY && deploymentInfo.url ? { productionUrl: `https://${deploymentInfo.url}` } : {}),
      });

      emitWorkspace("deployment:updated", { projectId: project.id, deployment });
    }

    await webhookRepo.markProcessed(stored.id);
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "processing failed";
    if (stored) await webhookRepo.markProcessed(stored.id, message).catch(() => undefined);
    console.error("[webhook:vercel]", message);
    res.status(202).json({ ok: false, error: message });
  }
});

