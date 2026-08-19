import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireRole } from "@/server/auth";
import { refreshPages } from "@/server/landing-pages";
import { describeVercelError, logVercelError } from "@/server/vercel/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

// Omitting ids refreshes everything tracked; passing them refreshes one card.
const schema = z.object({ ids: z.array(z.string().trim().min(1)).max(200).optional() });

/**
 * Refreshes deployment state for pages already in MC Nexus.
 *
 * Never imports. A project added in Vercel after the last import stays
 * invisible here until it is ticked in the selection modal.
 */
export async function POST(req: Request) {
  const auth = await requireRole(req, "TEAM");
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid request.", parsed.error.flatten().fieldErrors);
  }

  try {
    return NextResponse.json(await refreshPages(parsed.data.ids));
  } catch (err) {
    logVercelError("sync", err);
    const failure = describeVercelError(err);
    return apiError(failure.status, failure.code, failure.message);
  }
}
