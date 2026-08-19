"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, RefreshCw, Search } from "lucide-react";
import { api, ApiRequestError, type VercelAvailability, type VercelAvailableProject, type LandingPageStatus } from "@/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/ui/page-shell";
import { statusMeta, frameworkLabel, displayUrl } from "@/lib/landing-pages";
import { relativeTime, cn } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 *  "Select Landing Pages"
 *
 *  Reads the whole Vercel account but imports only what is ticked. The
 *  Add button carries the explicit id list, so there is no path through
 *  this component that imports anything the user did not choose.
 * ------------------------------------------------------------------ */

const FILTERS = [
  { key: "all", label: "All" },
  { key: "LIVE", label: "Live" },
  { key: "BUILDING", label: "Building" },
  { key: "FAILED", label: "Failed" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

interface SyncProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported: (count: number) => void;
  onNeedsSetup: () => void;
}

/**
 * The shell only. All state lives in SyncBody, which Radix mounts fresh on
 * every open — so "reset the form when reopened" needs no effect at all.
 */
export function SyncDialog({ open, onOpenChange, ...rest }: SyncProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88dvh] w-[calc(100%-1.5rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <SyncBody onOpenChange={onOpenChange} {...rest} />
      </DialogContent>
    </Dialog>
  );
}

function SyncBody({ onOpenChange, onImported, onNeedsSetup }: Omit<SyncProps, "open">) {
  const [data, setData] = useState<VercelAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Fetched on mount, and this body only mounts when the modal opens — so the
  // list is always current rather than whatever was there last time.
  //
  // Nothing is set synchronously here: the initial loading state comes from
  // useState, and a retry bumps reloadKey from its own handler. Setting state
  // in the effect body would cascade an extra render on every open.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.landingPages.vercelProjects();
        if (cancelled) return;
        setData(res);
        setError(null);
        if (!res.configured) onNeedsSetup();
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiRequestError ? err.message : "Unable to fetch Vercel projects.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey, onNeedsSetup]);

  function retry() {
    setLoading(true);
    setError(null);
    setReloadKey((k) => k + 1);
  }

  const already = useMemo(() => new Set(data?.alreadyImported ?? []), [data]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.projects ?? []).filter((p) => {
      if (filter !== "all" && p.status !== (filter as LandingPageStatus)) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.productionUrl.toLowerCase().includes(q);
    });
  }, [data, query, filter]);

  // Only rows that can actually be added participate in "select all" — an
  // already-imported row is shown for context, not as a choice.
  const selectable = visible.filter((p) => !already.has(p.vercelProjectId));
  const allPicked = selectable.length > 0 && selectable.every((p) => picked.has(p.vercelProjectId));

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setPicked((prev) => {
      const next = new Set(prev);
      if (allPicked) selectable.forEach((p) => next.delete(p.vercelProjectId));
      else selectable.forEach((p) => next.add(p.vercelProjectId));
      return next;
    });
  }

  async function addSelected() {
    if (picked.size === 0) return;
    setImporting(true);
    try {
      const res = await api.landingPages.import([...picked]);
      onImported(res.imported);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not add the selected pages.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
        <header className="border-b border-border px-5 py-4 pr-14 sm:px-6">
          <DialogTitle>Select Landing Pages</DialogTitle>
          <DialogDescription className="mt-1">
            Choose which Vercel projects you want to manage in MC Nexus.
          </DialogDescription>
        </header>

        {/* Search + filters */}
        <div className="flex flex-col gap-2.5 border-b border-border px-5 py-3 sm:flex-row sm:items-center sm:px-6">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects"
              className="h-9 pl-9"
              aria-label="Search Vercel projects"
            />
          </div>
          <div className="flex shrink-0 items-center gap-1 rounded-lg border border-border p-0.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  filter === f.key ? "bg-accent text-white" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3 sm:px-6">
          {loading ? (
            <Skeletons />
          ) : error ? (
            <ErrorBlock message={error} onRetry={retry} />
          ) : visible.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {data?.projects.length === 0
                ? "No projects found in this Vercel account."
                : "No projects match that search."}
            </p>
          ) : (
            <>
              {selectable.length > 0 && (
                <button
                  type="button"
                  onClick={toggleAll}
                  className="mb-2 text-xs font-medium text-accent transition-opacity hover:opacity-80"
                >
                  {allPicked ? "Clear selection" : `Select all ${selectable.length}`}
                </button>
              )}
              <ul className="space-y-2">
                {visible.map((p) => (
                  <ProjectRow
                    key={p.vercelProjectId}
                    project={p}
                    checked={picked.has(p.vercelProjectId)}
                    imported={already.has(p.vercelProjectId)}
                    onToggle={() => toggle(p.vercelProjectId)}
                  />
                ))}
              </ul>
            </>
          )}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-border px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs text-muted-foreground">
            {picked.size > 0 ? `${picked.size} selected` : "Nothing selected yet"}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing} className="flex-1 sm:flex-none">
              Cancel
            </Button>
            <Button onClick={addSelected} disabled={picked.size === 0 || importing} className="flex-1 sm:flex-none">
              {importing ? <RefreshCw className="size-4 animate-spin" /> : null}
              {importing ? "Adding…" : "Add Selected Pages"}
            </Button>
          </div>
        </footer>
    </>
  );
}

function ProjectRow({
  project,
  checked,
  imported,
  onToggle,
}: {
  project: VercelAvailableProject;
  checked: boolean;
  imported: boolean;
  onToggle: () => void;
}) {
  const meta = statusMeta[project.status];

  return (
    <li>
      <label
        className={cn(
          "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
          imported
            ? "cursor-default border-border bg-muted/30 opacity-70"
            : checked
              ? "border-accent/60 bg-accent/5"
              : "border-border hover:border-accent/30 hover:bg-muted/30"
        )}
      >
        <span className="pt-0.5">
          <input
            type="checkbox"
            className="sr-only"
            checked={checked}
            disabled={imported}
            onChange={onToggle}
          />
          <span
            aria-hidden
            className={cn(
              "flex size-[18px] items-center justify-center rounded-[5px] border transition-colors",
              imported
                ? "border-border bg-muted"
                : checked
                  ? "border-accent bg-accent text-white"
                  : "border-muted-foreground/40"
            )}
          >
            {(checked || imported) && <Check className="size-3" strokeWidth={3} />}
          </span>
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-sm font-medium">{project.name}</span>
            <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
            {imported && <span className="text-[11px] text-muted-foreground">Already added</span>}
          </span>

          {project.productionUrl && (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {displayUrl(project.productionUrl)}
            </span>
          )}

          <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            <span>{frameworkLabel(project.framework)}</span>
            <span className="capitalize">{project.environment}</span>
            <span>
              {project.lastDeploymentAt ? `Last deployed ${relativeTime(project.lastDeploymentAt)}` : "Never deployed"}
            </span>
            {/* The id is what MC Nexus stores, so it is shown for traceability. */}
            <span className="break-all font-mono opacity-70">{project.vercelProjectId}</span>
          </span>
        </span>
      </label>
    </li>
  );
}

function Skeletons() {
  return (
    <div className="space-y-2" role="status" aria-label="Fetching your Vercel projects">
      <p className="pb-1 text-xs text-muted-foreground">Fetching your Vercel projects…</p>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-[86px] animate-pulse rounded-xl border border-border bg-muted/40" />
      ))}
    </div>
  );
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <span className="flex size-10 items-center justify-center rounded-xl bg-danger/10 text-danger">
        <AlertTriangle className="size-5" />
      </span>
      <div>
        <p className="text-sm font-medium">Unable to fetch Vercel projects.</p>
        <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">{message}</p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={onRetry}>
          <RefreshCw className="size-4" /> Retry
        </Button>
        <Button size="sm" variant="outline" asChild>
          <a href="https://vercel.com/account/tokens" target="_blank" rel="noopener noreferrer">
            Vercel Settings
          </a>
        </Button>
      </div>
    </div>
  );
}
