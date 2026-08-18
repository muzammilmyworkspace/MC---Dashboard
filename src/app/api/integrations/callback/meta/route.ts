import { NextResponse } from "next/server";
import { completeOAuth, MetaOAuthError, verifyOAuthState } from "@/server/meta/oauth";
import { MetaNotConfiguredError } from "@/server/meta/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * OAuth step 2 — Meta redirects the browser here.
 *
 * Deliberately unauthenticated: a plain browser navigation carries no
 * Authorization header, so requiring one would make the flow impossible.
 * The signed `state` is the credential — it proves this server started the
 * flow and identifies who started it.
 *
 * Now same-origin, so the redirect target is derived from the incoming
 * request rather than CORS_ORIGIN. That removes the class of bug where a
 * stale origin sent the connection result to a different application.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code") ?? undefined;
  const state = url.searchParams.get("state") ?? undefined;
  const oauthError = url.searchParams.get("error");

  /** Always this deployment's own origin — never a value from the query. */
  const back = (params: Record<string, string>) =>
    NextResponse.redirect(`${url.origin}/instagram?${new URLSearchParams(params)}`);

  const trim = (m: string) => (m.length > 220 ? `${m.slice(0, 217)}…` : m);

  if (oauthError) {
    const cancelled = url.searchParams.get("error_reason") === "user_denied" || oauthError === "access_denied";
    return back({
      integration: "instagram",
      status: "error",
      reason: cancelled ? "cancelled" : "denied",
      message: cancelled
        ? "Connection cancelled — you didn't authorize MC Nexus."
        : "Meta declined the authorization request.",
    });
  }

  try {
    // Presence flags only — these values are credentials.
    console.log(`[meta-oauth] callback · code=${code ? "present" : "absent"} state=${state ? "present" : "absent"}`);

    const { userId } = verifyOAuthState(state);
    if (!code) throw new MetaOAuthError("no_code", "Meta didn't return an authorization code. Please try again.");

    const account = await completeOAuth(code, userId);
    console.log(`[meta-oauth] connected · ig=${account.igAccountId} stored=yes`);

    return back({ integration: "instagram", status: "connected", account: account.igUsername });
  } catch (err) {
    if (err instanceof MetaNotConfiguredError) {
      return back({ integration: "instagram", status: "error", reason: "not_configured", message: trim(err.message) });
    }
    if (err instanceof MetaOAuthError) {
      console.warn(`[meta-oauth] failed · reason=${err.code}`);
      return back({ integration: "instagram", status: "error", reason: err.code, message: trim(err.message) });
    }
    // Log the type only: an unknown error's message may embed a Meta payload.
    console.error("[meta-oauth] callback failed:", (err as Error)?.name ?? "UnknownError");
    return back({
      integration: "instagram",
      status: "error",
      reason: "server_error",
      message: "Something went wrong completing the connection.",
    });
  }
}
