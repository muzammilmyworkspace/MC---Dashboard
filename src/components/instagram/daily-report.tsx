"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { Info, AlertTriangle } from "lucide-react";
import { api, ApiRequestError, type DailyReport as Report } from "@/lib/api";
import { DateRangePicker, DEFAULT_RANGE, type DateRange } from "@/components/analytics/date-range";
import { MetricCard } from "@/components/analytics/metric-card";
import { Card } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Follower growth and the day-by-day report.
 *
 * Unfollows are now measured by Meta rather than estimated, but rows recorded
 * before that metric was wired up still carry the old estimate. Each row says
 * which it is, and the table marks estimated values so a client is never shown
 * a guess as a fact.
 */
export function InstagramDailyReport() {
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<number | null>(null);

  const stale = loadedFor !== range.days;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.instagram.dailyReport(range.days);
        if (cancelled) return;
        setReport(res);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiRequestError ? err.message : "Couldn't load the report.");
      } finally {
        if (!cancelled) setLoadedFor(range.days);
      }
    })();
    return () => { cancelled = true; };
  }, [range.days]);

  const rows = report?.rows ?? [];
  const today = rows[0];
  const yesterday = rows[1];

  // Oldest first for the chart; newest first reads better in the table.
  const chart = rows
    .filter((r) => r.followers !== null)
    .slice()
    .reverse()
    .map((r) => ({ date: r.date, followers: r.followers ?? 0 }));

  const anyEstimated = rows.some((r) => r.lostSource === "derived");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Follower growth</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            How your audience changed, day by day. Source: Instagram Graph API.
          </p>
        </div>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {error && (
        <Card className="flex items-start gap-3 border-danger/30 bg-danger/[0.06] p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </Card>
      )}

      {/* Latest day at a glance */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Followers" value={today?.followers ?? null} loading={stale}
          delta={today?.net ?? null} deltaSuffix="since yesterday"
          help="Total people following this account right now."
          unavailable="Waiting for the first daily sync"
        />
        <MetricCard
          label="New followers" value={today?.gained ?? yesterday?.gained ?? null} loading={stale}
          help="People who started following on the most recent day with data. Meta reports this figure roughly two days behind."
          unavailable="Meta hasn't published this day yet"
        />
        <MetricCard
          label="Unfollows" value={today?.lost ?? yesterday?.lost ?? null} loading={stale} inverse
          provenance={(today?.lostSource ?? yesterday?.lostSource) === "derived" ? "derived" : "measured"}
          help="People who stopped following. Meta reports this directly."
          unavailable="Meta hasn't published this day yet"
        />
        <MetricCard
          label="Net growth" value={report?.totals?.net ?? null} loading={stale}
          help={`New followers minus unfollows across ${range.label.toLowerCase()}.`}
          unavailable="Needs two days of history"
        />
      </div>

      {/* Growth chart */}
      <Card className="p-5">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Followers over time</p>
        {stale ? (
          <div className="mt-3 h-[200px] animate-pulse rounded-lg bg-muted/40" />
        ) : chart.length < 2 ? (
          <div className="mt-3 flex h-[200px] flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
            <p className="text-sm font-medium">Not enough history yet</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              The chart needs at least two days of readings. It fills in as the daily sync runs.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chart} margin={{ top: 12, right: 8, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="followersFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="date" tickFormatter={shortDate} minTickGap={28}
                tickLine={false} axisLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              />
              <YAxis
                domain={["dataMin - 5", "dataMax + 5"]} width={52}
                tickLine={false} axisLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              />
              <RTooltip
                contentStyle={{
                  background: "var(--popover)", border: "1px solid var(--border)",
                  borderRadius: 10, fontSize: 12, color: "var(--popover-foreground)",
                }}
                labelFormatter={(l) => shortDate(String(l))}
                formatter={(v) => [Number(v).toLocaleString(), "Followers"]}
              />
              <Area type="monotone" dataKey="followers" stroke="var(--accent)" strokeWidth={2} fill="url(#followersFill)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Day-by-day table */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold">Daily report</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{range.label}</p>
          </div>
          {anyEstimated && (
            <Tooltip content={<span className="block max-w-[260px] leading-snug">Rows marked with a dot were recorded before Meta&apos;s unfollow figure was available, so that number is an estimate.</span>}>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Info className="size-3.5" /> Some values estimated
              </span>
            </Tooltip>
          )}
        </div>

        {stale ? (
          <div className="h-56 animate-pulse bg-muted/40" />
        ) : rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            No data for this period yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {["Date", "Followers", "New", "Unfollows", "Net"].map((h) => (
                    <th key={h} className="px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.date} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                    <td className="px-5 py-2.5 font-medium">{longDate(r.date)}</td>
                    <Cell v={r.followers} />
                    <Cell v={r.gained} tone={r.gained ? "good" : undefined} />
                    <td className={cn("px-5 py-2.5 tabular-nums", r.lost === null && "text-muted-foreground/40")}>
                      {r.lost === null ? "—" : (
                        <span className={cn(r.lost > 0 && "text-danger")}>
                          {r.lost.toLocaleString()}
                          {r.lostSource === "derived" && (
                            <Tooltip content="Estimated — recorded before Meta's unfollow figure was available.">
                              <span className="ml-1 cursor-help text-muted-foreground">•</span>
                            </Tooltip>
                          )}
                        </span>
                      )}
                    </td>
                    <td className={cn("px-5 py-2.5 tabular-nums font-medium", r.net === null ? "text-muted-foreground/40" : r.net > 0 ? "text-success" : r.net < 0 ? "text-danger" : "")}>
                      {r.net === null ? "—" : `${r.net > 0 ? "+" : ""}${r.net}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Cell({ v, tone }: { v: number | null; tone?: "good" }) {
  return (
    <td className={cn("px-5 py-2.5 tabular-nums", v === null && "text-muted-foreground/40", tone === "good" && v ? "text-success" : "")}>
      {v === null ? "—" : v.toLocaleString()}
    </td>
  );
}

const shortDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

const longDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};
