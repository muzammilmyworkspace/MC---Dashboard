import type { Request } from "express";
import { prisma } from "./prisma.js";

/** Fire-and-forget audit trail. Never blocks or fails the request. */
export function audit(
  req: Request,
  action: string,
  entity: string,
  entityId?: string,
  meta?: Record<string, unknown>
) {
  const userId = req.user?.sub;
  prisma.auditLog
    .create({
      data: {
        userId: userId ?? null,
        action,
        entity,
        entityId: entityId ?? null,
        meta: (meta ?? undefined) as never,
        ip: req.ip,
        userAgent: req.get("user-agent") ?? undefined,
      },
    })
    .catch((err) => console.error("[audit] failed:", err?.message));
}
