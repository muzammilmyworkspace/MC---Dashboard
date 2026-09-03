import { NextResponse } from "next/server";
import { apiError, requireRole } from "@/server/auth";
import { publishBlog, setWordPressLink, unpublishBlog } from "@/server/blogs";
import { publishToWordPress, unpublishFromWordPress, wpConfigured } from "@/server/wordpress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The one button in the editor that changes what the public can see.
 *
 * Publishing always succeeds in MC Nexus first — that status flip is what
 * the rest of the app reads. Pushing the post to WordPress is a second,
 * best-effort step: if maincharacter.nl is unreachable or not configured
 * yet, the post is still published here and `wpError` tells the editor why
 * the live site wasn't updated, instead of the whole action failing.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, "TEAM");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  try {
    let blog = await publishBlog(id);
    if (!blog) return apiError(404, "NOT_FOUND", "That blog post no longer exists.");

    let wpError: string | null = null;
    if (wpConfigured()) {
      try {
        const link = await publishToWordPress(blog);
        blog = (await setWordPressLink(id, link)) ?? blog;
      } catch (err) {
        wpError = err instanceof Error ? err.message : "Could not reach maincharacter.nl.";
        console.error(`[wordpress] publish push failed for blog ${id}: ${wpError}`);
      }
    }

    return NextResponse.json({ blog, wpError });
  } catch (err) {
    console.error(`[blogs] publish failed: ${err instanceof Error ? err.message : err}`);
    return apiError(500, "BLOGS_ERROR", "Could not publish the blog post.");
  }
}

/** Pulls a published post back to draft, in MC Nexus and — best-effort — on WordPress too. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, "TEAM");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  try {
    const blog = await unpublishBlog(id);
    if (!blog) return apiError(404, "NOT_FOUND", "That blog post no longer exists.");

    let wpError: string | null = null;
    if (wpConfigured() && blog.wpPostId) {
      try {
        await unpublishFromWordPress(blog.wpPostId);
      } catch (err) {
        wpError = err instanceof Error ? err.message : "Could not reach maincharacter.nl.";
        console.error(`[wordpress] unpublish push failed for blog ${id}: ${wpError}`);
      }
    }

    return NextResponse.json({ blog, wpError });
  } catch (err) {
    console.error(`[blogs] unpublish failed: ${err instanceof Error ? err.message : err}`);
    return apiError(500, "BLOGS_ERROR", "Could not unpublish the blog post.");
  }
}
