import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireAuth } from "@/server/auth";
import { getAnalytics } from "@/server/instagram/analytics";
import { isConfigured, MetaApiError } from "@/server/instagram/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

/**
 * The single analytics endpoint.
 *
 * One request serves the whole screen. Every figure is read from our own
 * snapshot tables rather than from Meta at request time, so opening the page
 * costs no Meta quota and stays fast — the sync is what talks to Meta.
 */

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const schema = z
  .object({
    startDate: z.string().regex(DATE, "Use YYYY-MM-DD"),
    endDate: z.string().regex(DATE, "Use YYYY-MM-DD"),
    granularity: z.enum(["daily", "weekly", "monthly"]).default("daily"),
  })
  .refine((v) => v.startDate <= v.endDate, { message: "startDate must be on or before endDate", path: ["startDate"] })
  .refine(
    // Two years is far beyond anything Meta retains, and an unbounded range
    // would let one request build a bucket list of arbitrary size.
    (v) => (Date.parse(v.endDate) - Date.parse(v.startDate)) / DAY <= 730,
    { message: "Range cannot exceed two years", path: ["endDate"] }
  );

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const p = new URL(req.url).searchParams;
  const today = iso(new Date());

  const parsed = schema.safeParse({
    startDate: p.get("startDate") ?? iso(new Date(Date.now() - 29 * DAY)),
    endDate: p.get("endDate") ?? today,
    granularity: p.get("granularity") ?? "daily",
  });

  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Check the selected dates.", parsed.error.flatten().fieldErrors);
  }

  if (!isConfigured()) {
    // A missing connection is a state the page renders, not an error it shows
    // as a crash — hence 200 with configured:false.
    return NextResponse.json({
      configured: false,
      message: "Instagram isn't connected yet.",
    });
  }

  try {
    return NextResponse.json(await getAnalytics(parsed.data));
  } catch (err) {
    // Token and permission failures need different wording from a generic
    // outage, because only the client can act on them.
    if (err instanceof MetaApiError) {
      if (err.authFailure) {
        return apiError(
          502,
          "META_TOKEN_INVALID",
          "The Instagram connection has expired. Reconnect Instagram to continue."
        );
      }
      // Meta signals these through its own error codes rather than the HTTP
      // status, so the mapping keys off `code`: 4/17/32/613 are the throttles,
      // 10 and the 200s are permission refusals.
      if ([4, 17, 32, 613].includes(err.code ?? 0)) {
        return apiError(429, "META_RATE_LIMITED", "Instagram is rate-limiting requests. Try again in a few minutes.");
      }
      if (err.code === 10 || (err.code ?? 0) >= 200) {
        return apiError(
          502,
          "META_PERMISSION",
          "Instagram Insights permission is required for this data. Reconnect and grant insights access."
        );
      }
    }
    console.error(`[instagram] analytics failed: ${err instanceof Error ? err.message : err}`);
    return apiError(502, "INSTAGRAM_ERROR", "Instagram data is temporarily unavailable.");
  }
}
