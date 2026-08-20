"use client";

import { useState } from "react";
import { CalendarDays, Check, ChevronDown, RefreshCw } from "lucide-react";
import type { IgGranularity } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 *  Date and period filter
 *
 *  Owns nothing but the selection. The screen re-queries the single
 *  analytics endpoint whenever this changes, so every card, chart and
 *  table moves together and cannot disagree about the period.
 * ------------------------------------------------------------------ */

export interface Range {
  startDate: string;
  endDate: string;
  label: string;
  granularity: IgGranularity;
}

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => iso(new Date(Date.now() - n * DAY));

/** Monday-start, matching how the backend buckets a week. */
function startOfWeek(offsetWeeks = 0): string {
  const now = new Date();
  const shift = (now.getUTCDay() + 6) % 7;
  return iso(new Date(now.getTime() - (shift + offsetWeeks * 7) * DAY));
}

function monthBounds(offset = 0): { start: string; end: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset + 1, 0));
  return { start: iso(start), end: iso(end) };
}

/**
 * Presets carry their own sensible granularity — a single day grouped by
 * month is one bar, and a year grouped by day is 365.
 */
export function presets(): Record<string, Range> {
  const today = iso(new Date());
  const thisMonth = monthBounds(0);
  const lastMonth = monthBounds(-1);
  const lastWeekStart = startOfWeek(1);

  return {
    today: { startDate: today, endDate: today, label: "Today", granularity: "daily" },
    yesterday: { startDate: daysAgo(1), endDate: daysAgo(1), label: "Yesterday", granularity: "daily" },
    last7: { startDate: daysAgo(6), endDate: today, label: "Last 7 days", granularity: "daily" },
    last14: { startDate: daysAgo(13), endDate: today, label: "Last 14 days", granularity: "daily" },
    last30: { startDate: daysAgo(29), endDate: today, label: "Last 30 days", granularity: "daily" },
    last90: { startDate: daysAgo(89), endDate: today, label: "Last 90 days", granularity: "weekly" },
    thisWeek: { startDate: startOfWeek(0), endDate: today, label: "This week", granularity: "daily" },
    lastWeek: {
      startDate: lastWeekStart,
      endDate: iso(new Date(new Date(`${lastWeekStart}T00:00:00Z`).getTime() + 6 * DAY)),
      label: "Last week",
      granularity: "daily",
    },
    thisMonth: { startDate: thisMonth.start, endDate: today, label: "This month", granularity: "daily" },
    lastMonth: { startDate: lastMonth.start, endDate: lastMonth.end, label: "Last month", granularity: "daily" },
  };
}

/**
 * Default view.
 *
 * Deliberately not "Today": Meta publishes follower and engagement figures
 * about two days late, so a dashboard opening on today would greet the client
 * with a screen of dashes. Thirty days shows the account as it stands.
 */
export const DEFAULT_RANGE: Range = presets().last30;

const ORDER = [
  "today", "yesterday", "last7", "last14", "last30", "last90",
  "thisWeek", "lastWeek", "thisMonth", "lastMonth",
] as const;

const GRANULARITIES: { key: IgGranularity; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
];

export function FilterBar({
  range,
  onChange,
  onRefresh,
  refreshing,
  lastSyncAt,
}: {
  range: Range;
  onChange: (r: Range) => void;
  onRefresh: () => void;
  refreshing: boolean;
  lastSyncAt: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState({ start: range.startDate, end: range.endDate });

  const all = presets();

  function applyCustom() {
    if (!custom.start || !custom.end || custom.start > custom.end) return;
    onChange({
      startDate: custom.start,
      endDate: custom.end,
      label: "Custom range",
      granularity: range.granularity,
    });
    setOpen(false);
  }

  return (
    <Card className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        {/* Period picker */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex h-9 items-center gap-2 rounded-lg border border-border bg-background/40 px-3 text-sm font-medium transition-colors hover:border-accent/40"
          >
            <CalendarDays className="size-4 text-muted-foreground" />
            {range.label}
            <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
          </button>

          {open && (
            <>
              {/* Click-away layer, so the menu closes like a native one. */}
              <button
                type="button"
                aria-label="Close period menu"
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setOpen(false)}
              />
              <div className="absolute left-0 top-11 z-50 w-[17rem] rounded-xl border border-border bg-popover p-1.5 shadow-glow">
                {ORDER.map((k) => {
                  const p = all[k];
                  const active = p.startDate === range.startDate && p.endDate === range.endDate;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        onChange(p);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors",
                        active ? "bg-accent/10 text-accent" : "hover:bg-muted"
                      )}
                    >
                      {p.label}
                      {active && <Check className="size-3.5" />}
                    </button>
                  );
                })}

                <div className="mt-1.5 border-t border-border pt-2.5">
                  <p className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Custom range
                  </p>
                  <div className="flex items-center gap-1.5 px-2">
                    <Input
                      type="date"
                      value={custom.start}
                      max={custom.end || undefined}
                      onChange={(e) => setCustom((c) => ({ ...c, start: e.target.value }))}
                      className="h-8 text-xs"
                      aria-label="Start date"
                    />
                    <span className="text-xs text-muted-foreground">to</span>
                    <Input
                      type="date"
                      value={custom.end}
                      min={custom.start || undefined}
                      max={iso(new Date())}
                      onChange={(e) => setCustom((c) => ({ ...c, end: e.target.value }))}
                      className="h-8 text-xs"
                      aria-label="End date"
                    />
                  </div>
                  <Button
                    size="sm"
                    className="mx-2 mt-2 w-[calc(100%-1rem)]"
                    onClick={applyCustom}
                    disabled={!custom.start || !custom.end || custom.start > custom.end}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Granularity */}
        <div className="flex items-center rounded-lg border border-border p-0.5">
          {GRANULARITIES.map((g) => (
            <button
              key={g.key}
              type="button"
              onClick={() => onChange({ ...range, granularity: g.key })}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                range.granularity === g.key ? "bg-accent text-white" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <p className="text-[11px] text-muted-foreground">
          {lastSyncAt
            ? `Last updated ${new Date(lastSyncAt).toLocaleString(undefined, {
                day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
              })}`
            : "Not updated yet"}
        </p>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
          <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />
          <span className="hidden sm:inline">{refreshing ? "Refreshing…" : "Refresh"}</span>
        </Button>
      </div>
    </Card>
  );
}
