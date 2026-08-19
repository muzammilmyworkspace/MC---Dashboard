import { NextResponse } from "next/server";
import { apiError, requireAuth } from "@/server/auth";
import { getLandingPage } from "@/server/landing-pages";
import { listDeployments } from "@/server/vercel/deployments";
import { describeVercelError, logVercelError, vercelConfigured } from "@/server/vercel/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const page = await getLandingPage(id);
  if (!page) return apiError(404, "NOT_FOUND", "That landing page no longer exists.");

  // A manually added page has no deployment history, and that is not a
  // failure — the UI shows an explanation rather than an error.
  if (!page.vercelProjectId) {
    return NextResponse.json({ deployments: [], reason: "This page was added manually, so it has no Vercel deployment history." });
  }
  if (!vercelConfigured()) {
    return NextResponse.json({ deployments: [], reason: "Vercel isn't connected yet." });
  }

  try {
    return NextResponse.json({ deployments: await listDeployments(page.vercelProjectId), reason: null });
  } catch (err) {
    logVercelError(`deployments for ${page.vercelProjectId}`, err);
    const failure = describeVercelError(err);
    return apiError(failure.status, failure.code, failure.message);
  }
}
