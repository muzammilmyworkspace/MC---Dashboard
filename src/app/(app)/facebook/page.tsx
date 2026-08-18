"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Contact, AlertTriangle, RefreshCw, Camera } from "lucide-react";
import { api, ApiRequestError, type FacebookPage } from "@/lib/api";
import { MetricCard } from "@/components/analytics/metric-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-dot";
import { EmptyState } from "@/components/ui/page-shell";
import { cn } from "@/lib/utils";

export default function FacebookPageScreen() {
  const [pages, setPages] = useState<FacebookPage[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.integrations.facebookPages();
        if (cancelled) return;
        setPages(res.pages);
        setSelected((prev) => prev ?? res.pages[0]?.id ?? null);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiRequestError ? err.message : "Couldn't load your Facebook Pages.");
        setPages([]);
      }
    })();
    return () => { cancelled = true; };
  }, [reload]);

  const page = pages?.find((p) => p.id === selected) ?? null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-semibold tracking-tight">Facebook</h2>
            {pages && <StatusDot state={pages.length ? "connected" : "disconnected"} label={pages.length ? "Connected" : "No Pages"} />}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Your Facebook Pages. Source: Facebook Page API.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setReload((n) => n + 1)}>
          <RefreshCw className="size-4" /> Refresh
        </Button>
      </div>

      {error && (
        <Card className="flex items-start gap-3 border-danger/30 bg-danger/[0.06] p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
          <div>
            <p className="text-sm font-medium">Facebook data couldn&apos;t be loaded</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{error}</p>
          </div>
        </Card>
      )}

      {pages === null ? (
        <Card className="h-40 animate-pulse bg-muted/40" />
      ) : pages.length === 0 && !error ? (
        <EmptyState
          icon={Contact}
          title="No Facebook Pages found"
          description="This Meta account doesn't manage any Pages, or the connection needs to be re-authorized."
        />
      ) : (
        <>
          {pages.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {pages.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelected(p.id)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors",
                    selected === p.id
                      ? "border-accent/40 bg-accent-soft text-accent"
                      : "border-border text-muted-foreground hover:border-accent/30 hover:text-foreground"
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}

          {page && (
            <>
              <Card className="flex flex-wrap items-center gap-4 p-5">
                {page.pictureUrl && (
                  // Facebook CDN URLs are signed and expire — not optimisable.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={page.pictureUrl} alt="" className="size-14 rounded-full border border-border object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{page.name}</p>
                  {page.category && <p className="text-sm text-muted-foreground">{page.category}</p>}
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{page.id}</p>
                </div>
                {page.linkedInstagram && (
                  <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                    <Camera className="size-4 text-accent" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Linked Instagram</p>
                      <p className="text-[13px] font-medium">@{page.linkedInstagram.username}</p>
                    </div>
                  </div>
                )}
              </Card>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <MetricCard
                  label="Followers" value={page.followersCount}
                  help="People who follow this Page and can see its posts in their feed."
                />
                <MetricCard
                  label="Likes" value={page.fanCount}
                  help="People who have liked this Page. Usually close to the follower count."
                />
                <MetricCard
                  label="Page reach" value={null}
                  help="How many people saw content from this Page."
                  unavailable="Needs Page insights access"
                />
                <MetricCard
                  label="Engagement" value={null}
                  help="Likes, comments and shares on this Page's posts."
                  unavailable="Needs Page insights access"
                />
              </div>

              <Card className="p-5">
                <h3 className="text-sm font-semibold">Page posts and insights</h3>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Reading a Page&apos;s posts and its reach/engagement figures needs a Page access token,
                  which is separate from the account connection in use here. Follower and like counts
                  above are live.
                </p>
              </Card>
            </>
          )}
        </>
      )}
    </motion.div>
  );
}
