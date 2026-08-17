import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import { verifyAccessToken } from "../lib/tokens.js";
import { forbidden, unauthorized } from "../lib/errors.js";

/** Requires a valid access token (Authorization: Bearer <token>). */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.get("authorization");
  if (!header?.startsWith("Bearer ")) return next(unauthorized());
  try {
    req.user = verifyAccessToken(header.slice(7));
    next();
  } catch {
    next(unauthorized("Access token is invalid or expired"));
  }
}

/** Requires one of the given roles. TEAM always passes. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (req.user.role === "TEAM" || roles.includes(req.user.role)) return next();
    next(forbidden(`Requires role: ${roles.join(" or ")}`));
  };
}

/** Attaches the user when a token is present, but never rejects. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.get("authorization");
  if (header?.startsWith("Bearer ")) {
    try {
      req.user = verifyAccessToken(header.slice(7));
    } catch {
      /* ignore */
    }
  }
  next();
}
