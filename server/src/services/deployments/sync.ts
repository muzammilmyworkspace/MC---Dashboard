import { ProviderName } from "@prisma/client";
import { env } from "../../env.js";
import { emitWorkspace } from "../../realtime/io.js";
import { connectionsRepo, deploymentsRepo, projectsRepo, syncRepo } from "../../repositories/deployments.repo.js";
import { vercel } from "./providers.js";

/**
 * Synchronisation service.
 *
 * Webhooks are the primary path (instant). This poller is the fallback for
 * environments where webhooks can't reach the API — enable it by setting
 * DEPLOY_SYNC_INTERVAL_MS. It is safe to run alongside webhooks because
 * deployments are upserted by their external id.
 */

let timer: NodeJS.Timeout | null = null;
let running = false;

export async function syncProject(projectId: string, trigger = "manual") {
  const startedAt = Date.now();
  const run = await syncRepo.start(ProviderName.VERCEL, trigger, projectId);
  let count = 0;

  try {
    const project = await projectsRepo.byId(projectId);
    if (!project) throw new Error("Project not found");
    if (!project.vercelProjectId) throw new Error("Project has no Vercel project id");

    const creds = await connectionsRepo.credentials(ProviderName.VERCEL);
    const deployments = await vercel.listDeployments(project.vercelProjectId, creds);

    for (const d of deployments) {
      await deploymentsRepo.record(project.id, {
        externalId: d.externalId,
        state: d.state,
        environment: d.environment,
        branch: d.branch,
        commitSha: d.commitSha,
        commitMessage: d.commitMessage,
        commitAuthor: d.commitAuthor,
        url: d.url,
        durationMs: d.durationMs,
        createdAt: new Date(d.createdAt),
        finishedAt: d.finishedAt ? new Date(d.finishedAt) : null,
      });
      count++;
    }

    const latest = deployments[0];
    if (latest) {
      await projectsRepo.update(project.id, { state: latest.state, lastDeployedAt: new Date(latest.createdAt) });
    }

    await syncRepo.finish(run.id, true, count, startedAt);
    await connectionsRepo.markSynced(ProviderName.VERCEL);

    const fresh = await projectsRepo.byId(project.id);
    emitWorkspace("project:updated", fresh);
    return { ok: true, count };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    await syncRepo.finish(run.id, false, count, startedAt, message);
    await connectionsRepo.markSynced(ProviderName.VERCEL, message);
    return { ok: false, count, error: message };
  }
}

export async function syncAllProjects(trigger = "scheduler") {
  if (running) return { skipped: true };
  running = true;
  try {
    const projects = await projectsRepo.list();
    const targets = projects.filter((p) => p.vercelProjectId);
    const results = await Promise.allSettled(targets.map((p) => syncProject(p.id, trigger)));
    return { skipped: false, synced: results.filter((r) => r.status === "fulfilled").length, total: targets.length };
  } finally {
    running = false;
  }
}

/** Starts the polling fallback when DEPLOY_SYNC_INTERVAL_MS > 0. */
export function startSyncScheduler() {
  const interval = env.DEPLOY_SYNC_INTERVAL_MS;
  if (!interval || interval < 15_000) {
    console.log("  · deployment polling disabled (webhooks are the primary path)");
    return;
  }
  stopSyncScheduler();
  timer = setInterval(() => {
    void syncAllProjects("scheduler").catch((e) => console.error("[sync] scheduler error:", e?.message));
  }, interval);
  console.log(`  · deployment polling every ${Math.round(interval / 1000)}s`);
}

export function stopSyncScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}
