import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireAuth } from "@/server/auth";
import { getConversation, sendText, MessagingUnavailableError } from "@/server/meta/messaging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One thread, in order. Opening it marks the conversation read. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  try {
    const thread = await getConversation(id);
    if (!thread) return apiError(404, "NOT_FOUND", "That conversation no longer exists.");
    return NextResponse.json(thread);
  } catch (err) {
    console.error(`[messages] thread failed: ${err instanceof Error ? err.message : err}`);
    return apiError(500, "MESSAGES_ERROR", "Could not load this conversation.");
  }
}

const sendSchema = z.object({ text: z.string().trim().min(1, "Message can't be empty").max(1000) });

/** The one button that reaches Instagram — everything else here just reads our own database. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Check the message and try again.", parsed.error.flatten().fieldErrors);
  }

  try {
    const message = await sendText(id, parsed.data.text, auth.sub);
    return NextResponse.json({ message });
  } catch (err) {
    if (err instanceof MessagingUnavailableError) return apiError(502, err.code.toUpperCase(), err.message);
    console.error(`[messages] send failed: ${err instanceof Error ? err.message : err}`);
    return apiError(500, "MESSAGES_ERROR", "Could not send the message.");
  }
}
