import "server-only";
import { env } from "./env";
import type { BlogDto } from "./blogs";

/* ------------------------------------------------------------------ *
 *  WordPress (maincharacter.nl)
 *
 *  Publishing pushes a real WordPress post through wp-json/wp/v2 — not a
 *  copy on a second system. That is what keeps RankMath, the sitemap and
 *  the site's own /blog/ permalinks working exactly as they do for every
 *  other post, instead of building a parallel blog engine.
 * ------------------------------------------------------------------ */

export function wpConfigured(): boolean {
  return Boolean(env.WORDPRESS_URL && env.WORDPRESS_USERNAME && env.WORDPRESS_APP_PASSWORD);
}

function authHeader(): string {
  const token = Buffer.from(`${env.WORDPRESS_USERNAME}:${env.WORDPRESS_APP_PASSWORD}`).toString("base64");
  return `Basic ${token}`;
}

function apiUrl(path: string): string {
  return `${(env.WORDPRESS_URL ?? "").replace(/\/+$/, "")}/wp-json${path}`;
}

async function wpFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(apiUrl(path), { ...init, headers: { Authorization: authHeader(), ...(init.headers ?? {}) } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`WordPress ${init.method ?? "GET"} ${path} failed (${res.status}): ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

/* ----------------------------- markdown-lite → HTML ----------------------------- */

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const INLINE_RE = /(\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))/g;

function inlineHtml(text: string): string {
  let out = "";
  let last = 0;
  INLINE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = INLINE_RE.exec(text))) {
    out += escapeHtml(text.slice(last, m.index));
    if (m[2] !== undefined) out += `<strong>${escapeHtml(m[2])}</strong>`;
    else if (m[3] !== undefined) out += `<em>${escapeHtml(m[3])}</em>`;
    else if (m[4] !== undefined) out += `<em>${escapeHtml(m[4])}</em>`;
    else if (m[5] !== undefined && m[6] !== undefined)
      out += `<a href="${escapeHtml(m[6])}" rel="noopener noreferrer">${escapeHtml(m[5])}</a>`;
    last = m.index + m[0].length;
  }
  out += escapeHtml(text.slice(last));
  return out;
}

/** Same subset the in-app preview renders — kept in sync so what you saw is what ships. */
export function markdownLiteToHtml(content: string): string {
  const blocks = content.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return blocks
    .map((block) => {
      const lines = block.split("\n");
      if (block.startsWith("### ")) return `<h3>${inlineHtml(block.slice(4))}</h3>`;
      if (block.startsWith("## ")) return `<h2>${inlineHtml(block.slice(3))}</h2>`;
      if (block.startsWith("# ")) return `<h1>${inlineHtml(block.slice(2))}</h1>`;
      if (lines.every((l) => /^[-*]\s+/.test(l))) {
        return `<ul>${lines.map((l) => `<li>${inlineHtml(l.replace(/^[-*]\s+/, ""))}</li>`).join("")}</ul>`;
      }
      return `<p>${lines.map(inlineHtml).join("<br>\n")}</p>`;
    })
    .join("\n");
}

/* --------------------------------- category --------------------------------- */

interface WpCategory {
  id: number;
  name: string;
}

/** Finds a category by exact name, or creates it. Never fails the publish — a lookup error just skips categorisation. */
async function ensureCategory(name: string): Promise<number | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  try {
    const found = await wpFetch<WpCategory[]>(`/wp/v2/categories?search=${encodeURIComponent(trimmed)}&per_page=10`);
    const exact = found.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
    if (exact) return exact.id;

    const created = await wpFetch<WpCategory>(`/wp/v2/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    return created.id;
  } catch (err) {
    console.error(`[wordpress] category lookup failed for "${trimmed}": ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

/* ------------------------------ featured image ------------------------------- */

/** Downloads the cover image and re-uploads it into the WordPress media library. Best-effort. */
async function uploadFeaturedImage(imageUrl: string): Promise<number | null> {
  try {
    const source = await fetch(imageUrl);
    if (!source.ok) throw new Error(`source fetch failed (${source.status})`);
    const contentType = source.headers.get("content-type") ?? "image/jpeg";
    const bytes = Buffer.from(await source.arrayBuffer());
    const filename = imageUrl.split("/").pop()?.split("?")[0] || "cover.jpg";

    const media = await wpFetch<{ id: number }>(`/wp/v2/media`, {
      method: "POST",
      headers: { "Content-Type": contentType, "Content-Disposition": `attachment; filename="${filename}"` },
      body: bytes,
    });
    return media.id;
  } catch (err) {
    console.error(`[wordpress] featured image upload failed: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

/* -------------------------------- RankMath SEO -------------------------------- */

/**
 * RankMath's post-meta isn't registered for the generic `meta` object on
 * `/wp/v2/posts` on this install, so setting it there is silently dropped.
 * Its own `updateMeta` endpoint — what the RankMath editor sidebar itself
 * calls — works regardless. Best-effort: a failure here never blocks the
 * post from going live, it just leaves that post's SEO fields for someone
 * to fill in inside RankMath directly.
 */
async function pushSeoMeta(postId: number, blog: BlogDto): Promise<void> {
  try {
    await wpFetch(`/rankmath/v1/updateMeta`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objectID: postId,
        objectType: "post",
        meta: {
          title: blog.seoTitle || blog.title,
          description: blog.seoDescription || blog.excerpt,
          focusKeywords: blog.keywords.join(", "),
        },
      }),
    });
  } catch (err) {
    console.error(`[wordpress] RankMath meta push failed for post ${postId}: ${err instanceof Error ? err.message : err}`);
  }
}

/* ---------------------------------- publish ----------------------------------- */

interface WpPostResponse {
  id: number;
  link: string;
}

export interface WordPressPublishResult {
  wpPostId: number;
  wpUrl: string;
}

/**
 * Creates the post the first time, updates it on every publish after that —
 * `blog.wpPostId` is what tells the two apart, so hitting Publish again
 * never creates a duplicate.
 */
export async function publishToWordPress(blog: BlogDto): Promise<WordPressPublishResult> {
  const categoryId = blog.category ? await ensureCategory(blog.category) : null;
  const featuredMedia = blog.coverImage ? await uploadFeaturedImage(blog.coverImage) : null;

  const payload: Record<string, unknown> = {
    title: blog.title,
    slug: blog.slug,
    content: markdownLiteToHtml(blog.content),
    excerpt: blog.excerpt,
    status: "publish",
  };
  if (categoryId) payload.categories = [categoryId];
  if (featuredMedia) payload.featured_media = featuredMedia;

  const path = blog.wpPostId ? `/wp/v2/posts/${blog.wpPostId}` : `/wp/v2/posts`;
  const post = await wpFetch<WpPostResponse>(path, {
    method: blog.wpPostId ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  await pushSeoMeta(post.id, blog);

  return { wpPostId: post.id, wpUrl: post.link };
}

/** Pulls a post back to draft on the WordPress side without deleting it. */
export async function unpublishFromWordPress(wpPostId: number): Promise<void> {
  await wpFetch(`/wp/v2/posts/${wpPostId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "draft" }),
  });
}
