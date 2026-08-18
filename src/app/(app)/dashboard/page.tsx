"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import {
  ArrowRight, ArrowUpRight, ArrowDownRight, RefreshCw, CheckCircle2,
  AlertTriangle, Info, Camera, Contact, Megaphone, ExternalLink,
} from "lucide-react";
import { api, ApiRequestError } from "@/lib/api";
import type { DashboardOverview } from "@/lib/dashboard-types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { StatusDot } from "@/components/ui/status-dot";
import { cn, relativeTime } from "@/lib/utils";

type Window = 7 | 30 | 90;

export default function DashboardPage() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [days, setDays] = useState<Window>(30);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const key = `${days}:${reload}`;
  const loading = loadedFor !== key;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.dashboard.overview(days);
        if (cancelled) return;
        setData(res);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiRequestError ? err.message : "Couldn't load your dashboard.");
      } finally {
        if (!cancelled) setLoadedFor(key);
      }
    })();
    return () => { cancelled = true; };
  }, [days, key]);

  const ig = data?.instagram;
  const fb = data?.facebook;
  const ads = data?.ads;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-8 pb-4"
    >
      {/* Greeting */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">{greeting()}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here&apos;s how your digital presence is performing.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[13px] font-medium">{today()}</p>
            {data?.generatedAt && (
              <p className="text-[11px] text-muted-foreground">Updated {relativeTime(data.generatedAt)}</p>
            )}
          </div>
          <Tooltip content="Refresh all dashboard data">
            <button
              onClick={() => setReload((n) => n + 1)}
              aria-label="Refresh"
              className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-accent/40 hover:text-foreground"
            >
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            </button>
          </Tooltip>
        </div>
      </header>

      {error && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-danger/30 bg-danger/[0.05] p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
            <div>
              <p className="text-sm font-medium">Dashboard data couldn&apos;t be loaded</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{error}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setReload((n) => n + 1)}>Try again</Button>
        </Card>
      )}

      {/* Platform summaries */}
      <section className="grid gap-4 lg:grid-cols-3">
        <PlatformSummary
          icon={Camera} name="Instagram" href="/instagram"
          loading={loading} available={ig?.available ?? false}
          headline={ig?.followers ?? null} headlineLabel="Followers"
          trendPct={ig?.trendPct ?? null} windowDays={days}
          rows={[
            { label: "New followers", value: ig?.latest?.newFollowers ?? null, tone: "good", help: "People who started following on the most recent day Meta has published." },
            { label: "Unfollowed", value: ig?.latest?.unfollows ?? null, tone: "bad", help: "People who stopped following. Reported directly by Meta." },
            { label: "Net growth", value: ig?.latest?.net ?? null, tone: "net", help: "New followers minus unfollows on that day." },
            { label: "Content", value: ig?.contentCount ?? null, help: "Total posts and reels published on this account." },
          ]}
        />

        <PlatformSummary
          icon={Contact} name="Facebook" href="/facebook"
          loading={loading} available={fb?.available ?? false}
          headline={fb?.totalFollowers ?? null} headlineLabel="Followers"
          rows={[
            { label: "Pages", value: fb?.pages.length ?? null, help: "Facebook Pages connected to this account." },
            { label: "New followers", value: null, help: "Facebook doesn't provide daily follower changes through this connection.", unavailable: "Not available" },
            { label: "Unfollowed", value: null, help: "Facebook doesn't provide daily follower changes through this connection.", unavailable: "Not available" },
            { label: "Page likes", value: fb?.pages.reduce((s, p) => s + (p.fans ?? 0), 0) || null, help: "Combined likes across your Pages." },
          ]}
        />

        <PlatformSummary
          icon={Megaphone} name="Meta Ads" href="/meta"
          loading={loading} available={ads?.available ?? false}
          unavailableReason={ads?.reason ?? undefined}
          headline={ads?.insights?.spend ?? null} headlineLabel="Spend · 30 days"
          headlinePrefix={ads?.currency ? `${ads.currency} ` : ""}
          rows={[
            { label: "Active campaigns", value: ads?.activeCampaigns ?? null, help: "Campaigns currently running." },
            { label: "Conversions", value: ads?.insights?.conversions ?? null, tone: "good", help: "Purchases or leads Meta attributed to your ads.", unavailable: "Not tracked" },
            { label: "Impressions", value: ads?.insights?.impressions ?? null, help: "How many times your ads were shown, including repeat views." },
            { label: "ROAS", value: ads?.insights?.roas ?? null, decimals: 2, suffix: "x", emphasis: true, help: "Return on ad spend — money earned for every 1 spent. Above 1 means the ads made more than they cost.", unavailable: "Needs purchase tracking" },
          ]}
        />
      </section>

      {/* Performance overview */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Performance overview</h2>
            <p className="text-xs text-muted-foreground">Follower growth over time.</p>
          </div>
          <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
            {([7, 30, 90] as Window[]).map((w) => (
              <button
                key={w}
                onClick={() => setDays(w)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  days === w ? "bg-accent text-white" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {w} days
              </button>
            ))}
          </div>
        </div>
        <GrowthChart history={ig?.history ?? []} loading={loading} />
      </section>

      {/* Content + advertising */}
      <section className="grid gap-4 lg:grid-cols-2">
        <TopContentCard items={ig?.topContent ?? []} loading={loading} />
        <AdTrendCard ads={ads} loading={loading} />
      </section>

      {/* Attention */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Needs attention</h2>
        {loading ? (
          <Card className="h-20 animate-pulse bg-muted/40" />
        ) : (data?.alerts.length ?? 0) === 0 ? (
          <Card className="flex items-center gap-3 border-success/25 bg-success/[0.04] p-4">
            <CheckCircle2 className="size-4 shrink-0 text-success" />
            <p className="text-sm">Everything looks good.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {data?.alerts.map((a) => (
              <Card
                key={a.title}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-3 p-4",
                  a.severity === "warning" ? "border-warning/30 bg-warning/[0.05]" : "border-border"
                )}
              >
                <div className="flex items-start gap-3">
                  {a.severity === "info" ? (
                    <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="mt-0.5 max-w-xl text-xs text-muted-foreground">{a.detail}</p>
                  </div>
                </div>
                {a.href && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={a.href}>Review <ArrowRight className="size-3.5" /></Link>
                  </Button>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Connected platforms */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Connected platforms</h2>
        <Card className="divide-y divide-border">
          {(data?.platforms ?? []).map((p) => (
            <Link
              key={p.key}
              href={p.href}
              className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-muted/30"
            >
              <span className="text-sm">{p.name}</span>
              <span className="flex items-center gap-4">
                {p.lastSyncAt && (
                  <span className="hidden text-[11px] text-muted-foreground sm:inline">
                    Updated {relativeTime(p.lastSyncAt)}
                  </span>
                )}
                <StatusDot
                  state={p.status === "connected" ? "connected" : p.status === "attention" ? "loading" : "disconnected"}
                  label={p.status === "connected" ? "Connected" : p.status === "attention" ? "Needs attention" : "Not connected"}
                />
              </span>
            </Link>
          ))}
          {loading && !data && <div className="h-40 animate-pulse bg-muted/40" />}
        </Card>
      </section>
    </motion.div>
  );
}

/* ------------------------------- pieces ---------------------------------- */

interface Row {
  label: string;
  value: number | null;
  help: string;
  tone?: "good" | "bad" | "net";
  decimals?: number;
  suffix?: string;
  emphasis?: boolean;
  unavailable?: string;
}

function PlatformSummary({
  icon: Icon, name, href, loading, available, unavailableReason,
  headline, headlineLabel, headlinePrefix, trendPct, windowDays, rows,
}: {
  icon: React.ElementType; name: string; href: string;
  loading: boolean; available: boolean; unavailableReason?: string;
  headline: number | null; headlineLabel: string; headlinePrefix?: string;
  trendPct?: number | null; windowDays?: number; rows: Row[];
}) {
  if (loading) return <Card className="h-[280px] animate-pulse bg-muted/40" />;

  return (
    <Card className="flex flex-col p-5 transition-colors hover:border-accent/30">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground">
            <Icon className="size-[18px]" />
          </div>
          <div>
            <p className="text-sm font-semibold">{name}</p>
            <StatusDot state={available ? "connected" : "disconnected"} label={available ? "Connected" : "Not connected"} />
          </div>
        </div>
      </div>

      {!available ? (
        <p className="mt-5 flex-1 text-sm text-muted-foreground">
          {unavailableReason ?? "This platform isn't connected yet."}
        </p>
      ) : (
        <>
          <div className="mt-5">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{headlineLabel}</p>
            <div className="mt-1 flex items-baseline gap-2.5">
              <p className="text-[30px] font-semibold leading-none tabular-nums">
                {headline === null ? "—" : `${headlinePrefix ?? ""}${headline.toLocaleString()}`}
              </p>
              {trendPct !== null && trendPct !== undefined && (
                <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", trendPct >= 0 ? "text-success" : "text-danger")}>
                  {trendPct >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                  {Math.abs(trendPct)}%
                  <span className="font-normal text-muted-foreground">in {windowDays} days</span>
                </span>
              )}
            </div>
          </div>

          <dl className="mt-5 flex-1 space-y-2.5">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                  {r.label}
                  <Tooltip content={<span className="block max-w-[230px] leading-snug">{r.help}</span>}>
                    <button type="button" aria-label={r.label} className="text-muted-foreground/40 hover:text-accent">
                      <Info className="size-3" />
                    </button>
                  </Tooltip>
                </dt>
                <dd
                  className={cn(
                    "text-[13px] font-medium tabular-nums",
                    r.value === null && "text-muted-foreground/50",
                    r.emphasis && r.value !== null && "text-base font-semibold",
                    r.value !== null && r.tone === "good" && r.value > 0 && "text-success",
                    r.value !== null && r.tone === "bad" && r.value > 0 && "text-danger",
                    r.value !== null && r.tone === "net" && (r.value > 0 ? "text-success" : r.value < 0 ? "text-danger" : "")
                  )}
                >
                  {r.value === null
                    ? (r.unavailable ?? "—")
                    : `${r.tone === "net" && r.value > 0 ? "+" : ""}${r.decimals ? r.value.toFixed(r.decimals) : r.value.toLocaleString()}${r.suffix ?? ""}`}
                </dd>
              </div>
            ))}
          </dl>

          <Link
            href={href}
            className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-accent"
          >
            View {name} <ArrowRight className="size-3.5" />
          </Link>
        </>
      )}
    </Card>
  );
}

function GrowthChart({
  history, loading,
}: {
  history: { date: string; followers: number | null; gained: number | null; lost: number | null; net: number | null }[];
  loading: boolean;
}) {
  if (loading) return <Card className="h-[260px] animate-pulse bg-muted/40" />;

  const series = history.filter((h) => h.followers !== null).map((h) => ({ ...h, followers: h.followers ?? 0 }));

  if (series.length < 2) {
    return (
      <Card className="flex h-[260px] flex-col items-center justify-center p-5 text-center">
        <p className="text-sm font-medium">Not enough history yet</p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          The chart needs at least two daily readings. It fills in automatically as the daily update runs.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <ResponsiveContainer width="100%" height={230}>
        <AreaChart data={series} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="dashGrowth" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={30} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
          <YAxis domain={["dataMin - 5", "dataMax + 5"]} width={54} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
          <RTooltip
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12, color: "var(--popover-foreground)" }}
            labelFormatter={(l) => shortDate(String(l))}
            formatter={(v, n) => [Number(v).toLocaleString(), n === "followers" ? "Followers" : String(n)]}
          />
          <Area type="monotone" dataKey="followers" stroke="var(--accent)" strokeWidth={2} fill="url(#dashGrowth)" />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}

function TopContentCard({ items, loading }: { items: DashboardOverview["instagram"]["topContent"]; loading: boolean }) {
  if (loading) return <Card className="h-[300px] animate-pulse bg-muted/40" />;

  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Top performing content</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Ranked by how many people it reached.</p>
        </div>
        <Link href="/instagram" className="text-muted-foreground transition-colors hover:text-accent">
          <ArrowRight className="size-4" />
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="mt-8 flex-1 text-center text-sm text-muted-foreground">No content data yet.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {items.map((c, i) => (
            <li key={c.id} className="flex items-start gap-3">
              <span className="mt-0.5 w-4 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
              {c.thumbnailUrl ? (
                // Instagram CDN URLs are signed and expire — not optimisable.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.thumbnailUrl} alt="" loading="lazy" className="size-10 shrink-0 rounded-md border border-border object-cover" />
              ) : (
                <div className="size-10 shrink-0 rounded-md border border-border bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">
                  {c.type} — {c.caption ? c.caption.replace(/\s+/g, " ").slice(0, 44) : "No caption"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Reach {c.reach?.toLocaleString() ?? "—"}
                  {c.engagementRate !== null && ` · Engagement ${c.engagementRate}%`}
                </p>
              </div>
              {c.permalink && (
                <a href={c.permalink} target="_blank" rel="noreferrer" className="mt-1 text-muted-foreground hover:text-accent">
                  <ExternalLink className="size-3.5" />
                </a>
              )}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function AdTrendCard({ ads, loading }: { ads: DashboardOverview["ads"] | undefined; loading: boolean }) {
  if (loading) return <Card className="h-[300px] animate-pulse bg-muted/40" />;

  if (!ads?.available) {
    return (
      <Card className="flex flex-col items-center justify-center p-5 text-center">
        <p className="text-sm font-medium">Advertising</p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          {ads?.reason ?? "No ad account connected yet."}
        </p>
      </Card>
    );
  }

  const spend = ads.campaigns
    .filter((c) => c.spend !== null)
    .map((c) => ({ name: c.name.slice(0, 18), spend: c.spend ?? 0 }));

  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Advertising performance</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{ads.accountName} · last 30 days</p>
        </div>
        <Link href="/meta" className="text-muted-foreground transition-colors hover:text-accent">
          <ArrowRight className="size-4" />
        </Link>
      </div>

      {spend.length === 0 ? (
        <p className="mt-8 flex-1 text-center text-sm text-muted-foreground">No campaign spend in this period.</p>
      ) : (
        <>
          <div className="mt-4">
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={spend} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
                <RTooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12, color: "var(--popover-foreground)" }}
                  formatter={(v) => [`${ads.currency ?? ""} ${Number(v).toLocaleString()}`, "Spend"]}
                />
                <Bar dataKey="spend" fill="var(--accent)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <ul className="mt-4 space-y-2 border-t border-border pt-3">
            {ads.campaigns.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 text-[13px]">
                <span className="flex min-w-0 items-center gap-2">
                  <StatusDot state={c.status === "ACTIVE" ? "connected" : "disconnected"} label="" />
                  <span className="truncate">{c.name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-4 tabular-nums">
                  <span className="text-muted-foreground">
                    {c.spend === null ? "—" : `${ads.currency ?? ""} ${c.spend.toLocaleString()}`}
                  </span>
                  <span className={cn("w-12 text-right font-medium", c.roas === null && "text-muted-foreground/50")}>
                    {c.roas === null ? "—" : `${c.roas.toFixed(2)}x`}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

/* ------------------------------- helpers --------------------------------- */

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function today(): string {
  return new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
