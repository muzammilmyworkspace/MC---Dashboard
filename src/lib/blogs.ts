import type { BlogStatus } from "@/lib/api";

/** Same wording rule as landing pages: plain language, not the enum name. */
export const blogStatusMeta: Record<BlogStatus, { label: string; tone: "success" | "warning" | "muted"; help: string }> = {
  DRAFT: { label: "Draft", tone: "warning", help: "Only visible here. Nothing has been published yet." },
  PUBLISHED: { label: "Published", tone: "success", help: "Live and indexable by search engines." },
};

/** Client-side preview only — the server re-derives and de-duplicates the real slug on save. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function wordCount(content: string): number {
  const trimmed = content.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export function readingMinutes(content: string): number {
  return Math.max(1, Math.round(wordCount(content) / 200));
}

/** Splits on comma/enter, trims, drops empties and duplicates — how the keyword chip input feeds the field. */
export function parseKeywords(raw: string): string[] {
  const parts = raw
    .split(/[,\n]/)
    .map((k) => k.trim())
    .filter(Boolean);
  return Array.from(new Set(parts));
}

const TITLE_LIMIT = 60;
const DESCRIPTION_LIMIT = 160;

export interface SeoCheck {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
}

/**
 * The handful of on-page checks that actually move Google rankings for a
 * small site: a title and description in the length Google won't truncate,
 * at least one keyword to target, and real body copy. Nothing here talks to
 * Google — it is the same checklist any SEO plugin runs client-side.
 */
export function seoChecklist(input: {
  seoTitle: string;
  title: string;
  seoDescription: string;
  excerpt: string;
  keywords: string[];
  content: string;
}): SeoCheck[] {
  const effectiveTitle = input.seoTitle || input.title;
  const effectiveDescription = input.seoDescription || input.excerpt;
  const words = wordCount(input.content);

  return [
    {
      key: "title-length",
      label: "SEO title length",
      ok: effectiveTitle.length > 0 && effectiveTitle.length <= TITLE_LIMIT,
      detail: effectiveTitle.length === 0 ? "Add a title." : `${effectiveTitle.length}/${TITLE_LIMIT} characters`,
    },
    {
      key: "description-length",
      label: "Meta description length",
      ok: effectiveDescription.length > 0 && effectiveDescription.length <= DESCRIPTION_LIMIT,
      detail:
        effectiveDescription.length === 0
          ? "Add a description or excerpt."
          : `${effectiveDescription.length}/${DESCRIPTION_LIMIT} characters`,
    },
    {
      key: "keywords",
      label: "Focus keywords",
      ok: input.keywords.length > 0,
      detail: input.keywords.length > 0 ? `${input.keywords.length} keyword${input.keywords.length === 1 ? "" : "s"}` : "Add at least one keyword.",
    },
    {
      key: "content-length",
      label: "Content length",
      ok: words >= 300,
      detail: `${words} words${words < 300 ? " — aim for 300+" : ""}`,
    },
  ];
}
