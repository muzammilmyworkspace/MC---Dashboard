"use client";

import { ExternalLink } from "lucide-react";
import type { IgContentItem, IgGroupStats } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 *  Shared pieces for the analytics screen.
 *
 *  Every number renders through `num`, which draws an em dash for null.
 *  That is the single place the "no data is not zero" rule is enforced
 *  in the UI, so no section can quietly break it.
 * ------------------------------------------------------------------ */

export const num = (v: number | null | undefined, suffix = "") =>
  v === null || v === undefined ? "—" : `${v.toLocaleString()}${suffix}`;

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** Section heading used by every block, so spacing stays uniform. */
export function SectionHeading({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

/** A compact labelled figure. Used inside cards rather than as a card. */
export function Stat({
  label,
  value,
  help,
  tone,
}: {
  label: string;
  value: string;
  help?: string;
  tone?: "good" | "bad";
}) {
  const body = (
    <div className={help ? "cursor-help" : undefined}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-base font-semibold tabular-nums",
          tone === "good" && "text-success",
          tone === "bad" && "text-danger"
        )}
      >
        {value}
      </p>
    </div>
  );
  return help ? <Tooltip content={help}>{body}</Tooltip> : body;
}

/**
 * Group summary for reels or posts.
 *
 * Averages come from the backend, where they are divided by the number of
 * items that actually reported — not by the group size, which would drag the
 * average down for every post Meta had no figure for.
 */
export function GroupSummary({ stats, kind }: { stats: IgGroupStats; kind: "Reels" | "Posts" }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      <Stat label={kind} value={num(stats.count)} help={`How many ${kind.toLowerCase()} were published in this period.`} />
      <Stat label="Reach" value={num(stats.reach)} help="How many separate accounts saw this content." />
      <Stat label={kind === "Reels" ? "Plays" : "Views"} value={num(stats.views)} help="Total times the content was watched or viewed, repeat views included." />
      <Stat label="Likes" value={num(stats.likes)} />
      <Stat label={`Avg reach per ${kind === "Reels" ? "reel" : "post"}`} value={num(stats.avgReach)} help="Averaged across the items Instagram reported a figure for." />
      <Stat
        label="Engagement rate"
        value={stats.engagementRate === null ? "—" : `${stats.engagementRate}%`}
        help="Interactions divided by reach. Calculated from the totals, not averaged across posts."
      />
    </div>
  );
}

const TYPE_TONE: Record<string, string> = {
  Reel: "bg-accent/10 text-accent",
  Carousel: "bg-info/10 text-info",
  Post: "bg-muted text-muted-foreground",
};

/** Thumbnail + caption, linking out to the real post. */
export function ContentCell({ item }: { item: IgContentItem }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {item.thumbnailUrl ? (
        // Instagram CDN URLs are signed and expire, so next/image optimisation
        // would cache a link that dies; a plain img degrades to the alt text.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.thumbnailUrl}
          alt=""
          loading="lazy"
          className="size-10 shrink-0 rounded-md border border-border object-cover"
        />
      ) : (
        <div className="size-10 shrink-0 rounded-md border border-border bg-muted" />
      )}
      <div className="min-w-0">
        <p className="truncate text-xs font-medium">
          {item.caption?.trim() ? item.caption.slice(0, 60) : "No caption"}
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", TYPE_TONE[item.type])}>{item.type}</span>
          <span className="text-[10px] text-muted-foreground">{shortDate(item.timestamp)}</span>
          {item.permalink && (
            <a
              href={item.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground transition-colors hover:text-accent"
            >
              Open <ExternalLink className="size-2.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Content table.
 *
 * Wrapped in its own horizontal scroller so a wide table never pushes the
 * page sideways on a phone.
 */
export function ContentTable({
  items,
  kind,
  empty,
}: {
  items: IgContentItem[];
  kind: "reels" | "posts";
  empty: string;
}) {
  if (items.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{empty}</p>;
  }

  const isReels = kind === "reels";

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            {["Content", isReels ? "Plays" : "Views", "Reach", "Likes", "Comments", "Shares", "Saves", "Engagement"].map((h) => (
              <th
                key={h}
                className={cn(
                  "px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",
                  h !== "Content" && "text-right"
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
              <td className="max-w-[320px] px-3 py-2.5">
                <ContentCell item={item} />
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">{num(item.views)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{num(item.reach)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{num(item.likes)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{num(item.comments)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{num(item.shares)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{num(item.saves)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {item.engagementRate === null ? "—" : `${item.engagementRate}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Publishing frequency by weekday — where the gaps in a routine show up. */
export function PublishingHeatmap({
  byWeekday,
}: {
  byWeekday: { weekday: number; label: string; posts: number; reels: number; total: number }[];
}) {
  // Monday first, matching the weekly buckets.
  const ordered = [...byWeekday].sort((a, b) => ((a.weekday + 6) % 7) - ((b.weekday + 6) % 7));
  const max = Math.max(1, ...ordered.map((d) => d.total));

  return (
    <div className="grid grid-cols-7 gap-1.5">
      {ordered.map((d) => (
        <Tooltip
          key={d.weekday}
          content={`${d.label}: ${d.total} ${d.total === 1 ? "item" : "items"}${d.reels ? ` — ${d.reels} reels` : ""}${d.posts ? `, ${d.posts} posts` : ""}`}
        >
          <div className="cursor-help text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{d.label.slice(0, 3)}</p>
            <div
              className="mt-1 flex h-14 items-end justify-center rounded-lg border border-border"
              // Intensity carries the same information as the number, so the
              // pattern is visible before anything is read.
              style={{ background: `color-mix(in oklab, var(--accent) ${(d.total / max) * 22}%, transparent)` }}
            >
              <span className="pb-2 text-sm font-semibold tabular-nums">{d.total}</span>
            </div>
          </div>
        </Tooltip>
      ))}
    </div>
  );
}

export function EmptyBlock({ message }: { message: string }) {
  return (
    <Card className="p-8 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </Card>
  );
}
