"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * A custom "since / until" date range, opened from an arbitrary trigger
 * element — the equivalent of Meta Ads Manager's own calendar picker, just
 * two native date inputs instead of a full calendar widget.
 */
export function DateRangePicker({
  value,
  onApply,
  trigger,
}: {
  value: { since: string; until: string } | null;
  onApply: (since: string, until: string) => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [since, setSince] = useState(value?.since ?? daysAgoIso(30));
  const [until, setUntil] = useState(value?.until ?? todayIso());
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const invalid = !since || !until || since > until;

  return (
    <div ref={containerRef} className="relative">
      <span onClick={() => setOpen((v) => !v)}>{trigger}</span>
      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-64 rounded-xl border border-border bg-popover p-3 shadow-glow">
          <div className="space-y-2">
            <label className="block">
              <span className="text-[11px] font-medium text-muted-foreground">From</span>
              <Input type="date" value={since} max={until || undefined} onChange={(e) => setSince(e.target.value)} className="mt-1 h-8 text-xs" />
            </label>
            <label className="block">
              <span className="text-[11px] font-medium text-muted-foreground">To</span>
              <Input type="date" value={until} min={since || undefined} max={todayIso()} onChange={(e) => setUntil(e.target.value)} className="mt-1 h-8 text-xs" />
            </label>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={invalid}
              onClick={() => {
                onApply(since, until);
                setOpen(false);
              }}
            >
              Apply
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
