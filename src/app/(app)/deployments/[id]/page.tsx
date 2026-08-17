"use client";

import { use, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft, ExternalLink, Copy, GitBranch, GitCommitHorizontal, History, Globe,
  TerminalSquare, ShieldCheck, Gauge, Search as SearchIcon, KeyRound, Pencil, RotateCw,
  Rocket, Clock, Activity, ServerCog,
} from "lucide-react";
import { useDeployments, stateMeta, frameworkLabel, formatDuration, type Project } from "@/lib/deployments";
import { ProjectDialog } from "@/components/deployments/project-dialog";
import { PageBody, PageHeader, SectionCard, EmptyState, StatusPill } from "@/components/ui/page-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { relativeTime, formatDate, cn } from "@/lib/utils";

const TABS = [
  { key: "overview", label: "Overview", icon: Activity },
  { key: "deployments", label: "Deployments", icon: History },
  { key: "logs", label: "Logs", icon: TerminalSquare },
  { key: "domains", label: "Domains", icon: Globe },
  { key: "settings", label: "Settings", icon: KeyRound },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const project = useDeployments((s) => s.projects.find((p) => p.id === id));
  const [tab, setTab] = useState<TabKey>("overview");
  const [editOpen, setEditOpen] = useState(false);

  if (!project) {
    return (
      <PageBody>
        <EmptyState
          icon={Rocket}
          title="Project not found"
          description="It may have been deleted, or the link is out of date."
          action={<Button asChild><Link href="/deployments"><ArrowLeft className="size-4" /> Back to Deployment Center</Link></Button>}
        />
      </PageBody>
    );
  }

  const meta = stateMeta[project.state];
  const latest = project.deployments[0];

  async function copy(text: string, label: string) {
    if (!text) return toast.error(`No ${label} set`);
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  }
  function open(url: string, label: string) {
    if (!url) return toast.error(`No ${label} set`);
    window.open(url.startsWith("http") ? url : `https://${url}`, "_blank", "noopener,noreferrer");
  }

  return (
    <PageBody>
      <Link href="/deployments" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" /> Deployment Center
      </Link>

      <PageHeader
        icon={ServerCog}
        eyebrow={project.repoName || "Project"}
        title={project.name}
        description={project.description || "No description yet."}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => open(project.productionUrl, "production URL")}>
              <Globe className="size-4" /> Visit
            </Button>
            <Button variant="secondary" size="sm" onClick={() => open(project.repoUrl, "repository")}>
              <GitBranch className="size-4" /> Repository
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" /> Edit
            </Button>
            <Button size="sm" onClick={() => toast("Redeploy", { description: "Available once the Vercel token is connected." })}>
              <RotateCw className="size-4" /> Redeploy
            </Button>
          </>
        }
      />

      {/* Status strip */}
      <Card className="flex flex-wrap items-center gap-x-8 gap-y-3 p-4">
        <Info label="Status">
          <StatusPill tone={meta.tone}>
            <span className={cn("size-1.5 rounded-full", project.state === "BUILDING" && "animate-pulse")} style={{ background: meta.color }} />
            {meta.label}
          </StatusPill>
        </Info>
        <Info label="Environment"><span className="text-sm font-medium capitalize">{project.environment}</span></Info>
        <Info label="Framework"><span className="text-sm font-medium">{frameworkLabel[project.framework]}</span></Info>
        <Info label="Branch"><span className="font-mono text-sm font-medium">{project.defaultBranch}</span></Info>
        <Info label="Last deployed"><span className="text-sm font-medium">{project.lastDeployedAt ? relativeTime(project.lastDeployedAt) : "Never"}</span></Info>
        <Info label="Build time"><span className="text-sm font-medium">{formatDuration(latest?.durationMs ?? null)}</span></Info>
      </Card>

      {/* Tabs */}
      <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
              tab === t.key ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <t.icon className="size-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <Overview project={project} onCopy={copy} onOpen={open} />}
      {tab === "deployments" && <Deployments project={project} />}
      {tab === "logs" && <Logs project={project} />}
      {tab === "domains" && <Domains project={project} onCopy={copy} onOpen={open} />}
      {tab === "settings" && <ProjectSettings project={project} />}

      <ProjectDialog open={editOpen} onOpenChange={setEditOpen} editing={project} />
    </PageBody>
  );
}

/* -------------------------------- Overview ------------------------------- */
function Overview({ project, onCopy, onOpen }: { project: Project; onCopy: (t: string, l: string) => void; onOpen: (u: string, l: string) => void }) {
  const latest = project.deployments[0];
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <SectionCard title="General information" icon={Activity}>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Row label="Project name" value={project.name} />
            <Row label="Vercel project" value={project.vercelProject || "—"} mono />
            <Row label="Repository" value={project.repoName || "—"} mono />
            <Row label="Production branch" value={project.defaultBranch} mono />
            <Row label="Created" value={formatDate(project.createdAt, { year: "numeric" })} />
            <Row label="Last updated" value={relativeTime(project.updatedAt)} />
            <Row label="Deployment ID" value={latest?.id.slice(0, 12) ?? "—"} mono />
            <Row label="Source" value={project.source === "manual" ? "Added manually" : `Synced from ${project.source}`} />
          </dl>
          {project.notes && (
            <div className="mt-4 rounded-xl border border-border bg-muted/25 p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Notes</p>
              <p className="mt-1 whitespace-pre-line text-sm">{project.notes}</p>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Deployment timeline" icon={History} description="Most recent activity first.">
          {project.deployments.length === 0 ? (
            <EmptyState icon={History} title="No deployments yet" description="Deployments appear here automatically once GitHub and Vercel are connected." className="border-0 bg-transparent py-8" />
          ) : (
            <ol className="relative space-y-4 before:absolute before:left-[7px] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-border">
              {project.deployments.slice(0, 6).map((d) => (
                <li key={d.id} className="relative flex gap-3">
                  <span className="z-10 mt-1.5 size-[15px] shrink-0 rounded-full border-2 border-card" style={{ background: stateMeta[d.state].color }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">#{d.number} · {stateMeta[d.state].label}</p>
                    <p className="truncate text-xs text-muted-foreground">{d.commitMessage}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{relativeTime(d.createdAt)} · {formatDuration(d.durationMs)}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>
      </div>

      <div className="space-y-5">
        <SectionCard title="GitHub" icon={GitBranch}>
          <dl className="space-y-3">
            <Row label="Repository" value={project.repoName || "Not linked"} mono />
            <Row label="Default branch" value={project.defaultBranch} mono />
            <Row label="Latest commit" value={latest?.commitMessage ?? "—"} />
            <Row label="Commit author" value={latest?.commitAuthor ?? "—"} />
            <Row label="Commit time" value={latest ? relativeTime(latest.createdAt) : "—"} />
            <Row label="Total deployments" value={String(project.deployments.length)} />
          </dl>
          <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={() => onOpen(project.repoUrl, "repository")}>
            <ExternalLink className="size-3.5" /> Open repository
          </Button>
        </SectionCard>

        <SectionCard title="Vercel" icon={Rocket}>
          <dl className="space-y-3">
            <Row label="Project" value={project.vercelProject || "Not linked"} mono />
            <Row label="Status" value={stateMeta[project.state].label} />
            <Row label="Environment" value={project.environment} />
            <Row label="Build time" value={formatDuration(latest?.durationMs ?? null)} />
            <Row label="Creator" value={latest?.commitAuthor ?? "—"} />
          </dl>
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" size="sm" className="flex-1" onClick={() => onOpen(project.vercelProject ? `https://vercel.com/${project.vercelProject}` : "", "Vercel project")}>
              <ExternalLink className="size-3.5" /> Vercel
            </Button>
            <Button variant="outline" size="sm" onClick={() => onCopy(project.productionUrl, "Production URL")}>
              <Copy className="size-3.5" />
            </Button>
          </div>
        </SectionCard>

        <SectionCard title="Performance & SEO" icon={Gauge} description="Lighthouse and SEO audits arrive with the Vercel integration.">
          <div className="grid grid-cols-2 gap-3">
            {["Performance", "Accessibility", "Best practices", "SEO"].map((m) => (
              <div key={m} className="rounded-xl border border-border bg-muted/20 p-3">
                <p className="text-[11px] text-muted-foreground">{m}</p>
                <p className="mt-1 text-lg font-semibold text-muted-foreground/50">—</p>
              </div>
            ))}
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground"><SearchIcon className="size-3" /> Runs automatically after each production deployment.</p>
        </SectionCard>
      </div>
    </div>
  );
}

/* ------------------------------ Deployments ------------------------------ */
function Deployments({ project }: { project: Project }) {
  return (
    <SectionCard title="Deployment history" icon={History} description="Every build recorded for this project.">
      {project.deployments.length === 0 ? (
        <EmptyState icon={History} title="No deployments recorded" description="Once GitHub pushes trigger Vercel builds, each deployment is stored here with its commit, duration and status." className="border-0 bg-transparent py-10" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3 font-medium">#</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Commit</th>
                <th className="py-2 pr-3 font-medium">Branch</th>
                <th className="py-2 pr-3 font-medium">Author</th>
                <th className="py-2 pr-3 font-medium">Duration</th>
                <th className="py-2 pr-3 font-medium">When</th>
                <th className="py-2 font-medium">Links</th>
              </tr>
            </thead>
            <tbody>
              {project.deployments.map((d) => (
                <tr key={d.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                  <td className="py-2.5 pr-3 font-mono text-xs">{d.number}</td>
                  <td className="py-2.5 pr-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: stateMeta[d.state].color }}>
                      <span className="size-1.5 rounded-full" style={{ background: stateMeta[d.state].color }} />
                      {stateMeta[d.state].label}
                    </span>
                  </td>
                  <td className="max-w-[220px] py-2.5 pr-3">
                    <span className="flex items-center gap-1.5"><GitCommitHorizontal className="size-3 shrink-0 text-muted-foreground" /><span className="truncate">{d.commitMessage}</span></span>
                  </td>
                  <td className="py-2.5 pr-3 font-mono text-xs">{d.branch}</td>
                  <td className="py-2.5 pr-3">{d.commitAuthor}</td>
                  <td className="py-2.5 pr-3">{formatDuration(d.durationMs)}</td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-muted-foreground">{relativeTime(d.createdAt)}</td>
                  <td className="py-2.5">
                    {d.url ? (
                      <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Open</a>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

/* --------------------------------- Logs ---------------------------------- */
function Logs({ project }: { project: Project }) {
  const latest = project.deployments[0];
  return (
    <SectionCard title="Build logs" icon={TerminalSquare} description={latest ? `Deployment #${latest.number}` : "No builds yet"}>
      {!latest || latest.logs.length === 0 ? (
        <EmptyState icon={TerminalSquare} title="No logs available" description="Build logs stream in from Vercel once the API token is connected." className="border-0 bg-transparent py-10" />
      ) : (
        <pre className="max-h-[420px] overflow-auto rounded-xl border border-border bg-[#0f1420] p-4 font-mono text-[12px] leading-relaxed text-slate-200">
          {latest.logs.map((l, i) => (
            <div key={i} className={cn(l.level === "error" && "text-red-400", l.level === "warn" && "text-amber-300")}>
              <span className="text-slate-500">{new Date(l.at).toLocaleTimeString()} </span>{l.message}
            </div>
          ))}
        </pre>
      )}
    </SectionCard>
  );
}

/* -------------------------------- Domains -------------------------------- */
function Domains({ project, onCopy, onOpen }: { project: Project; onCopy: (t: string, l: string) => void; onOpen: (u: string, l: string) => void }) {
  const rows = [
    { label: "Production", url: project.productionUrl, primary: true },
    { label: "Preview", url: project.previewUrl, primary: false },
    { label: "Custom domain", url: project.customDomain, primary: false },
  ].filter((r) => r.url);

  return (
    <SectionCard title="Domains" icon={Globe} description="Where this project is reachable.">
      {rows.length === 0 ? (
        <EmptyState icon={Globe} title="No domains set" description="Add a production or preview URL by editing this project." className="border-0 bg-transparent py-10" />
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-3 rounded-xl border border-border p-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">{r.label}</p>
                <p className="truncate font-mono text-sm">{r.url}</p>
              </div>
              <StatusPill tone="success"><ShieldCheck className="size-3" /> SSL</StatusPill>
              <Button variant="outline" size="sm" onClick={() => onCopy(r.url, `${r.label} URL`)}><Copy className="size-3.5" /></Button>
              <Button variant="secondary" size="sm" onClick={() => onOpen(r.url, r.label)}><ExternalLink className="size-3.5" /></Button>
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Clock className="size-3" /> Domain management and uptime monitoring arrive with the Vercel integration.
      </p>
    </SectionCard>
  );
}

/* ------------------------------- Settings -------------------------------- */
function ProjectSettings({ project }: { project: Project }) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <SectionCard title="Environment variables" icon={KeyRound} description="Values are stored encrypted on the server and never sent to the browser.">
        <EmptyState icon={KeyRound} title="No variables synced" description="Environment variables are pulled from Vercel once the API token is connected." className="border-0 bg-transparent py-8" />
      </SectionCard>
      <SectionCard title="Connected APIs" icon={ShieldCheck} description="Providers linked to this project.">
        <div className="space-y-2">
          {[
            { name: "GitHub", value: project.repoName || "Not linked" },
            { name: "Vercel", value: project.vercelProject || "Not linked" },
          ].map((r) => (
            <div key={r.name} className="flex items-center justify-between rounded-xl border border-border p-3">
              <span className="text-sm font-medium">{r.name}</span>
              <span className="truncate font-mono text-xs text-muted-foreground">{r.value}</span>
            </div>
          ))}
        </div>
        <Button variant="secondary" size="sm" className="mt-4 w-full" asChild>
          <Link href="/deployments/settings"><KeyRound className="size-3.5" /> Manage credentials</Link>
        </Button>
      </SectionCard>
    </div>
  );
}

/* -------------------------------- helpers -------------------------------- */
function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}
function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 truncate text-sm font-medium", mono && "font-mono text-[13px]")}>{value}</dd>
    </div>
  );
}
