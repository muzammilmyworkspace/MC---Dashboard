"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { api, ApiRequestError, type LandingPage, type VercelDeploymentRecord } from "@/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/page-shell";
import { statusMeta, frameworkLabel, displayUrl, formatDuration } from "@/lib/landing-pages";
import { relativeTime, formatDate } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 *  Landing page details
 *
 *  Overview from our stored copy (instant), history straight from
 *  Vercel (authoritative). The split is why the panel still opens and
 *  reads usefully when Vercel is unreachable.
 * ------------------------------------------------------------------ */

/**
 * Shell only. Keying the body on the page id gives each page its own fresh
 * state, so opening a second page cannot show the first one's history while
 * its request is still in flight.
 */
export function DetailDialog({
  page,
  onOpenChange,
}: {
  page: LandingPage | null;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(page)} onOpenChange={onOpenChange}>
      <DialogContent side="right" className="flex flex-col gap-0 overflow-hidden p-0">
        {page && <DetailBody key={page.id} page={page} onOpenChange={onOpenChange} />}
      </DialogContent>
    </Dialog>
  );
}

function DetailBody({ page, onOpenChange }: { page: LandingPage; onOpenChange: (v: boolean) => void }) {
  const [deployments, setDeployments] = useState<VercelDeploymentRecord[]>([]);
  const [reason, setReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const id = page.id;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.landingPages.deployments(id);
        if (cancelled) return;
        setDeployments(res.deployments);
        setReason(res.reason);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiRequestError ? err.message : "Could not load deployment history.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const meta = statusMeta[page.status];

  return (
    <>
        <header className="border-b border-border px-5 py-4 pr-14 sm:px-6">
          <DialogTitle className="truncate">{page.name}</DialogTitle>
          <DialogDescription className="mt-1">
            {page.source === "VERCEL" ? "Hosted on Vercel" : "Added manually"}
          </DialogDescription>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {/* Overview */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Overview</h3>
            <dl className="mt-3 space-y-2.5 text-sm">
              <Row label="Project name" value={page.vercelProjectName || page.name} />
              <Row
                label="Production URL"
                value={
                  page.productionUrl ? (
                    <a
                      href={page.productionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-accent hover:underline"
                    >
                      {displayUrl(page.productionUrl)} <ExternalLink className="size-3 shrink-0" />
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
              <Row label="Current status" value={<StatusPill tone={meta.tone}>{meta.label}</StatusPill>} />
              {page.source === "VERCEL" && <Row label="Framework" value={frameworkLabel(page.framework)} />}
              <Row label="Latest deployment" value={page.deploymentId ? <span className="break-all font-mono text-xs">{page.deploymentId}</span> : "—"} />
              <Row
                label="Deployment date"
                value={page.lastDeploymentAt ? formatDate(page.lastDeploymentAt) : "—"}
              />
              {page.lastSyncedAt && <Row label="Last checked" value={relativeTime(page.lastSyncedAt)} />}
              {page.description && <Row label="Description" value={page.description} />}
            </dl>
          </section>

          {/* History */}
          <section className="mt-7">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Deployment history</h3>

            {loading ? (
              <div className="mt-3 space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-lg border border-border bg-muted/40" />
                ))}
              </div>
            ) : error ? (
              <p className="mt-3 text-sm text-danger">{error}</p>
            ) : reason ? (
              <p className="mt-3 text-sm text-muted-foreground">{reason}</p>
            ) : deployments.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No deployments recorded yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {deployments.map((d) => {
                  const dm = statusMeta[d.status];
                  return (
                    <li key={d.id} className="rounded-lg border border-border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="break-all font-mono text-[11px] text-muted-foreground">{d.id}</span>
                        <StatusPill tone={dm.tone}>{dm.label}</StatusPill>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                        <span>{d.createdAt ? relativeTime(d.createdAt) : "—"}</span>
                        <span className="capitalize">{d.environment}</span>
                        <span>Duration {formatDuration(d.durationMs)}</span>
                        {d.branch && <span>{d.branch}</span>}
                        {d.commitSha && <span className="font-mono">{d.commitSha.slice(0, 7)}</span>}
                      </div>
                      {d.commitMessage && (
                        <p className="mt-1.5 line-clamp-1 text-xs text-muted-foreground">{d.commitMessage}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <footer className="flex gap-2 border-t border-border px-5 py-3.5 sm:px-6">
          <Button asChild disabled={!page.productionUrl} className="flex-1 sm:flex-none">
            <a href={page.productionUrl || "#"} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" /> Open Live Page
            </a>
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none">
            Close
          </Button>
        </footer>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-0.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 max-w-[60%] break-words text-right font-medium">{value}</dd>
    </div>
  );
}
