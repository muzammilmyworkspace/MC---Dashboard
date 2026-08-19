import { NextResponse } from "next/server";
import { z } from "zod";
import { LandingPageStatus } from "@prisma/client";
import { apiError, requireRole } from "@/server/auth";
import { removeLandingPage, updateLandingPage } from "@/server/landing-pages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(500).optional(),
    productionUrl: z.string().trim().url().refine((u) => /^https?:\/\//i.test(u), "Must be http(s)").optional(),
    previewUrl: z.string().trim().url().refine((u) => /^https?:\/\//i.test(u), "Must be http(s)").optional().or(z.literal("")),
    status: z.nativeEnum(LandingPageStatus).optional(),
    isSelected: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, "TEAM");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Check the form and try again.", parsed.error.flatten().fieldErrors);
  }

  try {
    const page = await updateLandingPage(id, parsed.data);
    if (!page) return apiError(404, "NOT_FOUND", "That landing page no longer exists.");
    return NextResponse.json({ page });
  } catch (err) {
    console.error(`[landing-pages] update failed: ${err instanceof Error ? err.message : err}`);
    return apiError(500, "LANDING_PAGES_ERROR", "Could not update the landing page.");
  }
}

/**
 * Removes the page from MC Nexus only.
 *
 * Nothing in this handler talks to Vercel — the hosted project is untouched
 * by design, and the absence of any Vercel call is what guarantees it.
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, "TEAM");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  try {
    const removed = await removeLandingPage(id);
    if (!removed) return apiError(404, "NOT_FOUND", "That landing page no longer exists.");
    return NextResponse.json({ removed: true, id });
  } catch (err) {
    console.error(`[landing-pages] delete failed: ${err instanceof Error ? err.message : err}`);
    return apiError(500, "LANDING_PAGES_ERROR", "Could not remove the landing page.");
  }
}
