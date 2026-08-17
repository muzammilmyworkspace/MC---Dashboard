import { Router } from "express";
import { z } from "zod";
import { ContentStatus, Platform, ReviewStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { notFound, badRequest } from "../lib/errors.js";
import { audit } from "../lib/audit.js";
import { dayPlanInclude, serializeDayPlan, type FullDayPlan } from "../lib/serialize.js";
import { emitWorkspace } from "../realtime/io.js";
import { mail } from "../services/mail.js";

export const dayPlanRouter = Router();
dayPlanRouter.use(requireAuth);

const upper = (v: string) => v.toUpperCase();
const dateParam = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD") });

/** GET /api/day-plans?month=2026-07 — all plans for a month (defaults to current). */
dayPlanRouter.get(
  "/",
  validate(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() }), "query"),
  async (req, res, next) => {
    try {
      const month = (req.query as { month?: string }).month ?? new Date().toISOString().slice(0, 7);
      const [y, m] = month.split("-").map(Number);
      const start = new Date(Date.UTC(y, m - 1, 1));
      const end = new Date(Date.UTC(y, m, 1));

      const plans = await prisma.dayPlan.findMany({
        where: { date: { gte: start, lt: end } },
        include: dayPlanInclude,
        orderBy: { date: "asc" },
      });
      res.json({ month, plans: plans.map((p) => serializeDayPlan(p as FullDayPlan)) });
    } catch (err) {
      next(err);
    }
  }
);

/** GET /api/day-plans/:date */
dayPlanRouter.get("/:date", validate(dateParam, "params"), async (req, res, next) => {
  try {
    const plan = await prisma.dayPlan.findUnique({
      where: { date: new Date(`${req.params.date}T00:00:00.000Z`) },
      include: dayPlanInclude,
    });
    if (!plan) return next(notFound("No content planned for that date"));
    res.json({ plan: serializeDayPlan(plan as FullDayPlan) });
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/day-plans/:date — editors only (clients review, they don't edit). */
const patchBody = z.object({
  hook: z.string().min(1).optional(),
  cta: z.string().min(1).optional(),
  hashtags: z.array(z.string()).optional(),
  postingTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  status: z.nativeEnum(ContentStatus).optional(),
  captionNl: z.string().optional(),
  captions: z.record(z.nativeEnum(Platform), z.string()).optional(),
});

dayPlanRouter.patch(
  "/:date",
  requireRole("TEAM"),
  validate(dateParam, "params"),
  validate(patchBody),
  async (req, res, next) => {
    try {
      const date = new Date(`${req.params.date}T00:00:00.000Z`);
      const body = req.body as z.infer<typeof patchBody>;

      const existing = await prisma.dayPlan.findUnique({ where: { date }, include: { reel: true } });
      if (!existing) return next(notFound("No content planned for that date"));

      await prisma.$transaction(async (tx) => {
        await tx.dayPlan.update({
          where: { id: existing.id },
          data: {
            cta: body.cta,
            hashtags: body.hashtags,
            postingTime: body.postingTime,
            status: body.status,
            captionNl: body.captionNl,
          },
        });

        if (body.hook && existing.reel) {
          await tx.reel.update({ where: { id: existing.reel.id }, data: { hook: body.hook } });
        }

        for (const [platform, text] of Object.entries(body.captions ?? {})) {
          await tx.caption.upsert({
            where: { dayPlanId_platform: { dayPlanId: existing.id, platform: platform as Platform } },
            create: { dayPlanId: existing.id, platform: platform as Platform, text },
            update: { text },
          });
        }
      });

      const plan = await prisma.dayPlan.findUnique({ where: { id: existing.id }, include: dayPlanInclude });
      const payload = serializeDayPlan(plan as FullDayPlan);

      audit(req, "dayplan.update", "DayPlan", existing.id, { fields: Object.keys(body) });
      emitWorkspace("dayplan:updated", payload);
      res.json({ plan: payload });
    } catch (err) {
      next(err);
    }
  }
);

/** POST /api/day-plans/:date/reviews — approve / reject / request changes. */
const reviewBody = z.object({
  status: z.nativeEnum(ReviewStatus),
  comment: z.string().default(""),
});

dayPlanRouter.post(
  "/:date/reviews",
  validate(dateParam, "params"),
  validate(reviewBody),
  async (req, res, next) => {
    try {
      const { status, comment } = req.body as z.infer<typeof reviewBody>;
      if ((status === "REJECTED" || status === "CHANGES") && !comment.trim()) {
        return next(badRequest("A comment is required when rejecting or requesting changes"));
      }

      const date = new Date(`${req.params.date}T00:00:00.000Z`);
      const plan = await prisma.dayPlan.findUnique({ where: { date }, include: { reel: true } });
      if (!plan) return next(notFound("No content planned for that date"));

      const nextStatus: ContentStatus =
        status === "APPROVED" ? ContentStatus.APPROVED
        : status === "REJECTED" ? ContentStatus.DRAFT
        : status === "CHANGES" ? ContentStatus.INTERNAL_REVIEW
        : plan.status;

      await prisma.$transaction([
        prisma.review.create({
          data: { dayPlanId: plan.id, authorId: req.user!.sub, status, comment: comment.trim() },
        }),
        prisma.dayPlan.update({ where: { id: plan.id }, data: { status: nextStatus } }),
      ]);

      // Notify the rest of the team.
      const topic = plan.reel?.topic ?? "Content";
      const others = await prisma.user.findMany({ where: { id: { not: req.user!.sub }, isActive: true } });
      await prisma.notification.createMany({
        data: others.map((u) => ({
          userId: u.id,
          title: status === "APPROVED" ? "Content approved" : status === "REJECTED" ? "Content rejected" : "Changes requested",
          body: `${topic} (${req.params.date})${comment ? ` — ${comment}` : ""}`,
          tone: status === "APPROVED" ? "SUCCESS" : status === "REJECTED" ? "DANGER" : "WARNING",
          link: `/calendar?date=${req.params.date}`,
        })),
      });

      const fresh = await prisma.dayPlan.findUnique({ where: { id: plan.id }, include: dayPlanInclude });
      const payload = serializeDayPlan(fresh as FullDayPlan);

      audit(req, "dayplan.review", "DayPlan", plan.id, { status });
      emitWorkspace("review:created", { date: req.params.date, status: status.toLowerCase(), plan: payload });
      emitWorkspace("dayplan:updated", payload);

      // Best-effort email — never blocks the response.
      void Promise.all(
        others.map((u) =>
          mail.reviewResult(u.email, { date: req.params.date, topic, approved: status === "APPROVED", comment })
        )
      ).catch(() => undefined);

      res.status(201).json({ plan: payload });
    } catch (err) {
      next(err);
    }
  }
);
