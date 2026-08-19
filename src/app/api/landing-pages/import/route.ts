import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireRole } from "@/server/auth";
import { importProjects } from "@/server/landing-pages";
import { describeVercelError, logVercelError } from "@/server/vercel/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const schema = z.object({
  // The explicit list is the whole point of this endpoint: there is no
  // "import everything" flag, so no client bug can pull in the account.
  vercelProjectIds: z.array(z.string().trim().min(1)).min(1, "Select at least one project").max(100),
});

export async function POST(req: Request) {
  const auth = await requireRole(req, "TEAM");
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Select at least one project to add.", parsed.error.flatten().fieldErrors);
  }

  try {
    const result = await importProjects(parsed.data.vercelProjectIds, auth.sub);
    return NextResponse.json(result);
  } catch (err) {
    logVercelError("import", err);
    const failure = describeVercelError(err);
    return apiError(failure.status, failure.code, failure.message);
  }
}
