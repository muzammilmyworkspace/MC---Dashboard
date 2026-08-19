"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";
import {
  Camera, RefreshCw, TrendingUp, TrendingDown, Users, Eye, Heart,
  MessageCircle, Bookmark, AlertTriangle, CheckCircle2, Settings2, ExternalLink, Info, Film, Image as ImageIcon,
} from "lucide-react";
import { api, ApiRequestError, type IgDiagnostics, type IgMediaItem, type IgOverview } from "@/lib/api";
import { PageBody, PageHeader, SectionCard, EmptyState, StatusPill } from "@/components/ui/page-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
  color: "var(--foreground)",
  boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)",
} as const;

const GAINED = "#16a34a";
const LOST = "#dc2626";
const ACCENT = "#2456d6";

const RANGES = [7, 30, 90] as const;

/** What one completed load produced, tagged with the range it belongs to. */
interface Loaded {
  days: number;
  overview: IgOverview | null;
  media: IgMediaItem[];
}

export function InstagramDashboard() {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<Loaded | null>(null);
  const [diagnostics, setDiagnostics] = useState<IgDiagnostics | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    // Guards against a range change or unmount mid-flight letting a stale
    // response overwrite a newer one.
    let cancelled = false;

    void (async () => {
      try {
        const overview = await api.instagram.overview(days);
        let media: IgMediaItem[] = [];
        let diag: IgDiagnostics | null = null;

        if (overview.configured) {
          media = (await api.instagram.media(24)).media;
        } else {
          // Diagnostics makes live Graph calls, so it only runs when
          // something is actually wrong — never on a healthy page view.
          diag = await api.instagram.diagnostics().catch(() => null);
        }

        if (cancelled) return;
        setData({ days, overview, media });
        setDiagnostics(diag);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setData({ days, overview: null, media: [] });
        setError(err instanceof ApiRequestError ? err.message : "Could not reach the API");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [days, reloadKey]);

  async function handleSync() {
    setSyncing(true);
    try {
      const result = await api.instagram.sync();
      if (result.ok) {
        toast.success("Instagram synced", {
          description: `${result.followers?.toLocaleString()} followers · ${result.mediaSynced ?? 0} posts updated`,
        });
        reload();
      } else {
        toast.error("Sync failed", { description: result.error });
        setDiagnostics(await api.instagram.diagnostics().catch(() => null));
      }
    } catch (err) {
      toast.error("Sync failed", {
        description: err instanceof ApiRequestError ? err.message : "Could not reach the API",
      });
    } finally {
      setSyncing(false);
    }
  }

  // Derived rather than stored: a range switch is "loading" until the data
  // tagged with that range arrives.
  const loading = data === null || data.days !== days;
  const overview = data?.overview ?? null;
  const media = data?.media ?? [];
  const totals = overview?.totals;
  const latest = overview?.latest;

  return (
    <PageBody>
      <PageHeader
        icon={Camera}
        eyebrow="Social platform"
        title="Instagram"
        description="Daily follower movement, reach and post performance, pulled from the Meta Graph API."
        actions={
          <>
            <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
              {RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setDays(r)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    days === r ? "bg-accent text-white" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {r}d
                </button>
              ))}
            </div>
            <Button onClick={handleSync} disabled={syncing}>
              <RefreshCw className={cn("size-4", syncing && "animate-spin")} />
              {syncing ? "Syncing…" : "Sync now"}
            </Button>
          </>
        }
      />

      {error && (
        <Card className="flex items-start gap-2.5 border-danger/30 bg-danger/[0.06] p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
          <div>
            <p className="text-sm font-medium text-danger">Couldn&apos;t load Instagram data</p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        </Card>
      )}

      {loading ? (
        <LoadingSkeleton />
      ) : !overview ? null : !overview.configured ? (
        <SetupPanel message={overview.message} diagnostics={diagnostics} onRetry={reload} />
      ) : (
        <>
          {/* ---------------------------- KPIs ---------------------------- */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kpi
              label="Followers"
              value={latest?.followers?.toLocaleString() ?? "—"}
              icon={Users}
              delta={totals ? totals.net : null}
              deltaSuffix={`in ${days}d`}
            />
            <Kpi label="Gained" value={totals?.gained.toLocaleString() ?? "—"} icon={TrendingUp} tone="success" />
            <Kpi
              label="Unfollowed"
              value={totals?.lost.toLocaleString() ?? "—"}
              icon={TrendingDown}
              tone="danger"
              // Only flagged when a day in the window really is the old
              // estimate. Labelling Meta's measured figure "Estimated" told
              // the reader to distrust a number that is exact.
              estimated={overview?.history.some((d) => d.lostSource === "derived") ?? false}
            />
            <Kpi label="Reach" value={totals?.reach ? compact(totals.reach) : "—"} icon={Eye} />
            <Kpi label="Profile views" value={totals?.profileViews ? compact(totals.profileViews) : "—"} icon={Eye} />
          </div>

          {totals && totals.daysCovered === 0 && (
            <Card className="flex items-start gap-2.5 border-accent/25 bg-accent/[0.06] p-4">
              <Info className="mt-0.5 size-4 shrink-0 text-accent" />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium text-foreground">No daily movement yet</p>
                <p className="mt-0.5">
                  Follower gain/loss needs at least two days of history. The first sync records today&apos;s totals —
                  come back tomorrow for the first real delta.
                </p>
              </div>
            </Card>
          )}

          {/* ------------------------ Follower growth ---------------------- */}
          <SectionCard
            title="Follower growth"
            description={`Total followers over the last ${days} days.`}
            icon={TrendingUp}
            actions={
              overview?.lastSyncAt ? (
                <span className="text-xs text-muted-foreground">
                  Synced {new Date(overview.lastSyncAt).toLocaleString()}
                </span>
              ) : null
            }
          >
            {overview?.history.some((d) => d.followers !== null) ? (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={overview.history} margin={{ top: 10, right: 6, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="igFollowers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ACCENT} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDate} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} minTickGap={24} />
                  <YAxis domain={["dataMin - 5", "dataMax + 5"]} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} width={52} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => shortDate(String(l))} formatter={(v) => [Number(v).toLocaleString(), "Followers"]} cursor={{ stroke: ACCENT, strokeWidth: 1, strokeDasharray: "4 4" }} />
                  {/* connectNulls stays off: days before snapshotting began have
                      no follower total, and a bridged line would invent one. */}
                  <Area type="monotone" dataKey="followers" stroke={ACCENT} strokeWidth={2.5} fill="url(#igFollowers)" connectNulls={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                icon={TrendingUp}
                title="No history yet"
                description="Press “Sync now” to take the first snapshot. The chart fills in one day at a time."
                className="border-0 bg-transparent py-10"
              />
            )}
          </SectionCard>

          {/* --------------------- Gained vs unfollowed -------------------- */}
          <SectionCard
            title="Daily follows vs unfollows"
            description="Both figures come straight from Meta — follows in green, unfollows in red."
            icon={Users}
          >
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-accent/25 bg-accent/[0.06] p-3">
              <Info className="mt-0.5 size-4 shrink-0 text-accent" />
              <p className="text-xs text-muted-foreground">
                These are Meta&apos;s own measured counts, not estimates. Meta publishes{" "}
                <strong className="text-foreground">how many</strong> people followed and unfollowed each day, but never{" "}
                <strong className="text-foreground">who</strong> — no Instagram API returns the identity of an
                unfollower, so a named list cannot be built. Figures settle about two days after the day itself.
              </p>
            </div>

            {overview?.history.some((d) => d.gained !== null) ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={overview.history} margin={{ top: 10, right: 6, left: -12, bottom: 0 }} stackOffset="sign">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDate} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} minTickGap={24} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} width={40} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelFormatter={(l) => shortDate(String(l))}
                    formatter={(v, n) => [Math.abs(Number(v)), n === "gained" ? "Followed" : "Unfollowed"]}
                    cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                  />
                  <ReferenceLine y={0} stroke="var(--border)" />
                  <Bar dataKey="gained" fill={GAINED} radius={[3, 3, 0, 0]} />
                  <Bar dataKey={(d: { lost: number | null }) => (d.lost === null ? null : -d.lost)} name="lost" fill={LOST} radius={[0, 0, 3, 3]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                icon={Users}
                title="Waiting on daily insights"
                description="Meta serves follower movement per day. It appears after the next sync, once at least one full day has elapsed."
                className="border-0 bg-transparent py-10"
              />
            )}
          </SectionCard>

          {/* ---------------------------- Posts --------------------------- */}
          <SectionCard
            title="Recent posts"
            description="Reach, engagement and saves for the latest content."
            icon={ImageIcon}
          >
            {media.length ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {media.map((m) => (
                  <MediaCard key={m.id} media={m} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={ImageIcon}
                title="No posts synced yet"
                description="Press “Sync now” to pull your latest posts and their insights."
                className="border-0 bg-transparent py-10"
              />
            )}
          </SectionCard>
        </>
      )}
    </PageBody>
  );
}

/* ------------------------------ Sub-components --------------------------- */

function Kpi({
  label, value, icon: Icon, delta, deltaSuffix, tone, estimated,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  delta?: number | null;
  deltaSuffix?: string;
  tone?: "success" | "danger";
  estimated?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <Icon className={cn("size-4", tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-muted-foreground")} />
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      {delta !== undefined && delta !== null && (
        <p className={cn("mt-1 text-xs font-medium", delta > 0 ? "text-success" : delta < 0 ? "text-danger" : "text-muted-foreground")}>
          {delta > 0 ? "+" : ""}{delta.toLocaleString()} {deltaSuffix}
        </p>
      )}
      {estimated && <p className="mt-1 text-[11px] text-muted-foreground">Estimated</p>}
    </Card>
  );
}

function MediaCard({ media }: { media: IgMediaItem }) {
  const [imgFailed, setImgFailed] = useState(false);
  const isReel = media.productType === "REELS";
  const thumb = media.thumbnailUrl ?? media.mediaUrl;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="relative aspect-square bg-muted">
        {thumb && !imgFailed ? (
          // Plain <img>: Instagram CDN URLs are signed and expire, so they
          // can't be optimised or cached by next/image.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="size-full object-cover" onError={() => setImgFailed(true)} loading="lazy" />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
            {isReel ? <Film className="size-6" /> : <ImageIcon className="size-6" />}
            <span className="text-[10px]">Preview expired</span>
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur">
          {isReel ? "Reel" : media.mediaType === "CAROUSEL_ALBUM" ? "Carousel" : "Post"}
        </span>
      </div>

      <div className="space-y-2.5 p-3">
        <p className="line-clamp-2 text-xs text-muted-foreground">{media.caption || "No caption"}</p>

        <div className="grid grid-cols-4 gap-1.5 text-center">
          <MiniStat icon={Heart} value={media.likeCount} />
          <MiniStat icon={MessageCircle} value={media.commentsCount} />
          <MiniStat icon={Bookmark} value={media.saved} />
          <MiniStat icon={Eye} value={media.reach ?? media.views} />
        </div>

        <div className="flex items-center justify-between border-t border-border pt-2">
          <span className="text-[11px] text-muted-foreground">
            {new Date(media.timestamp).toLocaleDateString()}
          </span>
          <div className="flex items-center gap-2">
            {media.engagementRate !== null && (
              <StatusPill tone={media.engagementRate >= 3 ? "success" : "muted"}>
                {media.engagementRate}% ER
              </StatusPill>
            )}
            {media.permalink && (
              <a href={media.permalink} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-accent">
                <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, value }: { icon: React.ElementType; value: number | null | undefined }) {
  return (
    <div className="rounded-lg bg-muted/40 py-1.5">
      <Icon className="mx-auto size-3 text-muted-foreground" />
      <p className="mt-0.5 text-[11px] font-medium tabular-nums">{value === null || value === undefined ? "—" : compact(value)}</p>
    </div>
  );
}

/** Shown until the server env is filled in — surfaces the real reason. */
function SetupPanel({
  message, diagnostics, onRetry,
}: {
  message?: string;
  diagnostics: IgDiagnostics | null;
  onRetry: () => void;
}) {
  const linked = diagnostics?.accounts.filter((a) => a.igAccountId) ?? [];

  return (
    <SectionCard title="Finish the Instagram connection" icon={Settings2} description={message}>
      <div className="space-y-4">
        {diagnostics?.missing.length ? (
          <div className="rounded-xl border border-warning/30 bg-warning/[0.06] p-3">
            <p className="text-sm font-medium text-warning">Missing environment variables</p>
            <p className="mt-1 text-xs text-muted-foreground">Add these to <code className="rounded bg-muted px-1">server/.env</code> and restart the API:</p>
            <div className="mt-2 space-y-1">
              {diagnostics.missing.map((k) => (
                <code key={k} className="block rounded bg-muted px-2 py-1 font-mono text-[11px]">{k}=</code>
              ))}
            </div>
          </div>
        ) : null}

        {diagnostics?.token && (
          <div className={cn("flex items-start gap-2 rounded-xl border p-3", diagnostics.token.valid ? "border-success/30 bg-success/[0.06]" : "border-danger/30 bg-danger/[0.06]")}>
            {diagnostics.token.valid ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />}
            <div className="min-w-0">
              <p className="text-sm font-medium">{diagnostics.token.message}</p>
              {diagnostics.token.scopes?.length ? (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {diagnostics.token.scopes.map((s) => (
                    <code key={s} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">{s}</code>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        )}

        {diagnostics?.configured && (
          <div className="rounded-xl border border-border p-3">
            <p className="text-sm font-medium">Pages visible to this token</p>
            {linked.length ? (
              <ul className="mt-2 space-y-1.5">
                {linked.map((a) => (
                  <li key={a.pageId} className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate">
                      {a.pageName} → <strong>@{a.igUsername}</strong>
                    </span>
                    <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">{a.igAccountId}</code>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                No Page has a linked Instagram professional account. Link the account to the Page in Meta Business
                Settings — no token change will fix this.
              </p>
            )}
            {diagnostics.accountsError && (
              <p className="mt-2 text-xs text-danger">{diagnostics.accountsError}</p>
            )}
          </div>
        )}

        <Button variant="secondary" onClick={onRetry}>
          <RefreshCw className="size-4" /> Re-check
        </Button>
      </div>
    </SectionCard>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="h-[92px] animate-pulse bg-muted/40" />
        ))}
      </div>
      <Card className="h-[320px] animate-pulse bg-muted/40" />
    </div>
  );
}

/* -------------------------------- helpers -------------------------------- */

function shortDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function compact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
