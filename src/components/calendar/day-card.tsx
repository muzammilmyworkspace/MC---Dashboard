"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Pencil, Check, X, Languages, Play, ChevronLeft, ChevronRight,
  Upload, Download, ImageIcon, Film, Hash, Megaphone,
} from "lucide-react";
import { platformMeta, contentStatusMeta, type DayPlan, type ReviewStatus } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Draft { hook: string; content: string; hashtags: string; cta: string; }

export function DayCard({ plan, onSave, onReview }: { plan: DayPlan; onSave: (p: DayPlan) => void; onReview: (date: string, status: ReviewStatus, comment: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [lang, setLang] = useState<"en" | "nl">("en");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tab, setTab] = useState<"post" | "reel">(plan.post ? "post" : "reel");
  const [rejecting, setRejecting] = useState(false);
  const [comment, setComment] = useState("");
  const [slide, setSlide] = useState(0);

  const date = new Date(plan.date + "T00:00:00");
  const content = lang === "nl" ? plan.captionNl : plan.captions[plan.primaryPlatform];
  const decided = plan.status === "approved" || plan.status === "scheduled" || plan.status === "published";

  function startEdit() {
    setDraft({ hook: plan.reel.hook, content: plan.captions[plan.primaryPlatform], hashtags: plan.hashtags.join(" "), cta: plan.cta });
    setEditing(true);
  }
  function save() {
    if (!draft) return;
    onSave({
      ...plan,
      reel: { ...plan.reel, hook: draft.hook },
      captions: { ...plan.captions, [plan.primaryPlatform]: draft.content },
      hashtags: draft.hashtags.split(/[\s,]+/).filter(Boolean).map((h) => (h.startsWith("#") ? h : `#${h}`)),
      cta: draft.cta,
    });
    setEditing(false);
    toast.success("Saved", { description: "Content updated." });
  }
  function approve() { onReview(plan.date, "approved", ""); }
  function submitReject() {
    if (!comment.trim()) { toast.error("Comment required", { description: "Explain the requested changes." }); return; }
    onReview(plan.date, "rejected", comment.trim());
    setRejecting(false); setComment("");
  }

  const activeTab = tab === "post" && !plan.post ? "reel" : tab;

  return (
    <div className="scroll-mt-24 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      {/* Card header */}
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-5 py-3">
        <div className="flex items-baseline gap-2.5">
          <span className="text-sm font-semibold">{date.toLocaleDateString("en-US", { weekday: "long" })}</span>
          <span className="text-sm text-muted-foreground">{date.toLocaleDateString("en-US", { month: "long", day: "numeric" })}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{platformMeta[plan.primaryPlatform].label}</span>
          <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ background: contentStatusMeta[plan.status].color }}>{contentStatusMeta[plan.status].label}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 items-stretch lg:grid-cols-[45fr_55fr]">
        {/* Left — editor */}
        <div className="flex flex-col border-b border-border p-5 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Content editor</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setLang(lang === "en" ? "nl" : "en")} className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-accent/50 hover:text-accent" title="Translate">
                <Languages className="size-3.5" /> {lang.toUpperCase()}
              </button>
              {!editing && (
                <button onClick={startEdit} className="flex size-7 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-accent/50 hover:text-accent" title="Edit">
                  <Pencil className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          {editing && draft ? (
            <div className="flex flex-1 flex-col gap-3">
              <Labeled label="Hook"><Input value={draft.hook} onChange={(e) => setDraft({ ...draft, hook: e.target.value })} /></Labeled>
              <Labeled label="Content">
                <textarea value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} rows={5} className="w-full flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20" />
              </Labeled>
              <Labeled label="Hashtags"><Input value={draft.hashtags} onChange={(e) => setDraft({ ...draft, hashtags: e.target.value })} /></Labeled>
              <Labeled label="CTA"><Input value={draft.cta} onChange={(e) => setDraft({ ...draft, cta: e.target.value })} /></Labeled>
              <div className="mt-auto flex gap-2 pt-1">
                <Button className="flex-1" size="sm" onClick={save}><Check className="size-4" /> Save</Button>
                <Button variant="secondary" size="sm" className="flex-1" onClick={() => setEditing(false)}><X className="size-4" /> Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col gap-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Hook</p>
                <h3 className="mt-1 text-base font-semibold leading-snug">{plan.reel.hook}</h3>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Content</p>
                <AnimatePresence mode="wait">
                  <motion.p key={lang} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }} className="mt-1 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                    {content}
                  </motion.p>
                </AnimatePresence>
              </div>
              <div>
                <p className="mb-1 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"><Hash className="size-3" /> Hashtags</p>
                <div className="flex flex-wrap gap-1.5">{plan.hashtags.map((h) => <span key={h} className="rounded-md bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">{h}</span>)}</div>
              </div>
              <div>
                <p className="mb-1 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"><Megaphone className="size-3" /> CTA</p>
                <p className="text-sm">{plan.cta}</p>
              </div>
            </div>
          )}
        </div>

        {/* Right — preview + review */}
        <div className="flex flex-col p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              {(["post", "reel"] as const).map((t) => {
                const disabled = t === "post" && !plan.post;
                const active = activeTab === t;
                return (
                  <button key={t} disabled={disabled} onClick={() => setTab(t)} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors", disabled && "cursor-not-allowed opacity-40", active ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground")}>
                    {t === "post" ? <ImageIcon className="size-3.5" /> : <Film className="size-3.5" />} {t}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => toast("Upload", { description: "Media uploader would open." })} className="flex size-7 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-accent/50 hover:text-accent" title="Upload"><Upload className="size-3.5" /></button>
              <button onClick={() => toast("Download started", { description: `${activeTab === "reel" ? "Reel" : "Post"} asset would download.` })} className="flex size-7 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-accent/50 hover:text-accent" title="Download"><Download className="size-3.5" /></button>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center rounded-xl bg-background-subtle p-4">
            <Media plan={plan} tab={activeTab} slide={slide} setSlide={setSlide} />
          </div>

          {/* Review */}
          <div className="mt-4">
            <AnimatePresence initial={false} mode="wait">
              {rejecting ? (
                <motion.div key="reject" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-2 overflow-hidden">
                  <textarea autoFocus value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="Please explain the requested changes..." className="w-full resize-none rounded-xl border border-danger/40 bg-background px-3 py-2 text-sm outline-none focus:border-danger focus:ring-2 focus:ring-danger/15" />
                  <div className="flex gap-2">
                    <Button variant="danger" size="sm" className="flex-1" onClick={submitReject}><X className="size-4" /> Submit</Button>
                    <Button variant="secondary" size="sm" onClick={() => { setRejecting(false); setComment(""); }}>Cancel</Button>
                  </div>
                </motion.div>
              ) : decided ? (
                <div className="flex items-center justify-center gap-2 rounded-xl bg-success/10 py-2.5 text-sm font-medium text-success"><Check className="size-4" /> Approved</div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="success" size="sm" onClick={approve}><Check className="size-4" /> Approve</Button>
                  <Button variant="danger" size="sm" onClick={() => setRejecting(true)}><X className="size-4" /> Reject</Button>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={label === "Content" ? "flex flex-1 flex-col" : ""}>
      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function Media({ plan, tab, slide, setSlide }: { plan: DayPlan; tab: "post" | "reel"; slide: number; setSlide: (n: number) => void }) {
  const isReel = tab === "reel";
  const isCarousel = !isReel && plan.post?.type === "carousel";
  const slides = plan.post?.slides ?? 1;
  const aspect = isReel ? "aspect-[9/16] max-h-[300px]" : "aspect-square w-full max-w-[280px]";
  return (
    <div className={cn("relative overflow-hidden rounded-2xl shadow-glow", aspect)} style={{ background: plan.gradient }}>
      <div className="absolute inset-0 flex items-center justify-center text-6xl">{plan.emoji}</div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-black/10" />
      {isReel && <div className="absolute inset-0 flex items-center justify-center"><div className="flex size-14 items-center justify-center rounded-full bg-white/25 backdrop-blur-md ring-1 ring-white/40"><Play className="size-6 fill-white text-white" /></div></div>}
      {isCarousel && (
        <>
          <button onClick={() => setSlide((slide - 1 + slides) % slides)} className="absolute left-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/25 text-white backdrop-blur-md hover:bg-white/40"><ChevronLeft className="size-4" /></button>
          <button onClick={() => setSlide((slide + 1) % slides)} className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/25 text-white backdrop-blur-md hover:bg-white/40"><ChevronRight className="size-4" /></button>
          <div className="absolute inset-x-0 bottom-2.5 flex justify-center gap-1">{Array.from({ length: slides }).map((_, i) => <span key={i} className={cn("h-1.5 rounded-full transition-all", i === slide ? "w-4 bg-white" : "w-1.5 bg-white/50")} />)}</div>
        </>
      )}
      <div className="absolute inset-x-0 bottom-0 p-3"><div className="flex items-center gap-2 text-xs font-medium text-white"><span>{platformMeta[plan.primaryPlatform].emoji}</span><span className="truncate">{plan.cta}</span></div></div>
    </div>
  );
}
