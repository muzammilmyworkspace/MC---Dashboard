"use client";

import { Info, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Where a number came from.
 *
 * Shown to the reader as a plain sentence, never as a raw label — the point
 * is that an estimate is never mistaken for a measurement.
 */
export type Provenance = "measured" | "derived" | "manual";

export interface MetricCardProps {
  label: string;
  value: number | string | null;
  /** One line, written for someone who has never heard of an API. */
  help: string;
  /** Change vs the previous comparable period. */
  delta?: number | null;
  deltaSuffix?: string;
  /** Higher is worse — unfollows, cost per click. Flips the colour. */
  inverse?: boolean;
  provenance?: Provenance;
  prefix?: string;
  suffix?: string;
  loading?: boolean;
  /** Shown in place of the value when the API genuinely has nothing. */
  unavailable?: string;
}

const PROVENANCE_NOTE: Record<Provenance, string> = {
  measured: "Reported directly by the platform.",
  derived: "Calculated from other figures — treat as an estimate.",
  manual: "Recorded by your team in this dashboard.",
};

export function MetricCard({
  label, value, help, delta, deltaSuffix = "vs previous", inverse,
  provenance = "measured", prefix, suffix, loading, unavailable,
}: MetricCardProps) {
  if (loading) {
    return <Card className="h-[104px] animate-pulse bg-muted/40" />;
  }

  const hasValue = value !== null && value !== undefined && value !== "";
  const display = hasValue
    ? `${prefix ?? ""}${typeof value === "number" ? value.toLocaleString() : value}${suffix ?? ""}`
    : null;

  const good = delta === undefined || delta === null || delta === 0 ? null : inverse ? delta < 0 : delta > 0;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <Tooltip
          content={
            <span className="block max-w-[240px] leading-snug">
              {help}
              {provenance !== "measured" && (
                <span className="mt-1 block opacity-75">{PROVENANCE_NOTE[provenance]}</span>
              )}
            </span>
          }
        >
          <button
            type="button"
            aria-label={`What is ${label}?`}
            className="text-muted-foreground/50 transition-colors hover:text-accent"
          >
            <Info className="size-3.5" />
          </button>
        </Tooltip>
      </div>

      {display === null ? (
        <>
          <p className="mt-2 text-2xl font-semibold text-muted-foreground/40">—</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{unavailable ?? "Not available yet"}</p>
        </>
      ) : (
        <>
          <p className="mt-2 text-[26px] font-semibold leading-none tabular-nums">{display}</p>
          {delta !== undefined && delta !== null ? (
            <p
              className={cn(
                "mt-1.5 inline-flex items-center gap-1 text-xs font-medium",
                good === null ? "text-muted-foreground" : good ? "text-success" : "text-danger"
              )}
            >
              {delta === 0 ? (
                <Minus className="size-3.5" />
              ) : delta > 0 ? (
                <ArrowUpRight className="size-3.5" />
              ) : (
                <ArrowDownRight className="size-3.5" />
              )}
              {delta > 0 ? "+" : ""}
              {delta.toLocaleString()} <span className="font-normal text-muted-foreground">{deltaSuffix}</span>
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">&nbsp;</p>
          )}
        </>
      )}
    </Card>
  );
}
