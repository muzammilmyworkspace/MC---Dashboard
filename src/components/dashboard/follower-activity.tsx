"use client";

import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 *  Daily follower activity
 *
 *  Day-by-day follows and unfollows, both measured by Meta. This is the
 *  series with real depth — follower snapshots exist only for the days
 *  the sync ran, while this pair goes back a month.
 *
 *  Follows are drawn upward and unfollows downward from a zero line, so
 *  a day that lost more than it gained reads as below the line at a
 *  glance rather than needing the numbers compared.
 * ------------------------------------------------------------------ */

export interface ActivityDay {
  date: string;
  gained: number | null;
  lost: number | null;
}

export interface ActivityTotals {
  gained: number | null;
  lost: number | null;
  net: number | null;
  daysCovered: number;
}

const GAIN = "#16a34a";
const LOSS = "#dc2626";

const shortDate = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });

export function FollowerActivityCard({
  history,
  totals,
  windowDays,
  loading,
}: {
  history: ActivityDay[];
  totals: ActivityTotals;
  windowDays: number;
  loading: boolean;
}) {
  if (loading) return <Card className="h-[300px] animate-pulse bg-muted/40" />;

  // Only days Meta has published. The most recent two are normally empty
  // because the metric settles about two days late, and drawing them as
  // zero would show a cliff that never happened.
  const series = history
    .filter((d) => d.gained !== null || d.lost !== null)
    .map((d) => ({
      date: d.date,
      gained: d.gained ?? 0,
      // Negative so the bar grows downward from the zero line.
      lost: -(d.lost ?? 0),
      net: (d.gained ?? 0) - (d.lost ?? 0),
    }));

  if (series.length === 0) {
    return (
      <Card className="flex h-[300px] flex-col items-center justify-center p-5 text-center">
        <p className="text-sm font-medium">No daily activity yet</p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          Meta publishes follows and unfollows about two days after the day itself. This fills in as the daily update
          runs.
        </p>
      </Card>
    );
  }

  const net = totals.net ?? 0;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Daily follower activity</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Who followed and unfollowed each day, measured by Meta.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Stat label="Followed" value={totals.gained} tone="good" help="Total new follows across this window." />
          <Stat label="Unfollowed" value={totals.lost} tone="bad" help="Total unfollows across this window." />
          <Stat
            label="Net"
            value={totals.net}
            tone={net >= 0 ? "good" : "bad"}
            signed
            help="New follows minus unfollows. This is the real change in audience size across the window."
          />
        </div>
      </div>

      <div className="mt-4">
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={series} margin={{ top: 6, right: 6, left: -14, bottom: 0 }} stackOffset="sign">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              minTickGap={28}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <YAxis
              width={44}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              // Unfollows are stored negative for the drawing; the axis shows
              // them as plain counts so nobody reads "-5 unfollows".
              tickFormatter={(v) => String(Math.abs(Number(v)))}
            />
            <ReferenceLine y={0} stroke="var(--border)" />
            <RTooltip
              cursor={{ fill: "var(--muted)", opacity: 0.35 }}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                fontSize: 12,
                color: "var(--popover-foreground)",
              }}
              labelFormatter={(l) => shortDate(String(l))}
              formatter={(v, n) => [
                Math.abs(Number(v)).toLocaleString(),
                n === "gained" ? "Followed" : "Unfollowed",
              ]}
            />
            <Bar dataKey="gained" name="gained" fill={GAIN} radius={[3, 3, 0, 0]} maxBarSize={26} />
            <Bar dataKey="lost" name="lost" fill={LOSS} radius={[0, 0, 3, 3]} maxBarSize={26} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        {totals.daysCovered} of the last {windowDays} days have published figures. Meta reports this about two days
        behind, so the most recent days stay empty until it catches up.
      </p>
    </Card>
  );
}

function Stat({
  label,
  value,
  tone,
  signed,
  help,
}: {
  label: string;
  value: number | null;
  tone: "good" | "bad";
  signed?: boolean;
  help: string;
}) {
  const text =
    value === null ? "—" : signed && value > 0 ? `+${value.toLocaleString()}` : value.toLocaleString();

  return (
    <Tooltip content={help}>
      <div className="cursor-help">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={cn("flex items-center gap-1 text-lg font-semibold tabular-nums", tone === "good" ? "text-success" : "text-danger")}>
          {value !== null && (tone === "good" ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />)}
          {text}
        </p>
      </div>
    </Tooltip>
  );
}
