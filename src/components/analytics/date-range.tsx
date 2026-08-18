"use client";

import { useState } from "react";
import { CalendarDays, Check } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Date range for every analytics surface.
 *
 * Replaces the fixed 7d/30d/90d buttons. Those covered three answers to a
 * question people ask in many shapes — yesterday, this fortnight, last month,
 * "the week of the campaign". `days` still drives the API, so a custom range
 * is just another day count rather than a separate code path.
 */
export interface DateRange {
  days: number;
  label: string;
  /** Set only for an explicit custom range. */
  from?: string;
  to?: string;
}

export const RANGE_PRESETS: DateRange[] = [
  { days: 1, label: "Today" },
  { days: 2, label: "Yesterday" },
  { days: 7, label: "Last 7 days" },
  { days: 14, label: "Last 14 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
];

export const DEFAULT_RANGE = RANGE_PRESETS[4];

function isoDaysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

export function DateRangePicker({
  value,
  onChange,
  className,
}: {
  value: DateRange;
  onChange: (r: DateRange) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(isoDaysAgo(30));
  const [to, setTo] = useState(isoDaysAgo(0));

  function applyCustom() {
    const start = new Date(from);
    const end = new Date(to);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return;

    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
    onChange({
      days,
      label: `${start.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${end.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`,
      from,
      to,
    });
    setOpen(false);
  }

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-[13px] font-medium transition-colors hover:border-accent/40",
            className
          )}
        >
          <CalendarDays className="size-4 text-muted-foreground" />
          {value.label}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 w-64 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-card"
        >
          {RANGE_PRESETS.map((p) => (
            <DropdownMenu.Item
              key={p.label}
              onSelect={() => onChange(p)}
              className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-[13px] outline-none data-[highlighted]:bg-muted"
            >
              {p.label}
              {value.label === p.label && <Check className="size-4 text-accent" />}
            </DropdownMenu.Item>
          ))}

          <div className="my-1.5 h-px bg-border" />

          {/* Kept open on interaction — selecting a date must not dismiss the menu. */}
          <div
            className="space-y-2 px-2 pb-1 pt-0.5"
            onKeyDown={(e) => e.stopPropagation()}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Custom range
            </p>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
              />
              <span className="text-xs text-muted-foreground">–</span>
              <input
                type="date"
                value={to}
                min={from}
                max={isoDaysAgo(0)}
                onChange={(e) => setTo(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
              />
            </div>
            <button
              onClick={applyCustom}
              className="h-8 w-full rounded-md bg-accent text-xs font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
            >
              Apply
            </button>
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
