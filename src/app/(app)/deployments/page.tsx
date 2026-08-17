"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ServerCog, Plus, RefreshCw, Search, SlidersHorizontal, Rocket, KeyRound,
  GitBranch, CheckCircle2, XCircle,
} from "lucide-react";
import {
  useDeployments, stateMeta, frameworkLabel, providerCredentials,
  type DeploymentState, type Framework, type Project, type ProviderKey,
} from "@/lib/deployments";
import { ProjectCard } from "@/components/deployments/project-card";
import { ProjectDialog } from "@/components/deployments/project-dialog";
import { PageBody, PageHeader, EmptyState, StatusPill } from "@/components/ui/page-shell";
import { TextInput, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useRealtime } from "@/lib/realtime";
import { relativeTime, cn } from "@/lib/utils";

export default function DeploymentCenterPage() {
  const { projects, connections, lastSyncedAt, markSynced, recordDeployment } = useDeployments();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ state: "all", framework: "all", environment: "all", branch: "all" });
  const [syncing, setSyncing] = useState(false);

  /** Live deployment events pushed by the API (webhook → Socket.io). */
  useRealtime<{ projectId: string; deployment: Parameters<typeof recordDeployment>[1] }>("deployment:updated", (payload) => {
    if (!payload?.projectId) return;
    recordDeployment(payload.projectId, payload.deployment);
    const label = stateMeta[payload.deployment.state]?.label ?? "updated";
    if (payload.deployment.state === "READY") toast.success("Deployment successful");
    else if (payload.deployment.state === "ERROR") toast.error("Deployment failed");
    else toast(`Deployment ${label.toLowerCase()}`);
  });

  const branches = useMemo(() => Array.from(new Set(projects.map((p) => p.defaultBranch).filter(Boolean))), [projects]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (filters.state !== "all" && p.state !== filters.state) return false;
      if (filters.framework !== "all" && p.framework !== filters.framework) return false;
      if (filters.environment !== "all" && p.environment !== filters.environment) return false;
      if (filters.branch !== "all" && p.defaultBranch !== filters.branch) return false;
      if (!q) return true;
      return [p.name, p.description, p.repoName, p.defaultBranch, p.framework, p.customDomain, p.productionUrl, stateMeta[p.state].label]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [projects, query, filters]);

  function refresh() {
    setSyncing(true);
    setTimeout(() => {
      markSynced();
      setSyncing(false);
      const anyConnected = connections.github.status === "connected" || connections.vercel.status === "connected";
      if (anyConnected) toast.success("Synced", { description: "Deployment data is up to date." });
      else toast("Nothing to sync yet", { description: "Connect GitHub and Vercel to pull live deployments." });
    }, 700);
  }

  const live = projects.filter((p) => p.state === "READY").length;
  const failed = projects.filter((p) => p.state === "ERROR").length;
  const building = projects.filter((p) => p.state === "BUILDING" || p.state === "QUEUED").length;

  return (
    <PageBody>
      <PageHeader
        icon={ServerCog}
        eyebrow="Deployment Center"
        title="Deployment Center"
        description="Manage all landing pages, repositories and deployments from one place."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={refresh} disabled={syncing}>
              <RefreshCw className={cn("size-4", syncing && "animate-spin")} /> Refresh
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowFilters((v) => !v)}>
              <SlidersHorizontal className="size-4" /> Filter
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link href="/deployments/settings"><KeyRound className="size-4" /> Credentials</Link>
            </Button>
            <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="size-4" /> Add Project
            </Button>
          </>
        }
      />

      {/* Connection status */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {(["github", "vercel"] as ProviderKey[]).map((key) => (
          <ConnectionTile key={key} providerKey={key} />
        ))}
        <Card className="flex items-center gap-6 p-4">
          <Counter label="Live" value={live} color="#16a34a" />
          <Counter label="Building" value={building} color="#d97706" />
          <Counter label="Failed" value={failed} color="#e5484d" />
          <div className="ml-auto text-right">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Last sync</p>
            <p className="mt-1 text-sm font-medium">{lastSyncedAt ? relativeTime(lastSyncedAt) : "Never"}</p>
          </div>
        </Card>
      </div>

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search project, repository, branch, status, framework or domain…"
            className="h-11 pl-10"
          />
        </div>

        {showFilters && (
          <Card className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <FilterSelect label="Status" value={filters.state} onChange={(v) => setFilters((f) => ({ ...f, state: v }))}
              options={[["all", "All statuses"], ...(Object.keys(stateMeta) as DeploymentState[]).map((s) => [s, stateMeta[s].label] as [string, string])]} />
            <FilterSelect label="Framework" value={filters.framework} onChange={(v) => setFilters((f) => ({ ...f, framework: v }))}
              options={[["all", "All frameworks"], ...(Object.keys(frameworkLabel) as Framework[]).map((f) => [f, frameworkLabel[f]] as [string, string])]} />
            <FilterSelect label="Environment" value={filters.environment} onChange={(v) => setFilters((f) => ({ ...f, environment: v }))}
              options={[["all", "All environments"], ["production", "Production"], ["preview", "Preview"], ["development", "Development"]] as [string, string][]} />
            <FilterSelect label="Branch" value={filters.branch} onChange={(v) => setFilters((f) => ({ ...f, branch: v }))}
              options={[["all", "All branches"], ...branches.map((b) => [b, b] as [string, string])]} />
          </Card>
        )}
      </div>

      {/* Projects */}
      {projects.length === 0 ? (
        <EmptyState
          icon={Rocket}
          title="No projects yet"
          description="Add your first landing page or website. You can enter the details manually now and connect GitHub & Vercel later to sync deployments automatically."
          action={<Button onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus className="size-4" /> Add your first project</Button>}
        />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No projects match"
          description="Try a different search term or clear the filters."
          action={<Button variant="secondary" onClick={() => { setQuery(""); setFilters({ state: "all", framework: "all", environment: "all", branch: "all" }); }}>Clear filters</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((p) => (
            <ProjectCard key={p.id} project={p} onEdit={(proj) => { setEditing(proj); setDialogOpen(true); }} />
          ))}
        </div>
      )}

      <ProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
    </PageBody>
  );
}

function ConnectionTile({ providerKey }: { providerKey: ProviderKey }) {
  const { connections, connectProvider, disconnectProvider } = useDeployments();
  const cfg = providerCredentials[providerKey];
  const conn = connections[providerKey];
  const connected = conn.status === "connected";

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
          {providerKey === "github" ? <GitBranch className="size-4" /> : <Rocket className="size-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{cfg.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {connected ? `Synced ${conn.lastSync ? relativeTime(conn.lastSync) : "just now"}` : "Not connected"}
          </p>
        </div>
        <StatusPill tone={connected ? "success" : "muted"}>
          {connected ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
          {connected ? "Connected" : "Off"}
        </StatusPill>
      </div>

      <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span>Webhook: <span className={connected ? "text-success" : ""}>{conn.webhook}</span></span>
        <span>OAuth: {conn.oauth === "authorized" ? "authorized" : "not authorized"}</span>
      </div>

      <div className="mt-3 flex gap-2">
        {connected ? (
          <>
            <Button variant="secondary" size="sm" className="flex-1" onClick={() => { const r = connectProvider(providerKey); toast.success(r.message); }}>
              <RefreshCw className="size-3.5" /> Reconnect
            </Button>
            <Button variant="outline" size="sm" onClick={() => { disconnectProvider(providerKey); toast("Disconnected"); }}>Disconnect</Button>
          </>
        ) : (
          <Button size="sm" className="flex-1" onClick={() => {
            const r = connectProvider(providerKey);
            if (r.ok) toast.success(r.message);
            else toast.error("Add credentials first", { description: r.message });
          }}>
            Connect
          </Button>
        )}
      </div>
    </Card>
  );
}

function Counter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 flex items-center gap-1.5 text-lg font-semibold">
        <span className="size-2 rounded-full" style={{ background: color }} />
        {value}
      </p>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</label>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </Select>
    </div>
  );
}

