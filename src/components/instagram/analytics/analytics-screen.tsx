"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from "recharts";
import { AlertTriangle, Info, RefreshCw } from "lucide-react";
import { api, ApiRequestError, type IgAnalytics, type IgBucket } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/analytics/metric-card";
import { FilterBar, DEFAULT_RANGE, type Range } from "./filter-bar";
import { ContentTable, EmptyBlock, GroupSummary, PublishingHeatmap, SectionHeading, Stat, num } from "./sections";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 *  Instagram analytics
 *
 *  One request drives the whole screen. Changing the period or the
 *  granularity re-queries that one endpoint, so no two sections can
 *  ever describe different periods.
 * ------------------------------------------------------------------ */

const CHART_H = 260;

type GrowthMetric = "followers" | "newFollowers" | "unfollows" | "netGrowth";
const GROWTH_METRICS: { key: GrowthMetric; label: string; colour: string }[] = [
  { key: "followers", label: "Followers", colour: "var(--accent)" },
  { key: "newFollowers", label: "New followers", colour: "#16a34a" },
  { key: "unfollows", label: "Unfollows", colour: "#dc2626" },
  { key: "netGrowth", label: "Net growth", colour: "var(--accent)" },
];

type ReachMetric = "reach" | "totalInteractions" | "engagementRate" | "accountsEngaged";
const REACH_METRICS: { key: ReachMetric; label: string }[] = [
  { key: "reach", label: "Reach" },
  { key: "totalInteractions", label: "Interactions" },
  { key: "engagementRate", label: "Engagement rate" },
  { key: "accountsEngaged", label: "Accounts engaged" },
];

export function InstagramAnalytics() {
  const [range, setRange] = useState<Range>(DEFAULT_RANGE);
  const [data, setData] = useState<IgAnalytics | null>(null);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [growth, setGrowth] = useState<GrowthMetric>("followers");
  const [reachMetric, setReachMetric] = useState<ReachMetric>("reach");
  const [reloadKey, setReloadKey] = useState(0);

  const key = `${range.startDate}:${range.endDate}:${range.granularity}:${reloadKey}`;
  const stale = loadedKey !== key;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.instagram.analytics(range.startDate, range.endDate, range.granularity);
        if (cancelled) return;
        setData(res);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof ApiRequestError
            ? { message: err.message, code: err.code }
            : { message: "Instagram data is temporarily unavailable." }
        );
      } finally {
        if (!cancelled) setLoadedKey(key);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key, range.startDate, range.endDate, range.granularity]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await api.instagram.sync();
      toast.success("Instagram data updated.", {
        description: res.followers ? `${res.followers.toLocaleString()} followers · ${res.mediaSynced ?? 0} posts` : undefined,
      });
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error("Could not update Instagram data.", {
        description: err instanceof ApiRequestError ? err.message : undefined,
      });
    } finally {
      setRefreshing(false);
    }
  }, []);

  const t = data?.totals;
  const buckets = data?.buckets ?? [];
  const prov = data?.provenance ?? {};

  /* ------------------------------ error state ---------------------------- */

  if (error) {
    // Token and permission problems name the fix; anything else is transient.
    const actionable = error.code === "META_TOKEN_INVALID" || error.code === "META_PERMISSION";
    return (
      <div className="space-y-5">
        <FilterBar range={range} onChange={setRange} onRefresh={refresh} refreshing={refreshing} lastSyncAt={data?.lastSyncAt ?? null} />
        <Card className="flex flex-col items-center gap-3 border-danger/25 bg-danger/[0.04] p-10 text-center">
          <AlertTriangle className="size-6 text-danger" />
          <div>
            <p className="text-sm font-medium">{actionable ? "Instagram needs attention" : "Instagram data is temporarily unavailable."}</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">{error.message}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setReloadKey((k) => k + 1)}>
              <RefreshCw className="size-4" /> Try again
            </Button>
            {actionable && (
              <Button size="sm" variant="outline" asChild>
                <a href="/integrations">Connection settings</a>
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  if (data && !data.configured) {
    return (
      <div className="space-y-5">
        <EmptyBlock message={data.message ?? "Instagram isn't connected yet."} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FilterBar
        range={range}
        onChange={setRange}
        onRefresh={refresh}
        refreshing={refreshing}
        lastSyncAt={data?.lastSyncAt ?? null}
      />

      {/* Meta's reporting lag, stated once rather than as a dash on every card. */}
      {(data?.pendingDays ?? 0) > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-accent/25 bg-accent/[0.05] p-3">
          <Info className="mt-0.5 size-4 shrink-0 text-accent" />
          <p className="text-xs text-muted-foreground">
            Instagram publishes follower and engagement figures about two days late, so the{" "}
            {data?.pendingDays === 1 ? "most recent day is" : `${data?.pendingDays} most recent days are`} still empty.
            They fill in automatically.
          </p>
        </div>
      )}

      {/* ------------------------------ headline ----------------------------- */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          label="Followers" value={data?.profile?.followers ?? null} loading={stale}
          delta={data?.followerChange.net ?? null} deltaSuffix={`in ${range.label.toLowerCase()}`}
          help="Total people following this account right now."
          unavailable="Waiting for the first update"
        />
        <MetricCard
          label="New followers" value={t?.newFollowers ?? null} loading={stale}
          help="People who started following during this period. Reported by Instagram."
          unavailable="Not published yet"
        />
        <MetricCard
          label="Unfollows" value={t?.unfollows ?? null} loading={stale} inverse
          provenance={prov.unfollows === "derived" ? "derived" : "measured"}
          help="People who stopped following during this period. Instagram reports how many, never who."
          unavailable="Not published yet"
        />
        <MetricCard
          label="Net growth" value={t?.netGrowth ?? null} loading={stale}
          help="New followers minus unfollows across this period."
          unavailable="Not published yet"
        />
        <MetricCard
          label="Following" value={data?.profile?.following ?? null} loading={stale}
          help="Accounts this profile follows."
        />
        <MetricCard
          label="Content published" value={data?.content.total ?? null} loading={stale}
          help="Posts, reels and carousels published during this period."
        />
      </section>

      {/* --------------------------- follower growth -------------------------- */}
      <section className="space-y-3">
        <SectionHeading
          title="Follower growth"
          description="How the audience changed across this period."
          actions={
            <div className="flex flex-wrap items-center rounded-lg border border-border p-0.5">
              {GROWTH_METRICS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setGrowth(m.key)}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                    growth === m.key ? "bg-accent text-white" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          }
        />
        <GrowthChart buckets={buckets} metric={growth} loading={stale} />
      </section>

      {/* -------------------------- reach & discovery ------------------------- */}
      <section className="space-y-3">
        <SectionHeading title="Reach and engagement" description="How many people saw the content, and how they responded." />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          <MetricCard label="Reach" value={t?.reach ?? null} loading={stale} help="How many separate accounts saw your content." unavailable="Not published yet" />
          <MetricCard label="Views" value={t?.views ?? null} loading={stale} help="Total times your content was seen, repeat views included." unavailable="Not published yet" />
          <MetricCard label="Profile views" value={t?.profileViews ?? null} loading={stale} help="How many times your profile page was opened." unavailable="Not published yet" />
          <MetricCard label="Website clicks" value={t?.websiteClicks ?? null} loading={stale} help="Taps on the link in your profile." unavailable="Not published yet" />
          <MetricCard label="Accounts engaged" value={t?.accountsEngaged ?? null} loading={stale} help="How many separate accounts interacted with your content." unavailable="Not published yet" />
          <MetricCard
            label="Engagement rate" value={t?.engagementRate ?? null} suffix="%" loading={stale} provenance="derived"
            help="Interactions divided by reach, across the whole period. Calculated from totals rather than averaged per day, so a quiet day cannot distort it."
            unavailable="Needs reach data"
          />
        </div>

        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">Trend across the period</p>
            <div className="flex flex-wrap items-center rounded-lg border border-border p-0.5">
              {REACH_METRICS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setReachMetric(m.key)}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                    reachMetric === m.key ? "bg-accent text-white" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4">
            {stale ? (
              <div className="h-[220px] animate-pulse rounded-lg bg-muted/40" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={buckets} margin={{ top: 6, right: 6, left: -14, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" minTickGap={26} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                  <YAxis width={48} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                  <RTooltip
                    contentStyle={tooltipStyle}
                    formatter={(v) => [
                      reachMetric === "engagementRate" ? `${Number(v)}%` : Number(v).toLocaleString(),
                      REACH_METRICS.find((m) => m.key === reachMetric)?.label ?? "",
                    ]}
                  />
                  {/* connectNulls stays off: a gap is a day Instagram has not
                      published, and bridging it would draw a value we never had. */}
                  <Line type="monotone" dataKey={reachMetric} stroke="var(--accent)" strokeWidth={2} dot={false} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </section>

      {/* ---------------------------- interactions ---------------------------- */}
      <section className="space-y-3">
        <SectionHeading title="Interactions" description="What people did with the content in this period." />
        <Card className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Total interactions" value={num(t?.totalInteractions)} help="Likes, comments, shares and saves added together." />
          <Stat label="Likes" value={num(t?.likes)} />
          <Stat label="Comments" value={num(t?.comments)} />
          <Stat label="Shares" value={num(t?.shares)} />
          <Stat label="Saves" value={num(t?.saves)} help="How many people saved your content to look at later." />
          <Stat label="Story replies" value={num(t?.replies)} help="Direct replies sent to your stories." />
        </Card>
      </section>

      {/* ------------------------- content performance ------------------------ */}
      <section className="space-y-3">
        <SectionHeading title="Content performance" description={`Published during ${range.label.toLowerCase()}.`} />
        <Card className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-5">
          <Stat label="Total" value={num(data?.content.total)} />
          <Stat label="Reels" value={num(data?.content.reels)} />
          <Stat label="Carousels" value={num(data?.content.carousels)} />
          <Stat label="Photo posts" value={num(data?.content.posts)} />
          <Stat label="Stories" value={num(data?.content.stories)} help="Only stories captured while they were live — Instagram deletes them after 24 hours." />
        </Card>
      </section>

      {/* ------------------------------- reels -------------------------------- */}
      <section className="space-y-3">
        <SectionHeading title="Reels performance" />
        <Card className="p-5">
          {stale ? (
            <div className="h-24 animate-pulse rounded-lg bg-muted/40" />
          ) : data && data.reels.count > 0 ? (
            <>
              <GroupSummary stats={data.reels} kind="Reels" />
              <div className="mt-4 border-t border-border pt-2">
                <ContentTable items={data.topContent.filter((i) => i.type === "Reel")} kind="reels" empty="No reels in this period." />
              </div>
            </>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No reels published in this period.</p>
          )}
        </Card>
      </section>

      {/* --------------------------- posts & carousels ------------------------ */}
      <section className="space-y-3">
        <SectionHeading title="Posts and carousels" />
        <Card className="p-5">
          {stale ? (
            <div className="h-24 animate-pulse rounded-lg bg-muted/40" />
          ) : data && data.posts.count > 0 ? (
            <>
              <GroupSummary stats={data.posts} kind="Posts" />
              <div className="mt-4 border-t border-border pt-2">
                <ContentTable items={data.topContent.filter((i) => i.type !== "Reel")} kind="posts" empty="No posts in this period." />
              </div>
            </>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No posts or carousels published in this period.</p>
          )}
        </Card>
      </section>

      {/* ------------------------------ stories ------------------------------- */}
      <section className="space-y-3">
        <SectionHeading
          title="Story performance"
          description="Story data depends on Instagram's 24-hour window — only stories captured while live are counted."
        />
        <Card className="p-5">
          {stale ? (
            <div className="h-20 animate-pulse rounded-lg bg-muted/40" />
          ) : (data?.stories.published ?? 0) > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <Stat label="Stories" value={num(data?.stories.published)} />
              <Stat label="Reach" value={num(data?.stories.reach)} help="How many separate accounts saw your stories." />
              <Stat label="Views" value={num(data?.stories.views)} />
              <Stat label="Replies" value={num(data?.stories.replies)} />
              <Stat label="Taps" value={num(data?.stories.navigation)} help="Forward, back and next-story taps combined — Instagram no longer breaks these out separately." />
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No stories recorded for this period. Stories are only captured while they are live.
            </p>
          )}
        </Card>
      </section>

      {/* ---------------------------- top content ----------------------------- */}
      <section className="space-y-3">
        <SectionHeading title="Top performing content" description="Ranked by how many accounts each piece reached." />
        <Card className="p-5">
          {stale ? (
            <div className="h-40 animate-pulse rounded-lg bg-muted/40" />
          ) : (
            <ContentTable items={data?.topContent ?? []} kind="posts" empty="No content with performance data in this period." />
          )}
        </Card>
      </section>

      {/* -------------------------- needs attention --------------------------- */}
      {(data?.needsAttention.length ?? 0) > 0 && (
        <section className="space-y-3">
          <SectionHeading
            title="Content that needs attention"
            description="The lowest reach in this period — worth reviewing what these have in common."
          />
          <Card className="p-5">
            <ContentTable items={data?.needsAttention ?? []} kind="posts" empty="" />
          </Card>
        </section>
      )}

      {/* --------------------------- publishing ------------------------------- */}
      <section className="space-y-3">
        <SectionHeading title="Publishing activity" description="Which days content goes out — gaps show where the routine breaks." />
        <Card className="p-5">
          {stale ? (
            <div className="h-24 animate-pulse rounded-lg bg-muted/40" />
          ) : (
            <>
              <PublishingHeatmap byWeekday={data?.publishing.byWeekday ?? []} />
              <div className="mt-4 flex flex-wrap gap-6 border-t border-border pt-4">
                <Stat label="Per day" value={data?.publishing.perDay?.toFixed(2) ?? "—"} help="Average pieces of content published each day in this period." />
                <Stat label="Per week" value={data?.publishing.perWeek?.toFixed(1) ?? "—"} help="The same figure expressed weekly." />
                <Stat label="Total" value={num(data?.content.total)} />
              </div>
            </>
          )}
        </Card>
      </section>

      {/* ------------------------------ the table ----------------------------- */}
      <section className="space-y-3">
        <SectionHeading
          title={`${range.granularity === "daily" ? "Daily" : range.granularity === "weekly" ? "Weekly" : "Monthly"} report`}
          description="Every figure for the period, as reported by Instagram."
        />
        <Card className="overflow-hidden">
          {stale ? (
            <div className="h-64 animate-pulse bg-muted/40" />
          ) : (
            <ReportTable buckets={buckets} />
          )}
        </Card>
      </section>

      {/* ---------------------------- provenance ------------------------------ */}
      <section className="space-y-3">
        <SectionHeading title="Where this data comes from" />
        <Card className="p-5">
          <dl className="grid gap-x-8 gap-y-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(prov).map(([metric, source]) => (
              <div key={metric} className="flex items-center justify-between gap-3 border-b border-border/50 pb-1.5">
                <dt className="capitalize text-muted-foreground">{metric.replace(/([A-Z])/g, " $1").toLowerCase()}</dt>
                <dd
                  className={cn(
                    "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
                    source === "measured" && "bg-success/10 text-success",
                    source === "derived" && "bg-warning/10 text-warning",
                    source === "unavailable" && "bg-muted text-muted-foreground"
                  )}
                >
                  {source === "measured" ? "From Instagram" : source === "derived" ? "Calculated" : "Not available"}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
            Impressions are marked unavailable because Instagram removed that metric from its API — there is no
            substitute for it. Instagram also reports how many people unfollowed, but never who; no API returns an
            unfollower&apos;s identity.
          </p>
        </Card>
      </section>
    </div>
  );
}

/* --------------------------------- charts -------------------------------- */

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
  color: "var(--popover-foreground)",
} as const;

function GrowthChart({ buckets, metric, loading }: { buckets: IgBucket[]; metric: GrowthMetric; loading: boolean }) {
  if (loading) return <Card className="h-[300px] animate-pulse bg-muted/40" />;

  const meta = GROWTH_METRICS.find((m) => m.key === metric)!;
  const hasAny = buckets.some((b) => b[metric] !== null);

  if (!hasAny) {
    return (
      <Card className="flex h-[300px] flex-col items-center justify-center p-5 text-center">
        <p className="text-sm font-medium">Nothing published for this period yet</p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          Instagram reports these figures about two days behind. Try a longer period.
        </p>
      </Card>
    );
  }

  /** A full tooltip: every follower figure for the bucket under the cursor. */
  // Recharts types the payload as readonly with a loose element type, so the
  // bucket is narrowed here rather than fighting the generic signature.
  const renderTooltip = ({ active, payload }: { active?: boolean; payload?: readonly { payload?: unknown }[] }) => {
    if (!active || !payload?.length) return null;
    const b = payload[0].payload as IgBucket;
    return (
      <div className="rounded-lg border border-border bg-popover p-3 text-xs shadow-glow">
        <p className="font-medium">{b.label}</p>
        <dl className="mt-1.5 space-y-0.5">
          {[
            ["Followers", num(b.followers)],
            ["New followers", num(b.newFollowers)],
            ["Unfollows", num(b.unfollows)],
            ["Net growth", b.netGrowth === null ? "—" : `${b.netGrowth > 0 ? "+" : ""}${b.netGrowth}`],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-6">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  };

  const isBar = metric !== "followers";

  return (
    <Card className="p-5">
      <ResponsiveContainer width="100%" height={CHART_H}>
        {isBar ? (
          <BarChart data={buckets} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" minTickGap={26} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
            <YAxis width={48} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
            <RTooltip content={renderTooltip} cursor={{ fill: "var(--muted)", opacity: 0.35 }} />
            <Bar dataKey={metric} fill={meta.colour} radius={[3, 3, 0, 0]} maxBarSize={30} />
          </BarChart>
        ) : (
          <AreaChart data={buckets} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
            <defs>
              <linearGradient id="igFollowers" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.26} />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" minTickGap={26} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
            <YAxis domain={["dataMin - 20", "dataMax + 20"]} width={56} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
            <RTooltip content={renderTooltip} />
            <Area type="monotone" dataKey="followers" stroke="var(--accent)" strokeWidth={2} fill="url(#igFollowers)" connectNulls />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </Card>
  );
}

/* --------------------------------- table --------------------------------- */

const COLUMNS: { key: keyof IgBucket; label: string; suffix?: string }[] = [
  { key: "followers", label: "Followers" },
  { key: "newFollowers", label: "New" },
  { key: "unfollows", label: "Unfollows" },
  { key: "netGrowth", label: "Net" },
  { key: "reels", label: "Reels" },
  { key: "posts", label: "Posts" },
  { key: "reach", label: "Reach" },
  { key: "totalInteractions", label: "Engagement" },
  { key: "profileViews", label: "Profile views" },
  { key: "websiteClicks", label: "Clicks" },
];

function ReportTable({ buckets }: { buckets: IgBucket[] }) {
  if (buckets.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">No data for this period.</p>;
  }

  // Newest first — a report is read from the top.
  const rows = [...buckets].reverse();

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Period</th>
            {COLUMNS.map((c) => (
              <th key={String(c.key)} className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.key} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
              <td className="whitespace-nowrap px-4 py-2.5 font-medium">{b.label}</td>
              {COLUMNS.map((c) => {
                const v = b[c.key] as number | null;
                const isNet = c.key === "netGrowth";
                return (
                  <td
                    key={String(c.key)}
                    className={cn(
                      "px-4 py-2.5 text-right tabular-nums",
                      v === null && "text-muted-foreground/40",
                      isNet && v !== null && v > 0 && "text-success",
                      isNet && v !== null && v < 0 && "text-danger"
                    )}
                  >
                    {v === null ? "—" : isNet && v > 0 ? `+${v}` : v.toLocaleString()}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
