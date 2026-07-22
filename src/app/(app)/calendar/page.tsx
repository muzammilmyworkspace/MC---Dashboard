"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { dayPlans, type DayPlan, type ReviewStatus, users, currentUser } from "@/lib/data";
import { useUI } from "@/lib/store";
import { celebrate } from "@/lib/confetti";
import { DayCard } from "@/components/calendar/day-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function SocialMediaPostingPage() {
  const { viewAs } = useUI();
  const reviewer = users.find((u) => u.role === viewAs) ?? currentUser;

  const [plans, setPlans] = useState<DayPlan[]>(dayPlans);
  const today = useMemo(() => new Date(), []);
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selected, setSelected] = useState(ymd(today));

  const stripRef = useRef<HTMLButtonElement>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const monthPlans = useMemo(
    () => plans.filter((p) => { const d = new Date(p.date + "T00:00:00"); return d.getFullYear() === view.year && d.getMonth() === view.month; }),
    [plans, view]
  );
  const days = useMemo(() => {
    const count = new Date(view.year, view.month + 1, 0).getDate();
    return Array.from({ length: count }, (_, i) => new Date(view.year, view.month, i + 1));
  }, [view]);

  // keep selected chip centered in the strip
  useEffect(() => { stripRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" }); }, [selected, view]);

  // scroll-spy: highlight the day currently in view
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) { const d = (visible.target as HTMLElement).dataset.date; if (d) setSelected(d); }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.25, 0.5, 1] }
    );
    Object.values(cardRefs.current).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [monthPlans]);

  function jumpTo(key: string) {
    setSelected(key);
    cardRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function goToday() { setView({ year: today.getFullYear(), month: today.getMonth() }); setTimeout(() => jumpTo(ymd(today)), 60); }
  function shiftMonth(delta: number) { setView((v) => { const d = new Date(v.year, v.month + delta, 1); return { year: d.getFullYear(), month: d.getMonth() }; }); }

  function savePlan(updated: DayPlan) { setPlans((prev) => prev.map((p) => (p.date === updated.date ? updated : p))); }
  function addReview(date: string, status: ReviewStatus, comment: string) {
    const review = { id: crypto.randomUUID(), author: reviewer.id, at: new Date().toISOString(), status, comment };
    const nextStatus: DayPlan["status"] = status === "approved" ? "approved" : status === "rejected" ? "draft" : "client_review";
    setPlans((prev) => prev.map((p) => (p.date === date ? { ...p, reviews: [...p.reviews, review], status: nextStatus } : p)));
    if (status === "approved") { celebrate(); toast.success("Content approved 🎉", { description: "Moving to scheduling." }); }
    else if (status === "rejected") toast.error("Changes requested", { description: comment });
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-accent">Social Media Posting</p>
          <h2 className="mt-1 text-[28px] font-semibold tracking-tight">{MONTHS[view.month]} <span className="text-muted-foreground">{view.year}</span></h2>
          <p className="mt-1 text-sm text-muted-foreground">Scroll the month, or tap a date to jump · {monthPlans.length} days planned</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border">
            <button onClick={() => shiftMonth(-1)} className="flex size-9 items-center justify-center rounded-l-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><ChevronLeft className="size-4" /></button>
            <div className="h-9 w-px bg-border" />
            <button onClick={() => shiftMonth(1)} className="flex size-9 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><ChevronRight className="size-4" /></button>
          </div>
          <Button variant="secondary" size="sm" onClick={goToday}>Today</Button>
        </div>
      </div>

      {/* Sticky clean calendar strip (no dots) */}
      <div className="sticky top-16 z-10 -mx-1 rounded-2xl border border-border bg-card/85 p-2 shadow-card backdrop-blur-xl">
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {days.map((d) => {
            const key = ymd(d);
            const isSelected = key === selected;
            const isToday = key === ymd(today);
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
                {isToday && !isSelected && <span className="absolute bottom-1.5 size-1 rounded-full bg-accent" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Vertical month of day cards */}
      {monthPlans.length > 0 ? (
        <div className="space-y-4">
          {monthPlans.map((p) => (
            <div key={p.date} data-date={p.date} ref={(el) => { cardRefs.current[p.date] = el; }}>
              <DayCard plan={p} onSave={savePlan} onReview={addReview} />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
          <p className="font-medium">No content planned for {MONTHS[view.month]}</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">The full plan is loaded for July 2026.</p>
          <Button size="sm" className="mt-4" onClick={goToday}>Go to July</Button>
        </div>
      )}
    </div>
  );
}
