import jwt, { type SignOptions } from "jsonwebtoken";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { env } from "../env.js";
import { prisma } from "./prisma.js";

export interface AccessPayload {
  sub: string;
  email: string;
  role: Role;
}

export function signAccessToken(payload: AccessPayload) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL } as SignOptions);
}

export function verifyAccessToken(token: string): AccessPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload;
}

/** Refresh tokens are opaque random strings; only a hash is stored. */
export function generateRefreshToken() {
  return crypto.randomBytes(48).toString("hex");
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function issueRefreshToken(userId: string, ctx?: { ip?: string; userAgent?: string }) {
  const token = generateRefreshToken();
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
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
  const hash = hashToken(presented);
  await prisma.refreshToken.updateMany({ where: { tokenHash: hash, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function revokeAllForUser(userId: string) {
  await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export const hashPassword = (plain: string) => bcrypt.hash(plain, 12);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);
