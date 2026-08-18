import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { refreshCookieOptions, revokeRefreshToken, REFRESH_COOKIE } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const jar = await cookies();
  const presented = jar.get(REFRESH_COOKIE)?.value;
  // Revoke server-side too: clearing the cookie alone would leave a working
  // token in anyone's hands who already copied it.
  if (presented) await revokeRefreshToken(presented);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(REFRESH_COOKIE, "", refreshCookieOptions(0));
  return res;
}
