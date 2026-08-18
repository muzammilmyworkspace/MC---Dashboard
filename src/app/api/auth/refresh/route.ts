import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/server/env";
import {
  apiError, refreshCookieOptions, rotateRefreshToken, signAccessToken, REFRESH_COOKIE,
} from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Rotates the refresh cookie and returns a fresh access token. */
export async function POST(req: Request) {
  const jar = await cookies();
  const presented = jar.get(REFRESH_COOKIE)?.value;
  if (!presented) return apiError(401, "UNAUTHORIZED", "No refresh token");

  const rotated = await rotateRefreshToken(presented, {
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!rotated) return apiError(401, "UNAUTHORIZED", "Refresh token is invalid or expired");

  const { user, token } = rotated;
  const res = NextResponse.json({
    accessToken: signAccessToken({ sub: user.id, email: user.email, role: user.role }),
  });
  res.cookies.set(REFRESH_COOKIE, token, refreshCookieOptions(env.REFRESH_TOKEN_TTL_DAYS * 86_400));
  return res;
}
