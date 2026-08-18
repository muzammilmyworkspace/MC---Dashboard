import { NextResponse } from "next/server";
import { apiError, requireAuth } from "@/server/auth";
import { buildAuthorizeUrl, signOAuthState } from "@/server/meta/oauth";
import { MetaNotConfiguredError } from "@/server/meta/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** OAuth step 1 — the URL the browser is sent to. */
export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    // State is bound to the caller so the callback can prove who started it.
    const state = signOAuthState(auth.sub);
    return NextResponse.json({ url: buildAuthorizeUrl(state), state });
  } catch (err) {
    if (err instanceof MetaNotConfiguredError) {
      return apiError(400, "NOT_CONFIGURED", err.message, err.missing);
    }
    throw err;
  }
}
