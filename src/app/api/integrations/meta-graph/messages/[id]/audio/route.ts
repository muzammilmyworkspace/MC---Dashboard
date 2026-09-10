import { NextResponse } from "next/server";
import { apiError, requireAuth } from "@/server/auth";
import { sendAudio, MessagingUnavailableError } from "@/server/meta/messaging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_BYTES = 15 * 1024 * 1024;

/** Voice note upload — multipart from the browser's recorder, field name "audio". */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const form = await req.formData().catch(() => null);
  const file = form?.get("audio");
  if (!(file instanceof File)) return apiError(400, "VALIDATION_ERROR", "No audio file was provided.");
  if (file.size === 0) return apiError(400, "VALIDATION_ERROR", "The recording is empty.");
  if (file.size > MAX_BYTES) return apiError(400, "VALIDATION_ERROR", "Voice note is too large.");

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const message = await sendAudio(id, buffer, file.type || "audio/webm", auth.sub);
    return NextResponse.json({ message });
  } catch (err) {
    if (err instanceof MessagingUnavailableError) return apiError(502, err.code.toUpperCase(), err.message);
    console.error(`[messages] audio send failed: ${err instanceof Error ? err.message : err}`);
    return apiError(500, "MESSAGES_ERROR", "Could not send the voice note.");
  }
}
