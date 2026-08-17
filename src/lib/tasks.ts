/* ------------------------------------------------------------------ *
 *  MC Nexus — Tasks
 *  Created from the Add Task page and filed into a sidebar section.
 * ------------------------------------------------------------------ */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SectionKey } from "./nav";

export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "not_started" | "in_progress" | "blocked" | "done";

export const taskCategories = [
  "Content",
  "Advertising",
  "Design",
  "Video",
  "Community",
  "Website",
  "Analytics",
  "Admin",
] as const;
export type TaskCategory = (typeof taskCategories)[number];

export const priorityMeta: Record<TaskPriority, { label: string; color: string; bg: string }> = {
  low: { label: "Low", color: "#667085", bg: "rgba(102,112,133,.12)" },
  medium: { label: "Medium", color: "#2456d6", bg: "rgba(36,86,214,.12)" },
  high: { label: "High", color: "#d97706", bg: "rgba(217,119,6,.14)" },
  urgent: { label: "Urgent", color: "#e5484d", bg: "rgba(229,72,77,.14)" },
};

export const statusMeta: Record<TaskStatus, { label: string; color: string }> = {
  not_started: { label: "Not started", color: "#667085" },
  in_progress: { label: "In progress", color: "#2456d6" },
  blocked: { label: "Blocked", color: "#e5484d" },
  done: { label: "Done", color: "#16a34a" },
};

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  section: SectionKey; // which sidebar list it belongs to
  assignee: string; // user id
  priority: TaskPriority;
  dueDate: string; // YYYY-MM-DD
  estimatedHours: number | null;
  status: TaskStatus;
  checklist: ChecklistItem[];
  attachments: Attachment[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

interface TaskState {
  tasks: Task[];
  addTask: (t: Omit<Task, "id" | "createdAt" | "updatedAt">) => Task;
  updateTask: (id: string, patch: Partial<Task>) => void;
  removeTask: (id: string) => void;
  moveTask: (id: string, section: SectionKey) => void;
  bySection: (section: SectionKey) => Task[];
}

export const useTasks = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: [],

      addTask: (input) => {
        const now = new Date().toISOString();
        const task: Task = { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
        set((s) => ({ tasks: [task, ...s.tasks] }));
        return task;
      },

      updateTask: (id, patch) =>
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t)),
        })),

      removeTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

      moveTask: (id, section) =>
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, section, updatedAt: new Date().toISOString() } : t)),
        })),

      bySection: (section) => get().tasks.filter((t) => t.section === section),
    }),
    { name: "mc-nexus-tasks-v1" }
  )
);

export const sectionLabel: Record<SectionKey, string> = {
  muzammil: "Muzammil Tasks",
  hashaam: "Hashaam Tasks",
  future: "Future Assignments",
};
