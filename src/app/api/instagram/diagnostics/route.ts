import { NextResponse } from "next/server";
import { requireRole } from "@/server/auth";
import { env } from "@/server/env";
import { debugToken, discoverAccounts } from "@/server/instagram/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Setup probe: verifies the token and lists every Page with its linked
 * Instagram account. Needs only META_ACCESS_TOKEN — requiring the account id
 * would be circular, since finding it is this endpoint's whole purpose.
 */
export async function GET(req: Request) {
  const auth = await requireRole(req, "TEAM");
  if (auth instanceof NextResponse) return auth;

  if (!env.META_ACCESS_TOKEN) {
    return NextResponse.json({ configured: false, missing: ["META_ACCESS_TOKEN"], token: null, accounts: [] });
  }

  const probe = {
    token: env.META_ACCESS_TOKEN,
    igAccountId: env.IG_BUSINESS_ACCOUNT_ID ?? "",
    version: env.META_GRAPH_VERSION,
  };

  const [token, accounts] = await Promise.allSettled([debugToken(probe), discoverAccounts()]);

  return NextResponse.json({
    configured: true,
    missing: [],
    token: token.status === "fulfilled" ? token.value : { valid: false, message: token.reason?.message },
    accounts: accounts.status === "fulfilled" ? accounts.value : [],
    accountsError: accounts.status === "rejected" ? accounts.reason?.message : null,
    configuredAccountId: env.IG_BUSINESS_ACCOUNT_ID,
  });
}
