import "server-only";
import jwt, { type SignOptions } from "jsonwebtoken";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { env } from "./env";
import { prisma } from "./prisma";

export interface AccessPayload {
  sub: string;
  email: string;
  role: Role;
}

export const REFRESH_COOKIE = "mc_nexus_rt";

/* --------------------------------- tokens -------------------------------- */

export function signAccessToken(payload: AccessPayload) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL } as SignOptions);
}

export function verifyAccessToken(token: string): AccessPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload;
}

/** Refresh tokens are opaque random strings; only a hash is ever stored. */
export const generateRefreshToken = () => crypto.randomBytes(48).toString("hex");
export const hashToken = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

export async function issueRefreshToken(userId: string, ctx?: { ip?: string; userAgent?: string }) {
  const token = generateRefreshToken();
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
  await prisma.refreshToken.create({
    data: { tokenHash: hashToken(token), userId, expiresAt, ip: ctx?.ip, userAgent: ctx?.userAgent },
  });
  return { token, expiresAt };
}

/** Rotates: revokes the presented token and issues a fresh one. */
export async function rotateRefreshToken(presented: string, ctx?: { ip?: string; userAgent?: string }) {
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(presented) },
    include: { user: true },
  });
  if (!record || record.revokedAt || record.expiresAt < new Date() || !record.user.isActive) return null;

  await prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
  const next = await issueRefreshToken(record.userId, ctx);
  return { user: record.user, ...next };
}

export async function revokeRefreshToken(presented: string) {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(presented), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export const hashPassword = (plain: string) => bcrypt.hash(plain, 12);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

/* ------------------------------- guards ---------------------------------- */

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export function apiError(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json<ApiErrorBody>({ error: { code, message, details } }, { status });
}

/**
 * Replaces the Express requireAuth middleware.
 *
 * Returns the caller, or a Response to return immediately. Route handlers
 * read as:
 *
 *   const auth = await requireAuth(req);
 *   if (auth instanceof NextResponse) return auth;
 *
 * which keeps the failure path impossible to forget — unlike middleware,
 * there is no ordering to get wrong.
 */
export async function requireAuth(req: Request): Promise<AccessPayload | NextResponse> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return apiError(401, "UNAUTHORIZED", "Not authenticated");
  }
  try {
    return verifyAccessToken(header.slice(7));
  } catch {
    return apiError(401, "UNAUTHORIZED", "Access token is invalid or expired");
  }
}

/** TEAM passes everything; CLIENT is restricted. */
export async function requireRole(req: Request, ...roles: Role[]): Promise<AccessPayload | NextResponse> {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (auth.role === "TEAM" || roles.includes(auth.role)) return auth;
  return apiError(403, "FORBIDDEN", `Requires role: ${roles.join(" or ")}`);
}

/** Cookie options shared by login, refresh and logout so they can't drift. */
export function refreshCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    // Same-origin on Vercel, so Secure is safe and correct in production.
    secure: env.NODE_ENV === "production",
    path: "/api/auth",
    maxAge: maxAgeSeconds,
  };
}
