"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Plug, Plus, RefreshCw, LayoutTemplate } from "lucide-react";
import { api, ApiRequestError, type LandingPage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageBody, PageHeader } from "@/components/ui/page-shell";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PageCard } from "./page-card";
import { SyncDialog } from "./sync-dialog";
import { ManualDialog } from "./manual-dialog";
import { DetailDialog } from "./detail-dialog";
import { SetupDrawer } from "./setup-drawer";

/* ------------------------------------------------------------------ *
 *  Landing Pages
 *
 *  Shows only what was explicitly imported. Refreshing updates the
 *  pages already here and never introduces new ones — a project added
 *  in Vercel afterwards stays invisible until it is picked.
 * ------------------------------------------------------------------ */

export function LandingPagesScreen() {
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [vercelConfigured, setVercelConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [syncOpen, setSyncOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [details, setDetails] = useState<LandingPage | null>(null);
  const [pendingRemove, setPendingRemove] = useState<LandingPage | null>(null);

  const [syncingAll, setSyncingAll] = useState(false);
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());

  const [reloadKey, setReloadKey] = useState(0);
  /** Event handlers ask for a refetch; the effect below performs it. */
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.landingPages.list();
        if (cancelled) return;
        setPages(res.pages);
        setVercelConfigured(res.vercelConfigured);
        setLoadError(null);
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof ApiRequestError ? err.message : "Could not load landing pages.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  /** Replaces rows in place so the grid does not reorder under the user. */
  function mergePages(updated: LandingPage[]) {
    if (updated.length === 0) return;
    setPages((prev) => {
      const byId = new Map(updated.map((p) => [p.id, p]));
      return prev.map((p) => byId.get(p.id) ?? p);
    });
  }

  async function syncAll() {
    if (!vercelConfigured) {
      setSetupOpen(true);
      return;
    }
    setSyncingAll(true);
    try {
      const res = await api.landingPages.sync();
      mergePages(res.pages);
      toast.success(
        res.refreshed === 0
          ? "Nothing to refresh yet."
          : `${res.refreshed} landing ${res.refreshed === 1 ? "page" : "pages"} updated.`,
        res.failed > 0 ? { description: `${res.failed} could not be reached.` } : undefined
      );
    } catch (err) {
      toast.error("Unable to refresh from Vercel.", {
        description: err instanceof ApiRequestError ? err.message : undefined,
      });
    } finally {
      setSyncingAll(false);
    }
  }

  async function refreshOne(page: LandingPage) {
    setRefreshingIds((prev) => new Set(prev).add(page.id));
    try {
      const res = await api.landingPages.sync([page.id]);
      mergePages(res.pages);
      toast.success(`${page.name} updated.`);
    } catch (err) {
      toast.error(`Could not refresh ${page.name}.`, {
        description: err instanceof ApiRequestError ? err.message : undefined,
      });
    } finally {
      setRefreshingIds((prev) => {
        const next = new Set(prev);
        next.delete(page.id);
        return next;
      });
    }
  }

  async function confirmRemove() {
    const page = pendingRemove;
    if (!page) return;
    setPendingRemove(null);
    try {
      await api.landingPages.remove(page.id);
      setPages((prev) => prev.filter((p) => p.id !== page.id));
      toast.success(`${page.name} removed from MC Nexus.`, {
        description: "The Vercel project itself is untouched.",
      });
    } catch (err) {
      toast.error("Could not remove the landing page.", {
        description: err instanceof ApiRequestError ? err.message : undefined,
      });
    }
  }

  function openSync() {
    if (!vercelConfigured) setSetupOpen(true);
    else setSyncOpen(true);
  }

  return (
    <PageBody>
      <PageHeader
        title="Landing Pages"
        description="Manage and monitor your live landing pages from one place."
        actions={
          <>
            <Button variant="outline" onClick={syncAll} disabled={syncingAll || pages.length === 0}>
              <RefreshCw className={syncingAll ? "size-4 animate-spin" : "size-4"} />
              <span className="hidden sm:inline">Refresh all</span>
            </Button>
            <Button variant="outline" onClick={openSync}>
              <Plug className="size-4" /> Sync with Vercel
            </Button>
            <Button onClick={() => setManualOpen(true)}>
              <Plus className="size-4" /> Add Landing Page
            </Button>
          </>
        }
      />

      {!vercelConfigured && !loading && (
        <Card className="flex flex-col gap-3 border-warning/30 bg-warning/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
            <div>
              <p className="text-sm font-medium">Vercel isn&apos;t connected yet.</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Connect it to discover and import your landing pages. You can still add pages manually.
              </p>
            </div>
          </div>
          <Button size="sm" onClick={() => setSetupOpen(true)} className="shrink-0">
            Connect Vercel
          </Button>
        </Card>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="h-[260px] animate-pulse bg-muted/40" />
          ))}
        </div>
      ) : loadError ? (
        <EmptyState
          icon={AlertTriangle}
          title="Could not load landing pages."
          description={loadError}
          action={
            <Button onClick={reload}>
              <RefreshCw className="size-4" /> Retry
            </Button>
          }
        />
      ) : pages.length === 0 ? (
        <EmptyState
          icon={LayoutTemplate}
          title="No landing pages added yet."
          description="Connect Vercel and select the pages you want to manage from MC Nexus."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={openSync}>
                <Plug className="size-4" /> Sync with Vercel
              </Button>
              <Button variant="outline" onClick={() => setManualOpen(true)}>
                Add Manually
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {pages.map((page) => (
            <PageCard
              key={page.id}
              page={page}
              refreshing={refreshingIds.has(page.id)}
              onRefresh={() => void refreshOne(page)}
              onDetails={() => setDetails(page)}
              onRemove={() => setPendingRemove(page)}
            />
          ))}
        </div>
      )}

      <SyncDialog
        open={syncOpen}
        onOpenChange={setSyncOpen}
        onNeedsSetup={() => {
          setSyncOpen(false);
          setVercelConfigured(false);
          setSetupOpen(true);
        }}
        onImported={(count) => {
          toast.success("Landing pages added successfully.", {
            description: `${count} landing ${count === 1 ? "page has" : "pages have"} been added to MC Nexus.`,
          });
          reload();
        }}
      />

      <ManualDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        onSaved={(page) => {
          setPages((prev) => [page, ...prev]);
          toast.success("Landing page added successfully.");
        }}
      />

      <DetailDialog page={details} onOpenChange={(v) => !v && setDetails(null)} />

      <SetupDrawer
        open={setupOpen}
        onOpenChange={(v) => {
          setSetupOpen(v);
          // The token may have started working while the drawer was open.
          if (!v) reload();
        }}
      />

      <Dialog open={Boolean(pendingRemove)} onOpenChange={(v) => !v && setPendingRemove(null)}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-sm p-0">
          <div className="px-5 py-5 pr-14">
            <DialogTitle>Remove this landing page from MC Nexus?</DialogTitle>
            <DialogDescription className="mt-1.5">
              {pendingRemove?.name} will be removed from this dashboard. The Vercel project and the live page are not
              affected, and you can add it back at any time.
            </DialogDescription>
          </div>
          <div className="flex gap-2 border-t border-border px-5 py-3.5">
            <Button variant="outline" onClick={() => setPendingRemove(null)} className="flex-1">
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void confirmRemove()} className="flex-1">
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageBody>
  );
}
