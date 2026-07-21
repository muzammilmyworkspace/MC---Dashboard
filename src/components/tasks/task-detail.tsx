"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Flag,
  Calendar,
  User as UserIcon,
  Plus,
  Send,
  CheckSquare,
  Square,
  Activity as ActivityIcon,
  Timer,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  statusMeta,
  priorityMeta,
  userById,
  currentUser,
  type Task,
  type TaskStatus,
  type Priority,
} from "@/lib/data";
import { cn, formatDate } from "@/lib/utils";

const statusOrder: TaskStatus[] = ["pending", "working", "review", "client_review", "approved", "completed", "blocked"];
const priorityOrder: Priority[] = ["low", "medium", "high", "critical"];

export function TaskDetail({
  task,
  open,
  onClose,
  onUpdate,
  onMove,
}: {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (t: Task) => void;
  onMove: (id: string, status: TaskStatus) => void;
}) {
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<{ author: string; text: string; at: string }[]>([]);

  if (!task) return null;
  const assignee = userById(task.assignee);
  const creator = userById(task.createdBy);
  const s = statusMeta[task.status];
  const p = priorityMeta[task.priority];
  const checkDone = task.checklist.filter((c) => c.done).length;

  function toggleCheck(id: string) {
    if (!task) return;
    const checklist = task.checklist.map((c) => (c.id === id ? { ...c, done: !c.done } : c));
    const doneCount = checklist.filter((c) => c.done).length;
    const progress = checklist.length ? Math.round((doneCount / checklist.length) * 100) : task.progress;
    onUpdate({ ...task, checklist, progress });
  }

  function addComment() {
    if (!comment.trim()) return;
    setComments((prev) => [...prev, { author: currentUser.id, text: comment.trim(), at: new Date().toISOString() }]);
    setComment("");
    toast.success("Comment added");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent side="right" className="flex flex-col p-0">
        {/* Header */}
        <div className="border-b border-border p-5 pr-14">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs">
              <span className="size-2 rounded-full" style={{ background: s.dot }} />
              {s.label}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: p.bg, color: p.color }}>
              <Flag className="size-3" /> {p.label}
            </span>
            {task.labels.map((l) => (
              <span key={l} className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">{l}</span>
            ))}
          </div>
          <DialogTitle>{task.title}</DialogTitle>
          <p className="mt-2 text-sm text-muted-foreground">{task.description}</p>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-4">
            <Meta icon={<UserIcon className="size-3.5" />} label="Assignee">
              <div className="flex items-center gap-2">
                <Avatar name={assignee.name} color={assignee.avatarColor} size={22} />
                <span className="text-sm">{assignee.name}</span>
              </div>
            </Meta>
            <Meta icon={<UserIcon className="size-3.5" />} label="Created by">
              <div className="flex items-center gap-2">
                <Avatar name={creator.name} color={creator.avatarColor} size={22} />
                <span className="text-sm">{creator.name}</span>
              </div>
            </Meta>
            <Meta icon={<Calendar className="size-3.5" />} label="Deadline">
              <span className="text-sm">{formatDate(task.deadline, { weekday: "short" })}</span>
            </Meta>
            <Meta icon={<Timer className="size-3.5" />} label="Time tracked">
              <span className="text-sm">{task.actualHours}h / {task.estimatedHours}h est.</span>
            </Meta>
          </div>

          {/* Progress */}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-medium">Progress</span>
              <span className="text-muted-foreground">{task.progress}%</span>
            </div>
            <Progress value={task.progress} />
          </div>

          {/* Status changer */}
          <div>
            <p className="mb-2 text-sm font-medium">Move to</p>
            <div className="flex flex-wrap gap-1.5">
              {statusOrder.map((st) => (
                <button
                  key={st}
                  onClick={() => onMove(task.id, st)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition-colors",
                    task.status === st ? "border-accent bg-accent/15 text-accent" : "border-border text-muted-foreground hover:border-accent/40"
                  )}
                >
                  {statusMeta[st].label}
                </button>
              ))}
            </div>
          </div>

          {/* Priority changer */}
          <div>
            <p className="mb-2 text-sm font-medium">Priority</p>
            <div className="flex gap-1.5">
              {priorityOrder.map((pr) => (
                <button
                  key={pr}
                  onClick={() => onUpdate({ ...task, priority: pr })}
                  className={cn("flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors", task.priority === pr ? "border-transparent" : "border-border text-muted-foreground hover:border-accent/40")}
                  style={task.priority === pr ? { background: priorityMeta[pr].bg, color: priorityMeta[pr].color } : undefined}
                >
                  {priorityMeta[pr].label}
                </button>
              ))}
            </div>
          </div>

          {/* Checklist */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">Checklist</p>
              <span className="text-xs text-muted-foreground">{checkDone}/{task.checklist.length}</span>
            </div>
            <div className="space-y-1">
              {task.checklist.map((c) => (
                <button
                  key={c.id}
                  onClick={() => toggleCheck(c.id)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                >
                  {c.done ? <CheckSquare className="size-4 text-accent" /> : <Square className="size-4 text-muted-foreground" />}
                  <span className={cn(c.done && "text-muted-foreground line-through")}>{c.label}</span>
                </button>
              ))}
              <button className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground" onClick={() => toast("Add checklist item")}>
                <Plus className="size-4" /> Add item
              </button>
            </div>
          </div>

          {/* Comments */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
              <ActivityIcon className="size-4" /> Comments & Activity
            </p>
            <div className="space-y-3">
              <div className="flex gap-2.5 text-sm">
                <Avatar name={creator.name} color={creator.avatarColor} size={26} />
                <div className="flex-1 rounded-lg bg-muted/50 px-3 py-2">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{creator.name}</span> created this task · {formatDate(task.deadline)}
                  </p>
                </div>
              </div>
              {comments.map((c, i) => {
                const u = userById(c.author);
                return (
                  <div key={i} className="flex gap-2.5 text-sm">
                    <Avatar name={u.name} color={u.avatarColor} size={26} />
                    <div className="flex-1 rounded-lg border border-border bg-card px-3 py-2">
                      <p className="text-xs font-medium">{u.name}</p>
                      <p className="mt-0.5">{c.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Comment composer */}
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-2">
            <Avatar name={currentUser.name} color={currentUser.avatarColor} size={30} />
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addComment()}
              placeholder="Write a comment…"
              className="h-10 flex-1 rounded-lg border border-input bg-background/40 px-3 text-sm outline-none focus:border-accent/50"
            />
            <Button size="icon" onClick={addComment}><Send className="size-4" /></Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Meta({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">{icon} {label}</p>
      {children}
    </div>
  );
}
