"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Plus,
  LayoutGrid,
  List,
  Search,
  Clock,
  MessageSquare,
  Paperclip,
  CheckSquare,
  Flag,
  GripVertical,
} from "lucide-react";
import {
  tasks as seedTasks,
  statusMeta,
  priorityMeta,
  userById,
  type Task,
  type TaskStatus,
} from "@/lib/data";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { TaskDetail } from "@/components/tasks/task-detail";
import { cn, formatDate } from "@/lib/utils";

const columns: TaskStatus[] = ["pending", "working", "review", "client_review", "completed", "blocked"];

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>(seedTasks);
  const [view, setView] = useState<"board" | "list">("board");
  const [query, setQuery] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<TaskStatus | null>(null);
  const [active, setActive] = useState<Task | null>(null);

  const filtered = useMemo(
    () =>
      tasks.filter((t) =>
        query ? t.title.toLowerCase().includes(query.toLowerCase()) || t.labels.some((l) => l.toLowerCase().includes(query.toLowerCase())) : true
      ),
    [tasks, query]
  );

  function moveTask(id: string, status: TaskStatus) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, status, progress: status === "completed" ? 100 : t.progress }
          : t
      )
    );
    const t = tasks.find((x) => x.id === id);
    if (t && t.status !== status) toast.success("Task moved", { description: `${t.title.slice(0, 34)}… → ${statusMeta[status].label}` });
  }

  function updateTask(updated: Task) {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setActive(updated);
  }

  const stats = {
    total: tasks.length,
    completed: tasks.filter((t) => t.status === "completed" || t.status === "approved").length,
    blocked: tasks.filter((t) => t.status === "blocked").length,
    dueSoon: tasks.filter((t) => new Date(t.deadline) <= new Date("2026-07-24")).length,
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Tasks</h2>
          <p className="text-sm text-muted-foreground">
            {stats.total} tasks · {stats.completed} done · {stats.blocked} blocked · {stats.dueSoon} due soon
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tasks…" className="h-9 w-full pl-9 sm:w-56" />
          </div>
          <div className="flex rounded-lg border border-border p-0.5">
            <button
              onClick={() => setView("board")}
              className={cn("flex size-8 items-center justify-center rounded-md transition-colors", view === "board" ? "bg-accent text-white" : "text-muted-foreground hover:text-foreground")}
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              onClick={() => setView("list")}
              className={cn("flex size-8 items-center justify-center rounded-md transition-colors", view === "list" ? "bg-accent text-white" : "text-muted-foreground hover:text-foreground")}
            >
              <List className="size-4" />
            </button>
          </div>
          <Button size="sm" onClick={() => toast("New task", { description: "Task composer would open here." })}>
            <Plus className="size-4" /> New Task
          </Button>
        </div>
      </div>

      {view === "board" ? (
        <div className="no-scrollbar flex gap-4 overflow-x-auto pb-4">
          {columns.map((col) => {
            const colTasks = filtered.filter((t) => (col === "completed" ? t.status === "completed" || t.status === "approved" : t.status === col));
            const meta = statusMeta[col];
            return (
              <div
                key={col}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverCol(col);
                }}
                onDragLeave={() => setOverCol((c) => (c === col ? null : c))}
                onDrop={() => {
                  if (dragId) moveTask(dragId, col);
                  setDragId(null);
                  setOverCol(null);
                }}
                className={cn(
                  "flex w-[300px] shrink-0 flex-col rounded-xl border border-border bg-background-subtle/40 transition-colors",
                  overCol === col && "border-accent/50 bg-accent/[0.05]"
                )}
              >
                <div className="flex items-center justify-between border-b border-border px-3.5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: meta.dot }} />
                    <span className="text-sm font-semibold">{meta.label}</span>
                    <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground">{colTasks.length}</span>
                  </div>
                  <button className="text-muted-foreground hover:text-foreground" onClick={() => toast("Add to " + meta.label)}>
                    <Plus className="size-4" />
                  </button>
                </div>
                <div className="flex min-h-[120px] flex-col gap-2.5 p-2.5">
                  {colTasks.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      onClick={() => setActive(t)}
                      onDragStart={() => setDragId(t.id)}
                      onDragEnd={() => setDragId(null)}
                      dragging={dragId === t.id}
                    />
                  ))}
                  {colTasks.length === 0 && (
                    <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border py-8 text-xs text-muted-foreground">
                      Drop tasks here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <ListView tasks={filtered} onOpen={setActive} />
      )}

      <TaskDetail task={active} open={!!active} onClose={() => setActive(null)} onUpdate={updateTask} onMove={moveTask} />
    </div>
  );
}

function TaskCard({
  task,
  onClick,
  onDragStart,
  onDragEnd,
  dragging,
}: {
  task: Task;
  onClick: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  dragging: boolean;
}) {
  const assignee = userById(task.assignee);
  const p = priorityMeta[task.priority];
  const done = task.checklist.filter((c) => c.done).length;
  return (
    <motion.div
      layout
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        "group cursor-pointer rounded-lg border border-border bg-card p-3 shadow-sm transition-all hover:border-accent/40 hover:shadow-card",
        dragging && "opacity-40"
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: p.bg, color: p.color }}>
          <Flag className="size-2.5" /> {p.label}
        </span>
        <GripVertical className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <p className="text-sm font-medium leading-snug">{task.title}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {task.labels.map((l) => (
          <span key={l} className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{l}</span>
        ))}
      </div>
      {task.progress > 0 && task.progress < 100 && (
        <div className="mt-2.5">
          <Progress value={task.progress} className="h-1.5" />
        </div>
      )}
      <div className="mt-3 flex items-center justify-between">
        <Avatar name={assignee.name} color={assignee.avatarColor} size={24} />
        <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground">
          {task.checklist.length > 0 && (
            <span className="flex items-center gap-1"><CheckSquare className="size-3" /> {done}/{task.checklist.length}</span>
          )}
          {task.comments > 0 && <span className="flex items-center gap-1"><MessageSquare className="size-3" /> {task.comments}</span>}
          {task.attachments > 0 && <span className="flex items-center gap-1"><Paperclip className="size-3" /> {task.attachments}</span>}
          <span className="flex items-center gap-1"><Clock className="size-3" /> {formatDate(task.deadline)}</span>
        </div>
      </div>
    </motion.div>
  );
}

function ListView({ tasks, onOpen }: { tasks: Task[]; onOpen: (t: Task) => void }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3 font-medium">Task</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="hidden px-4 py-3 font-medium sm:table-cell">Priority</th>
            <th className="hidden px-4 py-3 font-medium md:table-cell">Assignee</th>
            <th className="hidden px-4 py-3 font-medium lg:table-cell">Progress</th>
            <th className="px-4 py-3 font-medium">Due</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => {
            const a = userById(t.assignee);
            const s = statusMeta[t.status];
            const p = priorityMeta[t.priority];
            return (
              <tr key={t.id} onClick={() => onOpen(t)} className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40">
                <td className="max-w-[320px] px-4 py-3">
                  <p className="truncate font-medium">{t.title}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <span className="size-2 rounded-full" style={{ background: s.dot }} />
                    <span className={s.color}>{s.label}</span>
                  </span>
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: p.bg, color: p.color }}>{p.label}</span>
                </td>
                <td className="hidden px-4 py-3 md:table-cell"><Avatar name={a.name} color={a.avatarColor} size={26} /></td>
                <td className="hidden px-4 py-3 lg:table-cell">
                  <div className="flex items-center gap-2">
                    <Progress value={t.progress} className="h-1.5 w-24" />
                    <span className="text-xs text-muted-foreground">{t.progress}%</span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(t.deadline)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
