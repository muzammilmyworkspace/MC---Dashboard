import "server-only";
import { env } from "../env";
import { providerRequest } from "../http";

/* ------------------------------------------------------------------ *
 *  Facebook Pages
 *
 *  Verified against the live token: /me/accounts returns the Pages with
 *  fan and follower counts. Page-level insights are a separate, more
 *  restricted surface, so they are reported as unavailable rather than
 *  guessed at.
 * ------------------------------------------------------------------ */

const GRAPH = "https://graph.facebook.com";

export interface FacebookPage {
  id: string;
  name: string;
  category: string | null;
  /** Page likes. Meta returns null for some Page types. */
  fanCount: number | null;
  followersCount: number | null;
  pictureUrl: string | null;
  linkedInstagram: { id: string; username: string } | null;
}

async function graph<T>(path: string, params: Record<string, string | number>, cacheTtlMs = 300_000): Promise<T> {
  const token = (env.META_ACCESS_TOKEN ?? "").trim();
  if (!token) throw new Error("META_ACCESS_TOKEN is not set");

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v));

  return providerRequest<T>({
    provider: "meta-pages",
    url: `${GRAPH}/${env.META_GRAPH_VERSION}/${path}?${qs.toString()}`,
    token,
    cacheTtlMs,
  });
}

export async function listPages(): Promise<FacebookPage[]> {
  const res = await graph<{
    data?: {
      id: string; name?: string; category?: string;
      fan_count?: number; followers_count?: number;
      picture?: { data?: { url?: string } };
      instagram_business_account?: { id: string; username: string };
    }[];
  }>("me/accounts", {
    fields: "id,name,category,fan_count,followers_count,picture{url},instagram_business_account{id,username}",
    limit: 25,
  });

  return (res.data ?? []).map((p) => ({
    id: p.id,
    name: p.name ?? "(unnamed page)",
    category: p.category ?? null,
    fanCount: p.fan_count ?? null,
    followersCount: p.followers_count ?? null,
    pictureUrl: p.picture?.data?.url ?? null,
    linkedInstagram: p.instagram_business_account
      ? { id: p.instagram_business_account.id, username: p.instagram_business_account.username }
      : null,
  }));
}

export interface PagePost {
  id: string;
  message: string;
  createdTime: string;
  permalink: string | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
}

/**
 * Recent Page posts.
 *
 * Requires a Page access token rather than the user token, so this takes one
 * explicitly. Callers that don't have one should not display the section at
 * all rather than showing an empty list, which would read as "no posts".
 */
export async function listPagePosts(pageId: string, pageToken: string, limit = 10): Promise<PagePost[]> {
  const qs = new URLSearchParams({
    fields: "id,message,created_time,permalink_url,likes.summary(true).limit(0),comments.summary(true).limit(0),shares",
    limit: String(limit),
  });

  const res = await providerRequest<{
    data?: {
      id: string; message?: string; created_time: string; permalink_url?: string;
      likes?: { summary?: { total_count?: number } };
      comments?: { summary?: { total_count?: number } };
      shares?: { count?: number };
    }[];
  }>({
    provider: "meta-pages",
    url: `${GRAPH}/${env.META_GRAPH_VERSION}/${pageId}/posts?${qs.toString()}`,
    token: pageToken,
    cacheTtlMs: 300_000,
  });

  return (res.data ?? []).map((p) => ({
    id: p.id,
    message: p.message ?? "",
    createdTime: p.created_time,
    permalink: p.permalink_url ?? null,
    likes: p.likes?.summary?.total_count ?? null,
    comments: p.comments?.summary?.total_count ?? null,
    shares: p.shares?.count ?? null,
  }));
}
