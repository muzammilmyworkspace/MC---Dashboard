"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, CalendarDays, Plus, CalendarPlus } from "lucide-react";
import { usePosting } from "@/lib/posting";
import { ContentBlockCard } from "@/components/posting/content-block";
import { PageHeader, EmptyState } from "@/components/ui/page-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function SocialMediaPostingPage() {
  const { days, addBlock, removeBlock } = usePosting();
  const today = useMemo(() => new Date(), []);
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selected, setSelected] = useState(ymd(today));
  const [confirm, setConfirm] = useState<{ date: string; blockId: string } | null>(null);

  const stripRef = useRef<HTMLButtonElement>(null);
  const dayRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const monthDays = useMemo(() => {
    const count = new Date(view.year, view.month + 1, 0).getDate();
    return Array.from({ length: count }, (_, i) => new Date(view.year, view.month, i + 1));
  }, [view]);

  useEffect(() => { stripRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" }); }, [selected, view]);

  const totalBlocks = monthDays.reduce((n, d) => n + (days[ymd(d)]?.length ?? 0), 0);

  function jumpTo(key: string) {
    setSelected(key);
    dayRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function goToday() {
    setView({ year: today.getFullYear(), month: today.getMonth() });
    setTimeout(() => jumpTo(ymd(today)), 60);
  }
  function shiftMonth(delta: number) {
    setView((v) => { const d = new Date(v.year, v.month + delta, 1); return { year: d.getFullYear(), month: d.getMonth() }; });
  }
  function add(date: string) {
    addBlock(date);
    setSelected(date);
    toast.success("Post added", { description: "Fill in the content and upload media." });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        icon={CalendarDays}
        eyebrow="Social Media Posting"
        title={`${MONTHS[view.month]} ${view.year}`}
        description="Plan every post for the month. Pick a day, add a post, write the content and upload the media."
        actions={
          <>
            <div className="flex items-center rounded-lg border border-border">
              <button onClick={() => shiftMonth(-1)} aria-label="Previous month" className="flex size-9 items-center justify-center rounded-l-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><ChevronLeft className="size-4" /></button>
              <div className="h-9 w-px bg-border" />
              <button onClick={() => shiftMonth(1)} aria-label="Next month" className="flex size-9 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><ChevronRight className="size-4" /></button>
            </div>
            <Button variant="secondary" size="sm" onClick={goToday}>Today</Button>
            <Button size="sm" onClick={() => add(selected)}><Plus className="size-4" /> Add post</Button>
          </>
        }
      />

      {/* Clean date strip */}
      <div className="sticky top-16 z-10 rounded-2xl border border-border bg-card/85 p-2 shadow-card backdrop-blur-xl">
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {monthDays.map((d) => {
            const key = ymd(d);
            const isSelected = key === selected;
            const isToday = key === ymd(today);
            const count = days[key]?.length ?? 0;
            return (
              <button
                key={key}
                ref={isSelected ? stripRef : undefined}
                onClick={() => jumpTo(key)}
                className={cn("relative flex h-[62px] w-12 shrink-0 flex-col items-center justify-center rounded-xl transition-colors", isSelected ? "text-accent-foreground" : "text-foreground hover:bg-muted")}
              >
                {isSelected && <motion.div layoutId="posting-selected" className="absolute inset-0 rounded-xl bg-accent" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
                <span className={cn("relative z-10 text-[10px] font-medium uppercase tracking-wide", isSelected ? "text-accent-foreground/70" : "text-muted-foreground")}>{WEEKDAYS[d.getDay()]}</span>
                <span className="relative z-10 mt-0.5 text-base font-semibold">{d.getDate()}</span>
                {count > 0 && <span className={cn("relative z-10 mt-0.5 text-[9px] font-semibold", isSelected ? "text-accent-foreground/80" : "text-accent")}>{count}</span>}
                {isToday && !isSelected && <span className="absolute bottom-1.5 size-1 rounded-full bg-accent" />}
              </button>
            );
          })}
        </div>
      </div>

      {totalBlocks === 0 && (
        <EmptyState
          icon={CalendarPlus}
          title="Nothing planned this month yet"
          description="Choose a day below and add your first post. Everything you write is saved automatically."
          action={<Button onClick={() => add(selected)}><Plus className="size-4" /> Add your first post</Button>}
        />
      )}

      {/* Month — one section per day */}
      <div className="space-y-4">
        {monthDays.map((d) => {
          const key = ymd(d);
          const blocks = days[key] ?? [];
          const isToday = key === ymd(today);
          return (
            <div key={key} data-date={key} ref={(el) => { dayRefs.current[key] = el; }} className="scroll-mt-32 space-y-3">
              <div className={cn("flex items-center gap-3 rounded-xl border px-4 py-2.5", blocks.length ? "border-border bg-card shadow-card" : "border-dashed border-border bg-card/40")}>
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold">{d.getDate()}</span>
                  <span className="text-sm text-muted-foreground">{WEEKDAYS[d.getDay()]}</span>
                  {isToday && <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">Today</span>}
                </div>
                <span className="flex-1 text-xs text-muted-foreground">
                  {blocks.length === 0 ? "No posts planned" : `${blocks.length} post${blocks.length > 1 ? "s" : ""}`}
                </span>
                <button
                  onClick={() => add(key)}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-accent/50 hover:text-accent"
                >
                  <Plus className="size-3.5" /> Add post
                </button>
              </div>

              {blocks.map((b, i) => (
                <ContentBlockCard key={b.id} date={key} block={b} index={i} onRemove={() => setConfirm({ date: key, blockId: b.id })} />
              ))}
            </div>
          );
        })}
      </div>

      {/* Remove confirmation */}
      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="p-6">
          <DialogTitle>Remove this post?</DialogTitle>
          <p className="mt-2 text-sm text-muted-foreground">The content and media for this post will be deleted. This can&apos;t be undone.</p>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirm) removeBlock(confirm.date, confirm.blockId);
                setConfirm(null);
                toast("Post removed");
              }}
            >
              Remove post
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
