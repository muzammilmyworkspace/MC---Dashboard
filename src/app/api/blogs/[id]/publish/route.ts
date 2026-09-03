import { NextResponse } from "next/server";
import { apiError, requireRole } from "@/server/auth";
import { publishBlog, unpublishBlog } from "@/server/blogs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The one button in the editor that changes what the public can see. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, "TEAM");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  try {
    const blog = await publishBlog(id);
    if (!blog) return apiError(404, "NOT_FOUND", "That blog post no longer exists.");
    return NextResponse.json({ blog });
  } catch (err) {
    console.error(`[blogs] publish failed: ${err instanceof Error ? err.message : err}`);
    return apiError(500, "BLOGS_ERROR", "Could not publish the blog post.");
  }
}

/** Pulls a published post back to draft without losing anything. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, "TEAM");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  try {
    const blog = await unpublishBlog(id);
    if (!blog) return apiError(404, "NOT_FOUND", "That blog post no longer exists.");
    return NextResponse.json({ blog });
  } catch (err) {
    console.error(`[blogs] unpublish failed: ${err instanceof Error ? err.message : err}`);
    return apiError(500, "BLOGS_ERROR", "Could not unpublish the blog post.");
  }
}
