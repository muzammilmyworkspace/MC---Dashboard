/* ------------------------------------------------------------------ *
 *  MC Nexus — Social Media Posting
 *  Starts completely empty. The team enters everything manually.
 *  Each day can hold multiple content blocks; each block keeps
 *  independent content per platform.
 * ------------------------------------------------------------------ */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const platforms = ["instagram", "facebook", "linkedin", "tiktok", "youtube"] as const;
export type PlatformKey = (typeof platforms)[number];

export const platformLabel: Record<PlatformKey, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
};

export type Language = "en" | "nl";
export type MediaTab = "post" | "reel";

export interface PlatformContent {
  hook: string;
  caption: string;
  hashtags: string;
  cta: string;
  /** Dutch variants — filled by the team (AI translation lands in Phase 2). */
  hookNl: string;
  captionNl: string;
  ctaNl: string;
}

export interface MediaItem {
  id: string;
  name: string;
  kind: "image" | "video";
  /** Object URL for the current session. Persisted uploads land with Cloudinary. */
  url: string;
  size: number;
}

export interface ContentBlock {
  id: string;
  content: Record<PlatformKey, PlatformContent>;
  mediaTab: MediaTab;
  postMedia: MediaItem[]; // image or carousel
  reelMedia: MediaItem | null; // single video
}

export const emptyPlatformContent = (): PlatformContent => ({
  hook: "", caption: "", hashtags: "", cta: "", hookNl: "", captionNl: "", ctaNl: "",
});

export const createBlock = (): ContentBlock => ({
  id: crypto.randomUUID(),
  content: Object.fromEntries(platforms.map((p) => [p, emptyPlatformContent()])) as Record<PlatformKey, PlatformContent>,
  mediaTab: "post",
  postMedia: [],
  reelMedia: null,
});

export const isBlockEmpty = (b: ContentBlock) =>
  platforms.every((p) => {
    const c = b.content[p];
    return !c.hook && !c.caption && !c.hashtags && !c.cta;
  }) && b.postMedia.length === 0 && !b.reelMedia;

interface PostingState {
  /** date (YYYY-MM-DD) → content blocks */
  days: Record<string, ContentBlock[]>;
  getBlocks: (date: string) => ContentBlock[];
  addBlock: (date: string) => void;
  removeBlock: (date: string, blockId: string) => void;
  updateContent: (date: string, blockId: string, platform: PlatformKey, patch: Partial<PlatformContent>) => void;
  setMediaTab: (date: string, blockId: string, tab: MediaTab) => void;
  addPostMedia: (date: string, blockId: string, items: MediaItem[]) => void;
  setReelMedia: (date: string, blockId: string, item: MediaItem | null) => void;
  removePostMedia: (date: string, blockId: string, mediaId: string) => void;
  clearDay: (date: string) => void;
  datesWithContent: () => string[];
}

const mutateBlock = (
  days: Record<string, ContentBlock[]>,
  date: string,
  blockId: string,
  fn: (b: ContentBlock) => ContentBlock
) => ({
  ...days,
  [date]: (days[date] ?? []).map((b) => (b.id === blockId ? fn(b) : b)),
});

export const usePosting = create<PostingState>()(
  persist(
    (set, get) => ({
      days: {},

      getBlocks: (date) => get().days[date] ?? [],

      addBlock: (date) =>
        set((s) => ({ days: { ...s.days, [date]: [...(s.days[date] ?? []), createBlock()] } })),

      removeBlock: (date, blockId) =>
        set((s) => ({ days: { ...s.days, [date]: (s.days[date] ?? []).filter((b) => b.id !== blockId) } })),

      updateContent: (date, blockId, platform, patch) =>
        set((s) => ({
          days: mutateBlock(s.days, date, blockId, (b) => ({
            ...b,
            content: { ...b.content, [platform]: { ...b.content[platform], ...patch } },
          })),
        })),

      setMediaTab: (date, blockId, tab) =>
        set((s) => ({ days: mutateBlock(s.days, date, blockId, (b) => ({ ...b, mediaTab: tab })) })),

      addPostMedia: (date, blockId, items) =>
        set((s) => ({
          days: mutateBlock(s.days, date, blockId, (b) => ({ ...b, postMedia: [...b.postMedia, ...items] })),
        })),

      setReelMedia: (date, blockId, item) =>
        set((s) => ({ days: mutateBlock(s.days, date, blockId, (b) => ({ ...b, reelMedia: item })) })),

      removePostMedia: (date, blockId, mediaId) =>
        set((s) => ({
          days: mutateBlock(s.days, date, blockId, (b) => ({
            ...b,
            postMedia: b.postMedia.filter((m) => m.id !== mediaId),
          })),
        })),

      clearDay: (date) => set((s) => ({ days: { ...s.days, [date]: [] } })),

      datesWithContent: () =>
        Object.entries(get().days)
          .filter(([, blocks]) => blocks.length > 0)
          .map(([date]) => date),
    }),
    {
      name: "mc-nexus-posting-v1",
      /**
       * Text is persisted; media object URLs are session-scoped (they would
       * bloat localStorage and expire on reload). Cloudinary handles durable
       * media once the storage integration is connected.
       */
      partialize: (s) => ({
        days: Object.fromEntries(
          Object.entries(s.days).map(([date, blocks]) => [
            date,
            blocks.map((b) => ({ ...b, postMedia: [], reelMedia: null })),
          ])
        ),
      }),
    }
  )
);

/** Builds the plain-text block used by the Copy action. */
export function contentToText(c: PlatformContent, lang: Language) {
  const hook = lang === "nl" ? c.hookNl || c.hook : c.hook;
  const caption = lang === "nl" ? c.captionNl || c.caption : c.caption;
  const cta = lang === "nl" ? c.ctaNl || c.cta : c.cta;
  return [hook, caption, cta, c.hashtags].filter(Boolean).join("\n\n");
}
