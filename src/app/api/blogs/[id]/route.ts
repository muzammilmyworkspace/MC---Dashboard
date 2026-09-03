import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireRole } from "@/server/auth";
import { getBlog, removeBlog, updateBlog } from "@/server/blogs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, "TEAM");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  try {
    const blog = await getBlog(id);
    if (!blog) return apiError(404, "NOT_FOUND", "That blog post no longer exists.");
    return NextResponse.json({ blog });
  } catch (err) {
    console.error(`[blogs] get failed: ${err instanceof Error ? err.message : err}`);
    return apiError(500, "BLOGS_ERROR", "Could not load the blog post.");
  }
}

const patchSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(200).optional(),
    slug: z.string().trim().max(100).optional(),
    excerpt: z.string().trim().max(300).optional(),
    content: z.string().max(200_000).optional(),
    coverImage: z.string().trim().max(2000).optional(),
    category: z.string().trim().max(80).optional(),
    seoTitle: z.string().trim().max(70).optional(),
    seoDescription: z.string().trim().max(200).optional(),
    keywords: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

/** Every field a draft can hold — this is the autosave/manual-save path, not publish. */
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
    const blog = await updateBlog(id, parsed.data);
    if (!blog) return apiError(404, "NOT_FOUND", "That blog post no longer exists.");
    return NextResponse.json({ blog });
  } catch (err) {
    console.error(`[blogs] update failed: ${err instanceof Error ? err.message : err}`);
    return apiError(500, "BLOGS_ERROR", "Could not save the blog post.");
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, "TEAM");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  try {
    const removed = await removeBlog(id);
    if (!removed) return apiError(404, "NOT_FOUND", "That blog post no longer exists.");
    return NextResponse.json({ removed: true, id });
  } catch (err) {
    console.error(`[blogs] delete failed: ${err instanceof Error ? err.message : err}`);
    return apiError(500, "BLOGS_ERROR", "Could not delete the blog post.");
  }
}
