import "server-only";
import { LandingPageSource, LandingPageStatus, type LandingPage } from "@prisma/client";
import { prisma } from "./prisma";
import { vercelConfigured, vercelMissingEnv } from "./vercel/client";
import { getProject, listAvailableProjects, type AvailableProject } from "./vercel/projects";

/* ------------------------------------------------------------------ *
 *  Landing Pages
 *
 *  A hand-picked list. The single rule this module exists to enforce:
 *  nothing enters the list except through an explicit import call
 *  carrying the ids the user ticked. Listing and refreshing can read
 *  anything from Vercel but can never add a row.
 * ------------------------------------------------------------------ */

export interface LandingPageDto {
  id: string;
  name: string;
  source: "VERCEL" | "MANUAL";
  vercelProjectId: string | null;
  vercelProjectName: string;
  productionUrl: string;
  previewUrl: string;
  deploymentId: string | null;
  status: LandingPageStatus;
  framework: string;
  environment: string;
  description: string;
  lastDeploymentAt: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
}

export function toDto(row: LandingPage): LandingPageDto {
  return {
    id: row.id,
    name: row.name,
    source: row.source,
    vercelProjectId: row.vercelProjectId,
    vercelProjectName: row.vercelProjectName,
    productionUrl: row.productionUrl,
    previewUrl: row.previewUrl,
    deploymentId: row.deploymentId,
    status: row.status,
    framework: row.framework,
    environment: row.environment,
    description: row.description,
    lastDeploymentAt: row.lastDeploymentAt?.toISOString() ?? null,
    lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listLandingPages(): Promise<LandingPageDto[]> {
  const rows = await prisma.landingPage.findMany({
    where: { isSelected: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toDto);
}

export async function getLandingPage(id: string): Promise<LandingPageDto | null> {
  const row = await prisma.landingPage.findUnique({ where: { id } });
  return row ? toDto(row) : null;
}

/* --------------------------------- import -------------------------------- */

export interface ImportResult {
  imported: number;
  skipped: number;
  pages: LandingPageDto[];
}

/**
 * Imports exactly the projects named by `vercelProjectIds` — nothing else.
 *
 * The available list is fetched only to look up each id's metadata; ids that
 * are not in it are ignored rather than trusted, so a crafted request cannot
 * create a row pointing at a project the token cannot actually see.
 */
export async function importProjects(vercelProjectIds: string[], userId: string | null): Promise<ImportResult> {
  const wanted = new Set(vercelProjectIds);
  if (wanted.size === 0) return { imported: 0, skipped: 0, pages: [] };

  const available = await listAvailableProjects();
  const byId = new Map(available.map((p) => [p.vercelProjectId, p]));

  const pages: LandingPageDto[] = [];
  let imported = 0;
  let skipped = 0;

  for (const id of wanted) {
    const project = byId.get(id);
    if (!project) {
      skipped++;
      continue;
    }

    // Upsert rather than create: re-importing a page that was previously
    // removed should restore it, not fail on the unique constraint.
    const row = await prisma.landingPage.upsert({
      where: { vercelProjectId: id },
      create: {
        name: project.name,
        source: LandingPageSource.VERCEL,
        vercelProjectId: id,
        vercelProjectName: project.name,
        productionUrl: project.productionUrl,
        deploymentId: project.deploymentId,
        status: project.status,
        framework: project.framework,
        environment: project.environment,
        lastDeploymentAt: project.lastDeploymentAt ? new Date(project.lastDeploymentAt) : null,
        lastSyncedAt: new Date(),
        isSelected: true,
        createdById: userId,
      },
      update: {
        // The user's own name and description survive a re-import; everything
        // Vercel owns is refreshed.
        vercelProjectName: project.name,
        productionUrl: project.productionUrl,
        deploymentId: project.deploymentId,
        status: project.status,
        framework: project.framework,
        environment: project.environment,
        lastDeploymentAt: project.lastDeploymentAt ? new Date(project.lastDeploymentAt) : null,
        lastSyncedAt: new Date(),
        isSelected: true,
      },
    });

    imported++;
    pages.push(toDto(row));
  }

  return { imported, skipped, pages };
}

/* --------------------------------- refresh -------------------------------- */

export interface RefreshResult {
  refreshed: number;
  failed: number;
  pages: LandingPageDto[];
}

/**
 * Re-reads deployment state for tracked Vercel pages.
 *
 * Never adds a row. A project that has disappeared from Vercel is marked
 * UNKNOWN and kept — deleting the user's curated entry because an API call
 * failed would lose a choice they made deliberately.
 */
export async function refreshPages(ids?: string[]): Promise<RefreshResult> {
  const rows = await prisma.landingPage.findMany({
    where: {
      isSelected: true,
      source: LandingPageSource.VERCEL,
      ...(ids?.length ? { id: { in: ids } } : {}),
    },
  });

  const pages: LandingPageDto[] = [];
  let refreshed = 0;
  let failed = 0;

  for (const row of rows) {
    if (!row.vercelProjectId) continue;
    let project: AvailableProject;
    try {
      project = await getProject(row.vercelProjectId);
    } catch (err) {
      failed++;
      console.error(`[landing-pages] refresh failed for ${row.vercelProjectId}: ${err instanceof Error ? err.message : err}`);
      const marked = await prisma.landingPage.update({
        where: { id: row.id },
        data: { status: LandingPageStatus.UNKNOWN, lastSyncedAt: new Date() },
      });
      pages.push(toDto(marked));
      continue;
    }

    const updated = await prisma.landingPage.update({
      where: { id: row.id },
      data: {
        vercelProjectName: project.name,
        // An empty productionUrl means Vercel had no alias to give; keeping
        // the previous one beats blanking a working link.
        ...(project.productionUrl ? { productionUrl: project.productionUrl } : {}),
        deploymentId: project.deploymentId,
        status: project.status,
        framework: project.framework,
        lastDeploymentAt: project.lastDeploymentAt ? new Date(project.lastDeploymentAt) : row.lastDeploymentAt,
        lastSyncedAt: new Date(),
      },
    });
    refreshed++;
    pages.push(toDto(updated));
  }

  return { refreshed, failed, pages };
}

/* ------------------------------ availability ------------------------------ */

export interface AvailabilityResult {
  configured: boolean;
  missingEnv: string[];
  projects: AvailableProject[];
  /** Ids already in MC Nexus, so the modal can show them as already added. */
  alreadyImported: string[];
}

export async function availableProjects(): Promise<AvailabilityResult> {
  if (!vercelConfigured()) {
    return { configured: false, missingEnv: vercelMissingEnv(), projects: [], alreadyImported: [] };
  }

  const [projects, existing] = await Promise.all([
    listAvailableProjects(),
    prisma.landingPage.findMany({
      where: { vercelProjectId: { not: null }, isSelected: true },
      select: { vercelProjectId: true },
    }),
  ]);

  return {
    configured: true,
    missingEnv: [],
    projects,
    alreadyImported: existing.map((e) => e.vercelProjectId).filter((v): v is string => Boolean(v)),
  };
}

/* --------------------------------- manual --------------------------------- */

export interface ManualInput {
  name: string;
  productionUrl: string;
  description?: string;
  status?: LandingPageStatus;
}

export async function createManualPage(input: ManualInput, userId: string | null): Promise<LandingPageDto> {
  const row = await prisma.landingPage.create({
    data: {
      name: input.name,
      source: LandingPageSource.MANUAL,
      productionUrl: input.productionUrl,
      description: input.description ?? "",
      status: input.status ?? LandingPageStatus.LIVE,
      environment: "production",
      isSelected: true,
      createdById: userId,
    },
  });
  return toDto(row);
}

/* --------------------------------- remove --------------------------------- */

/**
 * Removes the page from MC Nexus only.
 *
 * A hard delete of our own row — it holds no credential and nothing in Vercel
 * is touched. The Vercel project keeps running exactly as before.
 */
export async function removeLandingPage(id: string): Promise<boolean> {
  const existing = await prisma.landingPage.findUnique({ where: { id } });
  if (!existing) return false;
  await prisma.landingPage.delete({ where: { id } });
  return true;
}

export async function updateLandingPage(
  id: string,
  patch: Partial<Pick<LandingPage, "name" | "description" | "productionUrl" | "previewUrl" | "status" | "isSelected">>
): Promise<LandingPageDto | null> {
  const existing = await prisma.landingPage.findUnique({ where: { id } });
  if (!existing) return null;
  const row = await prisma.landingPage.update({ where: { id }, data: patch });
  return toDto(row);
}
