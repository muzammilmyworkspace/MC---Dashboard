"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Check,
  X,
  MessageSquare,
  Send,
  Calendar,
  RefreshCw,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import {
  contentItems as seed,
  platformMeta,
  contentStatusMeta,
  userById,
  currentUser,
  type ContentItem,
  type ContentStatus,
} from "@/lib/data";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { celebrate } from "@/lib/confetti";
import { relativeTime, formatDate, cn } from "@/lib/utils";

const filters: { key: ContentStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "internal_review", label: "Internal Review" },
  { key: "client_review", label: "Client Review" },
  { key: "approved", label: "Approved" },
  { key: "scheduled", label: "Scheduled" },
  { key: "published", label: "Published" },
];

const workflow: ContentStatus[] = ["draft", "internal_review", "client_review", "approved", "scheduled", "published"];

export default function ApprovalsPage() {
  const [items, setItems] = useState<ContentItem[]>(seed);
  const [filter, setFilter] = useState<ContentStatus | "all">("all");
  const [active, setActive] = useState<ContentItem | null>(null);

  const shown = filter === "all" ? items : items.filter((i) => i.status === filter);

  function setStatus(id: string, status: ContentStatus, note?: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
    setActive((a) => (a && a.id === id ? { ...a, status } : a));
    if (status === "approved") {
      celebrate();
      toast.success("Content approved 🎉", { description: note });
    } else if (status === "rejected") {
      toast.error("Changes requested", { description: note });
    }
  }

  function addComment(id: string, text: string) {
    const c = { id: crypto.randomUUID(), author: currentUser.id, text, at: new Date().toISOString() };
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, comments: [...i.comments, c] } : i)));
    setActive((a) => (a && a.id === id ? { ...a, comments: [...a.comments, c] } : a));
  }

  const pending = items.filter((i) => i.status === "client_review" || i.status === "internal_review").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Content Approval</h2>
          <p className="text-sm text-muted-foreground">{pending} awaiting review · real-time client collaboration</p>
        </div>
        <Badge variant="default" className="w-fit"><Sparkles className="size-3" /> Live · Socket-ready</Badge>
      </div>

      {/* Filters */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {filters.map((f) => {
          const count = f.key === "all" ? items.length : items.filter((i) => i.status === f.key).length;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                filter === f.key ? "border-accent bg-accent/15 text-accent" : "border-border text-muted-foreground hover:border-accent/40"
              )}
            >
              {f.label}
              <span className={cn("rounded-full px-1.5 text-xs", filter === f.key ? "bg-accent/20" : "bg-muted")}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <motion.div layout className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {shown.map((c) => (
            <motion.div
              key={c.id}
              layout
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.25 }}
            >
              <ContentCard item={c} onOpen={() => setActive(c)} />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      <ApprovalDetail
        item={active}
        open={!!active}
        onClose={() => setActive(null)}
        onSetStatus={setStatus}
        onComment={addComment}
      />
    </div>
  );
}

function ContentCard({ item, onOpen }: { item: ContentItem; onOpen: () => void }) {
  const pm = platformMeta[item.platform];
  const sm = contentStatusMeta[item.status];
  const creator = userById(item.creator);
  return (
    <Card onClick={onOpen} className="group cursor-pointer overflow-hidden p-0 transition-all hover:-translate-y-1 hover:shadow-glow">
      <div className="relative flex h-40 items-center justify-center overflow-hidden text-5xl" style={{ background: item.gradient }}>
        <span className="transition-transform duration-500 group-hover:scale-110">{item.emoji}</span>
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
          <span>{pm.emoji}</span> {pm.label}
        </div>
        <span className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm" style={{ background: `${sm.color}cc` }}>
          {sm.label}
        </span>
      </div>
      <div className="p-4">
        <p className="font-semibold leading-snug">{item.title}</p>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.caption}</p>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar name={creator.name} color={creator.avatarColor} size={24} />
            <span className="text-xs text-muted-foreground">{creator.name.split(" ")[0]}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><MessageSquare className="size-3" /> {item.comments.length}</span>
            <span className="flex items-center gap-1"><RefreshCw className="size-3" /> v{item.revision}</span>
            <span className="flex items-center gap-1"><Calendar className="size-3" /> {formatDate(item.publishAt)}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

function ApprovalDetail({
  item,
  open,
  onClose,
  onSetStatus,
  onComment,
}: {
  item: ContentItem | null;
  open: boolean;
  onClose: () => void;
  onSetStatus: (id: string, s: ContentStatus, note?: string) => void;
  onComment: (id: string, text: string) => void;
}) {
  const [text, setText] = useState("");
  if (!item) return null;
  const pm = platformMeta[item.platform];
  const sm = contentStatusMeta[item.status];
  const creator = userById(item.creator);
  const reviewer = userById(item.reviewer);
  const decided = item.status === "approved" || item.status === "published" || item.status === "scheduled";
  const stepIndex = workflow.indexOf(item.status === "rejected" ? "client_review" : item.status);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent side="right" className="flex flex-col p-0">
        {/* Preview */}
        <div className="relative flex h-52 items-center justify-center text-7xl" style={{ background: item.gradient }}>
          <span>{item.emoji}</span>
          <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 text-sm font-medium text-white backdrop-blur">
            {pm.emoji} {pm.label}
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white" style={{ background: sm.color }}>{sm.label}</span>
              <span className="text-xs text-muted-foreground">Revision {item.revision}</span>
            </div>
            <DialogTitle>{item.title}</DialogTitle>
          </div>

          {/* Workflow stepper */}
          <div className="flex items-center justify-between">
            {workflow.map((w, i) => (
              <div key={w} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex w-full items-center">
                  <div className={cn("h-0.5 flex-1", i === 0 ? "opacity-0" : i <= stepIndex ? "bg-accent" : "bg-border")} />
                  <div className={cn("flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold", i <= stepIndex ? "bg-accent text-white" : "border border-border bg-card text-muted-foreground")}>
                    {i < stepIndex ? <Check className="size-3" /> : i + 1}
                  </div>
                  <div className={cn("h-0.5 flex-1", i === workflow.length - 1 ? "opacity-0" : i < stepIndex ? "bg-accent" : "bg-border")} />
                </div>
                <span className="text-[9px] text-muted-foreground">{contentStatusMeta[w].label.split(" ")[0]}</span>
              </div>
            ))}
          </div>

          {/* Caption */}
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Caption</p>
            <p className="text-sm">{item.caption}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {item.hashtags.map((h) => (
                <span key={h} className="text-xs font-medium text-accent">{h}</span>
              ))}
            </div>
          </div>

          {/* People + schedule */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border p-3">
              <p className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">Creator</p>
              <div className="flex items-center gap-2"><Avatar name={creator.name} color={creator.avatarColor} size={22} /><span className="text-sm">{creator.name}</span></div>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">Reviewer</p>
              <div className="flex items-center gap-2"><Avatar name={reviewer.name} color={reviewer.avatarColor} size={22} /><span className="text-sm">{reviewer.name}</span></div>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
            <Calendar className="size-4 text-accent" />
            <span className="text-muted-foreground">Scheduled for</span>
            <span className="font-medium">{formatDate(item.publishAt, { weekday: "long" })} · {new Date(item.publishAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
          </div>

          {/* Comments */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium"><MessageSquare className="size-4" /> Comments ({item.comments.length})</p>
            <div className="space-y-3">
              {item.comments.length === 0 && <p className="text-sm text-muted-foreground">No comments yet. Start the conversation.</p>}
              {item.comments.map((c) => {
                const u = userById(c.author);
                return (
                  <div key={c.id} className="flex gap-2.5">
                    <Avatar name={u.name} color={u.avatarColor} size={28} />
                    <div className="flex-1 rounded-lg border border-border bg-card px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">{u.name}</span>
                        <span className="text-[11px] text-muted-foreground">{relativeTime(c.at)}</span>
                      </div>
                      <p className="mt-0.5 text-sm">{c.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3 border-t border-border p-4">
          <div className="flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && text.trim()) {
                  onComment(item.id, text.trim());
                  setText("");
                }
              }}
              placeholder="Add a comment or feedback…"
              className="h-10 flex-1 rounded-lg border border-input bg-background/40 px-3 text-sm outline-none focus:border-accent/50"
            />
            <Button size="icon" variant="secondary" onClick={() => { if (text.trim()) { onComment(item.id, text.trim()); setText(""); } }}>
              <Send className="size-4" />
            </Button>
          </div>
          {decided ? (
            <div className="flex items-center justify-center gap-2 rounded-lg bg-success/10 py-2.5 text-sm font-medium text-success">
              <CheckCircle2 className="size-4" /> Approved by {reviewer.name.split(" ")[0]}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="danger"
                onClick={() => onSetStatus(item.id, "rejected", text.trim() || "Please revise and resubmit.")}
              >
                <X className="size-4" /> Request Changes
              </Button>
              <Button
                variant="success"
                onClick={() => onSetStatus(item.id, "approved", text.trim() || undefined)}
              >
                <Check className="size-4" /> Approve
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
