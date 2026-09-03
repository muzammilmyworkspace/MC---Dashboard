import { NextResponse } from "next/server";
import { apiError, requireRole } from "@/server/auth";
import { createBlog, listBlogs } from "@/server/blogs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Blog management is internal — only the team ever sees this list. */
export async function GET(req: Request) {
  const auth = await requireRole(req, "TEAM");
  if (auth instanceof NextResponse) return auth;

  try {
    return NextResponse.json({ blogs: await listBlogs() });
  } catch (err) {
    console.error(`[blogs] list failed: ${err instanceof Error ? err.message : err}`);
    return apiError(500, "BLOGS_ERROR", "Could not load blog posts.");
  }
}

/**
 * Creates an empty draft and hands back its id. The editor is what collects
 * title, content and SEO fields — a "New post" click has nothing worth
 * asking for up front.
 */
export async function POST(req: Request) {
  const auth = await requireRole(req, "TEAM");
  if (auth instanceof NextResponse) return auth;

  try {
    const blog = await createBlog(auth.sub);
    return NextResponse.json({ blog }, { status: 201 });
  } catch (err) {
    console.error(`[blogs] create failed: ${err instanceof Error ? err.message : err}`);
    return apiError(500, "BLOGS_ERROR", "Could not create the blog post.");
  }
}
