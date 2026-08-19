import { NextResponse } from "next/server";
import { z } from "zod";
import { LandingPageStatus } from "@prisma/client";
import { apiError, requireAuth, requireRole } from "@/server/auth";
import { createManualPage, listLandingPages } from "@/server/landing-pages";
import { vercelConfigured } from "@/server/vercel/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Any signed-in user may view the curated list. */
export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    return NextResponse.json({
      pages: await listLandingPages(),
      vercelConfigured: vercelConfigured(),
    });
  } catch (err) {
    console.error(`[landing-pages] list failed: ${err instanceof Error ? err.message : err}`);
    return apiError(500, "LANDING_PAGES_ERROR", "Could not load landing pages.");
  }
}

const manualSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  productionUrl: z
    .string()
    .trim()
    .url("Enter a full URL, including https://")
    // Only http(s): a javascript: or data: URL here would become a link the
    // client clicks from inside the dashboard.
    .refine((u) => /^https?:\/\//i.test(u), "URL must start with http:// or https://"),
  description: z.string().trim().max(500).optional(),
  status: z.nativeEnum(LandingPageStatus).optional(),
});

/** Adding a page is a team action; clients read the result. */
export async function POST(req: Request) {
  const auth = await requireRole(req, "TEAM");
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const parsed = manualSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Check the form and try again.", parsed.error.flatten().fieldErrors);
  }

  try {
    const page = await createManualPage(parsed.data, auth.sub);
    return NextResponse.json({ page }, { status: 201 });
  } catch (err) {
    console.error(`[landing-pages] manual create failed: ${err instanceof Error ? err.message : err}`);
    return apiError(500, "LANDING_PAGES_ERROR", "Could not save the landing page.");
  }
}
