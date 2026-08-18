import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/prisma";
import { env } from "@/server/env";
import {
  apiError, issueRefreshToken, refreshCookieOptions, signAccessToken, verifyPassword, REFRESH_COOKIE,
} from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return apiError(400, "VALIDATION", "Enter a valid email and password");
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

  // One message for "no such user" and "wrong password" — distinguishing
  // them tells an attacker which emails exist.
  if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) {
    return apiError(401, "INVALID_CREDENTIALS", "Wrong email or password");
  }

  const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });
  const { token: refreshToken } = await issueRefreshToken(user.id, {
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const res = NextResponse.json({
    accessToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      title: user.title,
      avatarColor: user.avatarColor,
    },
  });

  res.cookies.set(REFRESH_COOKIE, refreshToken, refreshCookieOptions(env.REFRESH_TOKEN_TTL_DAYS * 86_400));
  return res;
}
