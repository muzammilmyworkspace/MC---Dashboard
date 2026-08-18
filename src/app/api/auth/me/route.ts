import { NextResponse } from "next/server";
import { prisma } from "@/server/prisma";
import { apiError, requireAuth } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const user = await prisma.user.findUnique({ where: { id: auth.sub } });
  if (!user || !user.isActive) return apiError(401, "UNAUTHORIZED", "Account is no longer active");

  return NextResponse.json({
    user: {
      id: user.id, email: user.email, name: user.name,
      role: user.role, title: user.title, avatarColor: user.avatarColor,
    },
  });
}
