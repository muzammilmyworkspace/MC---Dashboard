import { Router } from "express";
import { z } from "zod";
import { ContentStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { audit } from "../lib/audit.js";
import { hashPassword } from "../lib/tokens.js";
import { ymd } from "../lib/serialize.js";

/* ----------------------------- Notifications ---------------------------- */
export const notificationRouter = Router();
notificationRouter.use(requireAuth);

notificationRouter.get("/", async (req, res, next) => {
  try {
    const items = await prisma.notification.findMany({
      where: { userId: req.user!.sub },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({ notifications: items, unread: items.filter((n) => !n.read).length });
  } catch (err) {
    next(err);
  }
});

notificationRouter.patch("/read-all", async (req, res, next) => {
  try {
    await prisma.notification.updateMany({ where: { userId: req.user!.sub, read: false }, data: { read: true } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

notificationRouter.patch("/:id/read", async (req, res, next) => {
  try {
    await prisma.notification.updateMany({ where: { id: req.params.id, userId: req.user!.sub }, data: { read: true } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------- Dashboard ------------------------------ */
export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

dashboardRouter.get("/overview", async (_req, res, next) => {
  try {
    const [byStatus, total, integrations, recentReviews, upcoming] = await Promise.all([
      prisma.dayPlan.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.dayPlan.count(),
      prisma.integration.findMany({ select: { key: true, name: true, status: true, health: true, lastSyncAt: true } }),
      prisma.review.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          author: { select: { id: true, name: true, avatarColor: true } },
          dayPlan: { select: { date: true, reel: { select: { topic: true } } } },
        },
      }),
      prisma.dayPlan.findMany({
        where: { date: { gte: new Date() } },
        orderBy: { date: "asc" },
        take: 5,
        include: { reel: { select: { topic: true } } },
      }),
    ]);

    const counts = Object.fromEntries(byStatus.map((r) => [r.status.toLowerCase(), r._count._all]));
    const done = (counts.published ?? 0) + (counts.approved ?? 0) + (counts.scheduled ?? 0);

    res.json({
      content: {
        total,
        counts,
        awaiting: (counts.client_review ?? 0) + (counts.internal_review ?? 0),
        completion: total ? Math.round((done / total) * 100) : 0,
      },
      integrations: {
        total: integrations.length,
        connected: integrations.filter((i) => i.status === "CONNECTED").length,
        items: integrations,
      },
      recentReviews: recentReviews.map((r) => ({
        id: r.id,
        author: r.author.name,
        avatarColor: r.author.avatarColor,
        status: r.status.toLowerCase(),
        comment: r.comment,
        at: r.createdAt.toISOString(),
        date: ymd(r.dayPlan.date),
        topic: r.dayPlan.reel?.topic ?? "Content",
      })),
      upcoming: upcoming.map((p) => ({ date: ymd(p.date), topic: p.reel?.topic ?? "Content", status: p.status.toLowerCase() })),
    });
  } catch (err) {
    next(err);
  }
});

/* --------------------------------- Users -------------------------------- */
export const userRouter = Router();
userRouter.use(requireAuth);

userRouter.get("/", async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, name: true, role: true, title: true, avatarColor: true, isActive: true, lastLoginAt: true },
    });
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

const createUser = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
  role: z.enum(["TEAM", "CLIENT"]),
  title: z.string().optional(),
  avatarColor: z.string().optional(),
});

userRouter.post("/", requireRole("TEAM"), validate(createUser), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof createUser>;
    const user = await prisma.user.create({
      data: {
        email: body.email.toLowerCase(),
        name: body.name,
        passwordHash: await hashPassword(body.password),
        role: body.role,
        title: body.title,
        avatarColor: body.avatarColor ?? "#2456d6",
      },
      select: { id: true, email: true, name: true, role: true, title: true, avatarColor: true },
    });
    audit(req, "user.create", "User", user.id, { role: user.role });
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
});

const patchUser = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["TEAM", "CLIENT"]).optional(),
  title: z.string().optional(),
  isActive: z.boolean().optional(),
});

userRouter.patch("/:id", requireRole("TEAM"), validate(patchUser), async (req, res, next) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: req.body as z.infer<typeof patchUser>,
      select: { id: true, email: true, name: true, role: true, title: true, isActive: true },
    });
    audit(req, "user.update", "User", user.id);
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

/* --------------------------------- Audit -------------------------------- */
export const auditRouter = Router();
auditRouter.use(requireAuth, requireRole("TEAM"));

auditRouter.get("/", async (_req, res, next) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { id: true, name: true, avatarColor: true } } },
    });
    res.json({ logs });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------ Status enum ----------------------------- */
export const contentStatuses = Object.values(ContentStatus);
