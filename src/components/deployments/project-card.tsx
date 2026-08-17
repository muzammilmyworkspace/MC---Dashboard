"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";
import {
  MoreHorizontal, ExternalLink, Copy, GitBranch, Clock, History, Trash2, Pencil,
  Globe, Eye, GitCommitHorizontal, RotateCw,
} from "lucide-react";
import { stateMeta, frameworkLabel, type Project, useDeployments } from "@/lib/deployments";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/page-shell";
import { relativeTime, cn } from "@/lib/utils";

export function ProjectCard({ project, onEdit }: { project: Project; onEdit: (p: Project) => void }) {
  const router = useRouter();
  const removeProject = useDeployments((s) => s.removeProject);
  const meta = stateMeta[project.state];
  const latest = project.deployments[0];

  async function copy(text: string, label: string) {
    if (!text) return toast.error(`No ${label} set`);
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  }
  function openExternal(url: string, label: string) {
    if (!url) return toast.error(`No ${label} set for this project`);
    window.open(url.startsWith("http") ? url : `https://${url}`, "_blank", "noopener,noreferrer");
  }

  return (
    <Card className="group flex flex-col p-5 transition-all hover:-translate-y-0.5 hover:shadow-glow">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <Link href={`/deployments/${project.id}`} className="block truncate text-sm font-semibold hover:text-accent">
            {project.name}
          </Link>
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{project.description || "No description"}</p>
        </div>
        <StatusPill tone={meta.tone}>
          <span className={cn("size-1.5 rounded-full", project.state === "BUILDING" && "animate-pulse")} style={{ background: meta.color }} />
          {meta.label}
        </StatusPill>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button aria-label="Project actions" className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={6} className="z-50 w-56 rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-card">
              <Item onSelect={() => openExternal(project.productionUrl, "production URL")}><Globe className="size-4" /> Open live website</Item>
              <Item onSelect={() => openExternal(project.previewUrl, "preview URL")}><Eye className="size-4" /> Open preview</Item>
              <Item onSelect={() => openExternal(project.repoUrl, "repository")}><GitBranch className="size-4" /> Open GitHub repository</Item>
              <Item onSelect={() => openExternal(project.vercelProject ? `https://vercel.com/${project.vercelProject}` : "", "Vercel project")}><ExternalLink className="size-4" /> Open Vercel project</Item>
              <Sep />
              <Item onSelect={() => copy(project.productionUrl, "Production URL")}><Copy className="size-4" /> Copy production URL</Item>
              <Item onSelect={() => copy(project.previewUrl, "Preview URL")}><Copy className="size-4" /> Copy preview URL</Item>
              <Sep />
              <Item onSelect={() => router.push(`/deployments/${project.id}`)}><History className="size-4" /> Deployment history</Item>
              <Item onSelect={() => onEdit(project)}><Pencil className="size-4" /> Edit project</Item>
              <Item onSelect={() => toast("Redeploy", { description: "Available once the Vercel token is connected." })}><RotateCw className="size-4" /> Redeploy</Item>
              <Sep />
              <Item danger onSelect={() => { removeProject(project.id); toast("Project removed"); }}><Trash2 className="size-4" /> Delete project</Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {/* Latest commit */}
      <div className="mt-4 rounded-xl border border-border bg-muted/25 p-3">
        {latest ? (
          <>
            <p className="flex items-center gap-1.5 text-xs font-medium">
              <GitCommitHorizontal className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{latest.commitMessage}</span>
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {latest.commitAuthor} · <span className="font-mono">{latest.commitSha.slice(0, 7)}</span>
            </p>
          </>
        ) : (
          <p className="text-[11px] text-muted-foreground">No deployments recorded yet — connect GitHub &amp; Vercel to sync automatically.</p>
        )}
      </div>

      {/* Meta grid */}
      <dl className="mt-4 grid flex-1 grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
        <Meta label="Branch"><span className="flex items-center gap-1 font-mono text-[11px]"><GitBranch className="size-3" />{project.defaultBranch}</span></Meta>
        <Meta label="Framework">{frameworkLabel[project.framework]}</Meta>
        <Meta label="Repository"><span className="truncate font-mono text-[11px]">{project.repoName || "—"}</span></Meta>
        <Meta label="Environment"><span className="capitalize">{project.environment}</span></Meta>
        <Meta label="Last deployed">
          <span className="flex items-center gap-1"><Clock className="size-3" />{project.lastDeployedAt ? relativeTime(project.lastDeployedAt) : "Never"}</span>
        </Meta>
        <Meta label="Domain"><span className="truncate">{project.customDomain || project.productionUrl.replace(/^https?:\/\//, "") || "—"}</span></Meta>
      </dl>

      {/* Footer actions */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => openExternal(project.productionUrl, "production URL")}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:border-accent/50 hover:text-accent"
        >
          <Globe className="size-3.5" /> Visit
        </button>
        <Link
          href={`/deployments/${project.id}`}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
        >
          Details
        </Link>
      </div>
    </Card>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate font-medium">{children}</dd>
    </div>
  );
}

function Item({ children, onSelect, danger }: { children: React.ReactNode; onSelect: () => void; danger?: boolean }) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm outline-none transition-colors data-[highlighted]:bg-muted",
        danger && "text-danger data-[highlighted]:bg-danger/10"
      )}
    >
      {children}
    </DropdownMenu.Item>
  );
}
const Sep = () => <div className="my-1 h-px bg-border" />;
