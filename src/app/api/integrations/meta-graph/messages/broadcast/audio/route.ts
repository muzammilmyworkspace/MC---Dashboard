import { NextResponse } from "next/server";
import { apiError, requireAuth } from "@/server/auth";
import { broadcastAudio, MessagingUnavailableError } from "@/server/meta/messaging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 15 * 1024 * 1024;

/** One recorded voice note, sent to many conversations. Multipart: "audio" file + "conversationIds" (JSON array string). */
export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const form = await req.formData().catch(() => null);
  const file = form?.get("audio");
  const idsRaw = form?.get("conversationIds");
  if (!(file instanceof File)) return apiError(400, "VALIDATION_ERROR", "No audio file was provided.");
  if (file.size === 0) return apiError(400, "VALIDATION_ERROR", "The recording is empty.");
  if (file.size > MAX_BYTES) return apiError(400, "VALIDATION_ERROR", "Voice note is too large.");

  let conversationIds: unknown;
  try {
    conversationIds = typeof idsRaw === "string" ? JSON.parse(idsRaw) : null;
  } catch {
    conversationIds = null;
  }
  if (!Array.isArray(conversationIds) || conversationIds.length === 0 || !conversationIds.every((id) => typeof id === "string")) {
    return apiError(400, "VALIDATION_ERROR", "Select at least one conversation.");
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const results = await broadcastAudio(conversationIds, buffer, file.type || "audio/webm", auth.sub);
    return NextResponse.json({ results });
  } catch (err) {
    if (err instanceof MessagingUnavailableError) return apiError(502, err.code.toUpperCase(), err.message);
    console.error(`[messages] broadcast audio failed: ${err instanceof Error ? err.message : err}`);
    return apiError(500, "MESSAGES_ERROR", "Could not send the broadcast.");
  }
}
