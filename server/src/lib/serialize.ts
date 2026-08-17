import type { Caption, ContentPost, DayPlan, Reel, Review, User } from "@prisma/client";

/** DB enums are UPPER_SNAKE; the frontend model uses lower_snake. */
const lower = (v: string) => v.toLowerCase();

export const ymd = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

export type FullDayPlan = DayPlan & {
  captions: Caption[];
  reel: Reel | null;
  post: ContentPost | null;
  reviews: (Review & { author: Pick<User, "id" | "name" | "avatarColor"> })[];
};

export function serializeDayPlan(p: FullDayPlan) {
  return {
    id: p.id,
    date: ymd(p.date),
    goal: p.goal,
    purpose: p.purpose,
    primaryPlatform: lower(p.primaryPlatform),
    time: p.postingTime,
    status: lower(p.status),
    gradient: p.gradient,
    emoji: p.emoji,
    cta: p.cta,
    captionNl: p.captionNl,
    hashtags: p.hashtags,
    storyIdeas: p.storyIdeas,
    captions: Object.fromEntries(p.captions.map((c) => [lower(c.platform), c.text])),
    reel: p.reel
      ? {
          topic: p.reel.topic,
          hook: p.reel.hook,
          script: p.reel.script,
          bRoll: p.reel.bRoll,
          closingCta: p.reel.closingCta,
          thumbnailConcept: p.reel.thumbnailConcept,
          editorNotes: p.reel.editorNotes,
        }
      : null,
    post: p.post
      ? {
          type: lower(p.post.type),
          topic: p.post.topic,
          imageConcept: p.post.imageConcept,
          photographyDirection: p.post.photographyDirection,
          graphicText: p.post.graphicText,
          designerNotes: p.post.designerNotes,
          slides: p.post.slides ?? undefined,
        }
      : null,
    reviews: p.reviews.map((r) => ({
      id: r.id,
      author: r.author.name,
      authorId: r.author.id,
      avatarColor: r.author.avatarColor,
      status: lower(r.status),
      comment: r.comment,
      at: r.createdAt.toISOString(),
    })),
  };
}

/** Eager-loading shape shared by every day-plan query. */
export const dayPlanInclude = {
  captions: true,
  reel: true,
  post: true,
  reviews: {
    orderBy: { createdAt: "asc" as const },
    include: { author: { select: { id: true, name: true, avatarColor: true } } },
  },
};
