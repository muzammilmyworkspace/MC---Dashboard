import { NextResponse } from "next/server";
import { apiError } from "@/server/auth";
import { prisma } from "@/server/prisma";
import { env } from "@/server/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Temporary diagnostic: dumps the raw state behind the "No reply in 24h+"
 * filter so it can be checked against what the real Instagram app shows.
 * Removed once the discrepancy is understood.
 */
export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (!secret || secret !== env.DEBUG_SECRET) return apiError(401, "UNAUTHORIZED", "Not authorized.");

  const rows = await prisma.igConversation.findMany({
    orderBy: { lastMessageAt: "desc" },
    take: 60,
    select: { id: true, igUsername: true, igName: true, lastMessageAt: true, lastMessageDirection: true, lastMessagePreview: true, unread: true },
  });

  const now = Date.now();
  const out = rows.map((c) => ({
    ...c,
    ageHours: c.lastMessageAt ? Math.round(((now - c.lastMessageAt.getTime()) / (60 * 60 * 1000)) * 10) / 10 : null,
    computedUnrepliedOver24h: c.lastMessageDirection === "INBOUND" && !!c.lastMessageAt && now - c.lastMessageAt.getTime() > DAY_MS,
  }));

  return NextResponse.json({ now: new Date(now).toISOString(), count: out.length, conversations: out });
}
