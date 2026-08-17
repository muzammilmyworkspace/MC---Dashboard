import { ProviderName, type DeployState, type Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { decryptJson, encryptJson } from "../lib/crypto.js";
import type { ProviderCredentials } from "../services/deployments/providers.js";

/**
 * Repository layer — the only place that talks to Prisma for the
 * Deployment Center. Services and routes depend on these functions,
 * never on the ORM directly.
 */

export const projectInclude = {
  deployments: {
    orderBy: { number: "desc" as const },
    take: 25,
    include: { logs: { orderBy: { at: "asc" as const }, take: 200 } },
  },
} satisfies Prisma.ProjectInclude;

export type ProjectWithDeployments = Prisma.ProjectGetPayload<{ include: typeof projectInclude }>;

export const projectsRepo = {
  list: () => prisma.project.findMany({ include: projectInclude, orderBy: { updatedAt: "desc" } }),
  byId: (id: string) => prisma.project.findUnique({ where: { id }, include: projectInclude }),
  byRepo: (repoName: string) => prisma.project.findFirst({ where: { repoName }, include: projectInclude }),
  byVercelProjectId: (vercelProjectId: string) =>
    prisma.project.findFirst({ where: { vercelProjectId }, include: projectInclude }),

  create: (data: Prisma.ProjectCreateInput) => prisma.project.create({ data, include: projectInclude }),
  update: (id: string, data: Prisma.ProjectUpdateInput) =>
    prisma.project.update({ where: { id }, data, include: projectInclude }),
  remove: (id: string) => prisma.project.delete({ where: { id } }),
};

export const deploymentsRepo = {
  /** Upserts by external id, assigning the next sequential number per project. */
  async record(projectId: string, input: {
    externalId?: string | null;
    state: DeployState;
    environment?: "PRODUCTION" | "PREVIEW" | "DEVELOPMENT";
    branch?: string;
    commitSha?: string;
    commitMessage?: string;
    commitAuthor?: string;
    url?: string | null;
    durationMs?: number | null;
    createdAt?: Date;
    finishedAt?: Date | null;
  }) {
    const existing = input.externalId
      ? await prisma.deployment.findFirst({ where: { projectId, externalId: input.externalId } })
      : null;

    if (existing) {
      return prisma.deployment.update({
        where: { id: existing.id },
        data: {
          state: input.state,
          url: input.url ?? existing.url,
          durationMs: input.durationMs ?? existing.durationMs,
          finishedAt: input.finishedAt ?? existing.finishedAt,
        },
      });
    }

    const last = await prisma.deployment.findFirst({ where: { projectId }, orderBy: { number: "desc" } });
    return prisma.deployment.create({
      data: {
        projectId,
        number: (last?.number ?? 0) + 1,
        externalId: input.externalId ?? null,
        state: input.state,
        environment: input.environment ?? "PRODUCTION",
        branch: input.branch ?? "main",
        commitSha: input.commitSha ?? "",
        commitMessage: input.commitMessage ?? "",
        commitAuthor: input.commitAuthor ?? "",
        url: input.url ?? null,
        durationMs: input.durationMs ?? null,
        createdAt: input.createdAt ?? new Date(),
        finishedAt: input.finishedAt ?? null,
      },
    });
  },

  addLog: (deploymentId: string, level: string, message: string) =>
    prisma.deploymentLog.create({ data: { deploymentId, level, message } }),
};

export const connectionsRepo = {
  get: (provider: ProviderName) => prisma.providerConnection.findUnique({ where: { provider } }),

  async credentials(provider: ProviderName): Promise<ProviderCredentials | undefined> {
    const row = await prisma.providerConnection.findUnique({ where: { provider } });
    if (!row?.credentialsEncrypted) return undefined;
    try {
      return decryptJson<ProviderCredentials>(row.credentialsEncrypted);
    } catch {
      return undefined;
    }
  },

  saveCredentials: (provider: ProviderName, creds: ProviderCredentials, scopes: string[]) =>
    prisma.providerConnection.upsert({
      where: { provider },
      create: { provider, credentialsEncrypted: encryptJson(creds), scopes, status: "CONNECTED", oauthAuthorized: true },
      update: { credentialsEncrypted: encryptJson(creds), scopes, status: "CONNECTED", oauthAuthorized: true, lastError: null },
    }),

  markSynced: (provider: ProviderName, error?: string) =>
    prisma.providerConnection.upsert({
      where: { provider },
      create: { provider, lastSyncAt: new Date(), lastError: error ?? null },
      update: { lastSyncAt: new Date(), lastError: error ?? null },
    }),

  disconnect: (provider: ProviderName) =>
    prisma.providerConnection.upsert({
      where: { provider },
      create: { provider, status: "NOT_CONNECTED" },
      update: { status: "NOT_CONNECTED", credentialsEncrypted: null, oauthAuthorized: false, webhookActive: false },
    }),

  setWebhook: (provider: ProviderName, active: boolean) =>
    prisma.providerConnection.upsert({
      where: { provider },
      create: { provider, webhookActive: active },
      update: { webhookActive: active },
    }),
};

export const webhookRepo = {
  /** Returns null when the event was already stored (replay protection). */
  async record(provider: ProviderName, eventType: string, externalId: string | null, payload: unknown, verified: boolean) {
    if (externalId) {
      const seen = await prisma.webhookEvent.findFirst({ where: { provider, externalId } });
      if (seen) return null;
    }
    return prisma.webhookEvent.create({
      data: { provider, eventType, externalId, verified, payload: payload as Prisma.InputJsonValue },
    });
  },

  markProcessed: (id: string, error?: string) =>
    prisma.webhookEvent.update({ where: { id }, data: { processed: !error, error: error ?? null } }),
};

export const syncRepo = {
  start: (provider: ProviderName, trigger: string, projectId?: string) =>
    prisma.syncHistory.create({ data: { provider, trigger, projectId: projectId ?? null } }),

  finish: (id: string, success: boolean, recordCount: number, startedAt: number, error?: string) =>
    prisma.syncHistory.update({
      where: { id },
      data: { success, recordCount, error: error ?? null, finishedAt: new Date(), durationMs: Date.now() - startedAt },
    }),

  recent: (limit = 20) => prisma.syncHistory.findMany({ orderBy: { startedAt: "desc" }, take: limit }),
};
