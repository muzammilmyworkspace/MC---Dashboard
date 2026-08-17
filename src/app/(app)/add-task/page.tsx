"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Paperclip, X, ListChecks, Check, ClipboardList } from "lucide-react";
import { PageBody, PageHeader, SectionCard } from "@/components/ui/page-shell";
import { Field, TextInput, TextArea, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { users } from "@/lib/data";
import {
  useTasks, taskCategories, priorityMeta, statusMeta, sectionLabel,
  type Attachment, type ChecklistItem, type TaskCategory, type TaskPriority, type TaskStatus,
} from "@/lib/tasks";
import type { SectionKey } from "@/lib/nav";
import { cn } from "@/lib/utils";

const sections: SectionKey[] = ["muzammil", "hashaam", "future"];

interface Errors {
  title?: string;
  assignee?: string;
  dueDate?: string;
  estimatedHours?: string;
}

function AddTaskForm() {
  const router = useRouter();
  const params = useSearchParams();
  const editingId = params.get("id");

  const { tasks, addTask, updateTask, removeTask } = useTasks();
  const existing = useMemo(() => tasks.find((t) => t.id === editingId), [tasks, editingId]);

  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [category, setCategory] = useState<TaskCategory>(existing?.category ?? "Content");
  const [section, setSection] = useState<SectionKey>(existing?.section ?? "future");
  const [assignee, setAssignee] = useState(existing?.assignee ?? users[0].id);
  const [priority, setPriority] = useState<TaskPriority>(existing?.priority ?? "medium");
  const [dueDate, setDueDate] = useState(existing?.dueDate ?? "");
  const [estimatedHours, setEstimatedHours] = useState(existing?.estimatedHours?.toString() ?? "");
  const [status, setStatus] = useState<TaskStatus>(existing?.status ?? "not_started");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [checklist, setChecklist] = useState<ChecklistItem[]>(existing?.checklist ?? []);
  const [attachments, setAttachments] = useState<Attachment[]>(existing?.attachments ?? []);
  const [checklistDraft, setChecklistDraft] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  function validate(): boolean {
    const e: Errors = {};
    if (!title.trim()) e.title = "Give the task a clear title.";
    if (!assignee) e.assignee = "Choose who owns this task.";
    if (dueDate) {
      const d = new Date(dueDate);
      if (Number.isNaN(d.getTime())) e.dueDate = "That date isn't valid.";
    }
    if (estimatedHours) {
      const n = Number(estimatedHours);
      if (Number.isNaN(n) || n < 0 || n > 500) e.estimatedHours = "Enter a number between 0 and 500.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function save() {
    if (!validate()) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    const payload = {
      title: title.trim(),
      description: description.trim(),
      category,
      section,
      assignee,
      priority,
      dueDate,
      estimatedHours: estimatedHours ? Number(estimatedHours) : null,
      status,
      checklist,
      attachments,
      notes: notes.trim(),
    };

    if (existing) {
      updateTask(existing.id, payload);
      toast.success("Task updated", { description: `Saved to ${sectionLabel[section]}.` });
    } else {
      addTask(payload);
      toast.success("Task created", { description: `Added to ${sectionLabel[section]}.` });
    }
    router.push("/dashboard");
  }

  function addChecklistItem() {
    const text = checklistDraft.trim();
    if (!text) return;
    setChecklist((c) => [...c, { id: crypto.randomUUID(), text, done: false }]);
    setChecklistDraft("");
  }

  function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setAttachments((a) => [
      ...a,
      ...Array.from(files).map((f) => ({ id: crypto.randomUUID(), name: f.name, size: f.size, type: f.type })),
    ]);
  }

  return (
    <PageBody>
      <PageHeader
        icon={ClipboardList}
        eyebrow={existing ? "Edit task" : "New task"}
        title={existing ? "Edit task" : "Add a task"}
        description="Create a piece of work and file it under the right person. It appears in the sidebar straight away."
        actions={
          <>
            {existing && (
              <Button
                variant="outline"
                onClick={() => {
                  removeTask(existing.id);
                  toast("Task deleted");
                  router.push("/dashboard");
                }}
              >
                <Trash2 className="size-4" /> Delete
              </Button>
            )}
            <Button variant="secondary" onClick={() => router.back()}>Cancel</Button>
            <Button onClick={save}><Check className="size-4" /> Save task</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Main */}
        <div className="space-y-5 lg:col-span-2">
          <SectionCard title="Task details" description="What needs to happen, in plain language.">
            <div className="space-y-4">
              <Field label="Task title" required error={errors.title} htmlFor="title">
                <TextInput
                  id="title"
                  value={title}
                  invalid={!!errors.title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Film 3 reels for the workshop launch"
                />
              </Field>

              <Field label="Description" hint="Add any context the assignee needs." htmlFor="desc">
                <TextArea
                  id="desc"
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the work, the goal, and anything to watch out for…"
                />
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Category" htmlFor="cat">
                  <Select id="cat" value={category} onChange={(e) => setCategory(e.target.value as TaskCategory)}>
                    {taskCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </Field>
                <Field label="Add to section" hint="Where it appears in the sidebar." htmlFor="section">
                  <Select id="section" value={section} onChange={(e) => setSection(e.target.value as SectionKey)}>
                    {sections.map((s) => <option key={s} value={s}>{sectionLabel[s]}</option>)}
                  </Select>
                </Field>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Checklist" description="Break the task into steps." icon={ListChecks}>
            <div className="space-y-2">
              {checklist.map((item) => (
                <div key={item.id} className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/20 px-3 py-2">
                  <button
                    onClick={() => setChecklist((c) => c.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)))}
                    className={cn("flex size-4 items-center justify-center rounded border transition-colors", item.done ? "border-success bg-success text-white" : "border-border")}
                  >
                    {item.done && <Check className="size-3" />}
                  </button>
                  <span className={cn("flex-1 text-sm", item.done && "text-muted-foreground line-through")}>{item.text}</span>
                  <button onClick={() => setChecklist((c) => c.filter((i) => i.id !== item.id))} className="text-muted-foreground hover:text-danger">
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <TextInput
                  value={checklistDraft}
                  onChange={(e) => setChecklistDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addChecklistItem(); } }}
                  placeholder="Add a step and press Enter"
                />
                <Button variant="secondary" onClick={addChecklistItem}><Plus className="size-4" /></Button>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Notes" description="Anything else worth recording.">
            <TextArea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes…" />
          </SectionCard>
        </div>

        {/* Side */}
        <div className="space-y-5">
          <SectionCard title="Assignment">
            <div className="space-y-4">
              <Field label="Assign to" required error={errors.assignee} htmlFor="assignee">
                <Select id="assignee" value={assignee} invalid={!!errors.assignee} onChange={(e) => setAssignee(e.target.value)}>
                  {users.filter((u) => u.role === "team").map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </Select>
              </Field>
              <div className="flex items-center gap-2 rounded-lg bg-muted/40 p-2.5">
                {(() => {
                  const u = users.find((x) => x.id === assignee) ?? users[0];
                  return (
                    <>
                      <Avatar name={u.name} color={u.avatarColor} size={30} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{u.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{u.title}</p>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Planning">
            <div className="space-y-4">
              <Field label="Priority">
                <div className="grid grid-cols-2 gap-1.5">
                  {(Object.keys(priorityMeta) as TaskPriority[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPriority(p)}
                      className={cn("rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors", priority === p ? "border-transparent" : "border-border text-muted-foreground hover:border-accent/40")}
                      style={priority === p ? { background: priorityMeta[p].bg, color: priorityMeta[p].color } : undefined}
                    >
                      {priorityMeta[p].label}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Due date" error={errors.dueDate} htmlFor="due">
                <TextInput id="due" type="date" value={dueDate} invalid={!!errors.dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </Field>

              <Field label="Estimated hours" error={errors.estimatedHours} htmlFor="hours">
                <TextInput id="hours" type="number" min={0} step="0.5" value={estimatedHours} invalid={!!errors.estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} placeholder="e.g. 4" />
              </Field>

              <Field label="Status" htmlFor="status">
                <Select id="status" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
                  {(Object.keys(statusMeta) as TaskStatus[]).map((s) => <option key={s} value={s}>{statusMeta[s].label}</option>)}
                </Select>
              </Field>
            </div>
          </SectionCard>

          <SectionCard title="Attachments" icon={Paperclip}>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center transition-colors hover:border-accent/40">
              <Paperclip className="size-5 text-muted-foreground" />
              <span className="mt-2 text-sm font-medium">Add files</span>
              <span className="text-xs text-muted-foreground">Briefs, references, raw footage</span>
              <input type="file" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
            </label>
            {attachments.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {attachments.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs">
                    <Paperclip className="size-3 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{a.name}</span>
                    <span className="text-muted-foreground">{(a.size / 1024).toFixed(0)} KB</span>
                    <button onClick={() => setAttachments((x) => x.filter((f) => f.id !== a.id))} className="text-muted-foreground hover:text-danger">
                      <X className="size-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </PageBody>
  );
}

export default function AddTaskPage() {
  return (
    <Suspense fallback={<div className="skeleton h-96 rounded-2xl" />}>
      <AddTaskForm />
    </Suspense>
  );
}
