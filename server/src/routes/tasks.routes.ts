import { Router } from "express";
import { z } from "zod";
import { TaskPriority, TaskStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { notFound } from "../lib/errors.js";
import { audit } from "../lib/audit.js";
import { emitWorkspace } from "../realtime/io.js";

export const taskRouter = Router();
taskRouter.use(requireAuth);

const sections = ["muzammil", "hashaam", "future"] as const;

const taskInclude = {
  assignee: { select: { id: true, name: true, avatarColor: true } },
  checklist: { orderBy: { order: "asc" as const } },
  attachments: true,
};

const serialize = (t: {
  id: string; title: string; description: string; category: string; section: string;
  assigneeId: string | null; priority: TaskPriority; status: TaskStatus;
  dueDate: Date | null; estimatedHours: number | null; notes: string;
  createdAt: Date; updatedAt: Date;
  assignee?: { id: string; name: string; avatarColor: string } | null;
  checklist?: { id: string; text: string; done: boolean }[];
  attachments?: { id: string; name: string; url: string | null; size: number | null }[];
}) => ({
  id: t.id,
  title: t.title,
  description: t.description,
  category: t.category,
  section: t.section,
  assignee: t.assignee ?? null,
  assigneeId: t.assigneeId,
  priority: t.priority.toLowerCase(),
  status: t.status.toLowerCase(),
  dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
  estimatedHours: t.estimatedHours,
  notes: t.notes,
  checklist: t.checklist ?? [],
  attachments: t.attachments ?? [],
  createdAt: t.createdAt.toISOString(),
  updatedAt: t.updatedAt.toISOString(),
});

/** GET /api/tasks?section=future&status=in_progress */
taskRouter.get(
  "/",
  validate(z.object({ section: z.enum(sections).optional(), status: z.nativeEnum(TaskStatus).optional() }), "query"),
  async (req, res, next) => {
    try {
      const { section, status } = req.query as { section?: string; status?: TaskStatus };
      const tasks = await prisma.task.findMany({
        where: { section, status },
        include: taskInclude,
        orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      });
      res.json({ tasks: tasks.map(serialize) });
    } catch (err) {
      next(err);
    }
  }
);

taskRouter.get("/:id", async (req, res, next) => {
  try {
    const task = await prisma.task.findUnique({ where: { id: req.params.id }, include: taskInclude });
    if (!task) return next(notFound("Task not found"));
    res.json({ task: serialize(task) });
  } catch (err) {
    next(err);
  }
});

const taskBody = z.object({
  title: z.string().min(1, "Give the task a title"),
  description: z.string().default(""),
  category: z.string().min(1),
  section: z.enum(sections),
  assigneeId: z.string().nullable().optional(),
  priority: z.nativeEnum(TaskPriority).default("MEDIUM"),
  status: z.nativeEnum(TaskStatus).default("NOT_STARTED"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  estimatedHours: z.number().min(0).max(500).nullable().optional(),
  notes: z.string().default(""),
  checklist: z.array(z.object({ text: z.string().min(1), done: z.boolean().default(false) })).default([]),
  attachments: z.array(z.object({ name: z.string(), url: z.string().optional(), size: z.number().optional(), mimeType: z.string().optional() })).default([]),
});

taskRouter.post("/", requireRole("TEAM"), validate(taskBody), async (req, res, next) => {
  try {
    const b = req.body as z.infer<typeof taskBody>;
    const task = await prisma.task.create({
      data: {
        title: b.title, description: b.description, category: b.category, section: b.section,
        assigneeId: b.assigneeId ?? null, createdById: req.user!.sub,
        priority: b.priority, status: b.status,
        dueDate: b.dueDate ? new Date(`${b.dueDate}T00:00:00.000Z`) : null,
        estimatedHours: b.estimatedHours ?? null, notes: b.notes,
        checklist: { create: b.checklist.map((c, i) => ({ text: c.text, done: c.done, order: i })) },
        attachments: { create: b.attachments },
      },
      include: taskInclude,
    });

    audit(req, "task.create", "Task", task.id, { section: task.section });
    emitWorkspace("dayplan:updated", { kind: "task", task: serialize(task) });
    res.status(201).json({ task: serialize(task) });
  } catch (err) {
    next(err);
  }
});

taskRouter.patch("/:id", requireRole("TEAM"), validate(taskBody.partial()), async (req, res, next) => {
  try {
    const b = req.body as Partial<z.infer<typeof taskBody>>;
    const existing = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!existing) return next(notFound("Task not found"));

    const task = await prisma.task.update({
      where: { id: existing.id },
      data: {
        title: b.title, description: b.description, category: b.category, section: b.section,
        assigneeId: b.assigneeId, priority: b.priority, status: b.status,
        dueDate: b.dueDate === undefined ? undefined : b.dueDate ? new Date(`${b.dueDate}T00:00:00.000Z`) : null,
        estimatedHours: b.estimatedHours, notes: b.notes,
        ...(b.checklist
          ? { checklist: { deleteMany: {}, create: b.checklist.map((c, i) => ({ text: c.text, done: c.done ?? false, order: i })) } }
          : {}),
      },
      include: taskInclude,
    });

    audit(req, "task.update", "Task", task.id);
    res.json({ task: serialize(task) });
  } catch (err) {
    next(err);
  }
});

taskRouter.delete("/:id", requireRole("TEAM"), async (req, res, next) => {
  try {
    await prisma.task.delete({ where: { id: req.params.id } });
    audit(req, "task.delete", "Task", req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
