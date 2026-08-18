import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { env } from "@/server/env";
import { prisma } from "@/server/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const params = new URL(req.url).searchParams;
  const limit = Math.min(100, Math.max(1, Number(params.get("limit") ?? 24)));
  const type = params.get("type") ?? "ALL";

  const media = await prisma.igMedia.findMany({
    where: {
      igAccountId: env.IG_BUSINESS_ACCOUNT_ID ?? "",
      ...(type === "ALL" ? {} : { productType: type }),
    },
    orderBy: { timestamp: "desc" },
    take: limit,
  });

  return NextResponse.json({
    media: media.map((m) => ({
      ...m,
      engagementRate:
        m.reach && m.reach > 0
          ? Number((((m.totalInteractions ?? m.likeCount + m.commentsCount) / m.reach) * 100).toFixed(2))
          : null,
    })),
  });
}
