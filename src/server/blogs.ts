import "server-only";
import { BlogStatus, type Blog } from "@prisma/client";
import { prisma } from "./prisma";

/* ------------------------------------------------------------------ *
 *  Blogs
 *
 *  A minimal CMS for SEO posts. Every post starts as a DRAFT and stays
 *  editable and previewable forever — the only thing that changes its
 *  public state is an explicit publish/unpublish call, never a plain
 *  content edit.
 * ------------------------------------------------------------------ */

export interface BlogDto {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  category: string;
  status: BlogStatus;
  publishedAt: string | null;
  seoTitle: string;
  seoDescription: string;
  keywords: string[];
  authorId: string | null;
  authorName: string | null;
  wpPostId: number | null;
  wpUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

type BlogRow = Blog & { author: { name: string } | null };

function toDto(row: BlogRow): BlogDto {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    content: row.content,
    coverImage: row.coverImage,
    category: row.category,
    status: row.status,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    keywords: row.keywords,
    authorId: row.authorId,
    authorName: row.author?.name ?? null,
    wpPostId: row.wpPostId,
    wpUrl: row.wpUrl,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const includeAuthor = { author: { select: { name: true } } } as const;

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Appends -2, -3, … until the slug is free. Excludes `excludeId` so a post can keep its own slug while editing. */
async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || "post";
  let candidate = root;
  let n = 2;
  for (;;) {
    const clash = await prisma.blog.findFirst({
      where: { slug: candidate, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (!clash) return candidate;
    candidate = `${root}-${n++}`;
  }
}

export async function listBlogs(): Promise<BlogDto[]> {
  const rows = await prisma.blog.findMany({ include: includeAuthor, orderBy: { updatedAt: "desc" } });
  return rows.map(toDto);
}

export async function getBlog(id: string): Promise<BlogDto | null> {
  const row = await prisma.blog.findUnique({ where: { id }, include: includeAuthor });
  return row ? toDto(row) : null;
}

export async function createBlog(userId: string | null): Promise<BlogDto> {
  const slug = await uniqueSlug("untitled-post");
  const row = await prisma.blog.create({
    data: { title: "Untitled post", slug, authorId: userId },
    include: includeAuthor,
  });
  return toDto(row);
}

export interface BlogPatch {
  title?: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  coverImage?: string;
  category?: string;
  seoTitle?: string;
  seoDescription?: string;
  keywords?: string[];
}

export async function updateBlog(id: string, patch: BlogPatch): Promise<BlogDto | null> {
  const existing = await prisma.blog.findUnique({ where: { id } });
  if (!existing) return null;

  // A blank slug in the form falls back to one derived from the title
  // instead of saving an empty public URL.
  const slug =
    patch.slug !== undefined
      ? await uniqueSlug(patch.slug || patch.title || existing.title, id)
      : undefined;

  const row = await prisma.blog.update({
    where: { id },
    data: { ...patch, ...(slug !== undefined ? { slug } : {}) },
    include: includeAuthor,
  });
  return toDto(row);
}

export async function publishBlog(id: string): Promise<BlogDto | null> {
  const existing = await prisma.blog.findUnique({ where: { id } });
  if (!existing) return null;
  const row = await prisma.blog.update({
    where: { id },
    data: {
      status: BlogStatus.PUBLISHED,
      // Only stamped the first time — republishing an edit must not reset it.
      publishedAt: existing.publishedAt ?? new Date(),
    },
    include: includeAuthor,
  });
  return toDto(row);
}

export async function unpublishBlog(id: string): Promise<BlogDto | null> {
  const existing = await prisma.blog.findUnique({ where: { id } });
  if (!existing) return null;
  const row = await prisma.blog.update({
    where: { id },
    data: { status: BlogStatus.DRAFT },
    include: includeAuthor,
  });
  return toDto(row);
}

/** Records the WordPress post a publish just created or updated. */
export async function setWordPressLink(id: string, link: { wpPostId: number; wpUrl: string }): Promise<BlogDto | null> {
  const existing = await prisma.blog.findUnique({ where: { id } });
  if (!existing) return null;
  const row = await prisma.blog.update({ where: { id }, data: link, include: includeAuthor });
  return toDto(row);
}

export async function removeBlog(id: string): Promise<boolean> {
  const existing = await prisma.blog.findUnique({ where: { id } });
  if (!existing) return false;
  await prisma.blog.delete({ where: { id } });
  return true;
}
