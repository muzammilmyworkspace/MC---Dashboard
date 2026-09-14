import "server-only";
import type { DatePreset, DateRange } from "./ads";

const PRESETS: DatePreset[] = ["today", "yesterday", "last_7d", "last_30d"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Reads either `preset` or a `since`/`until` pair off the query string.
 * Explicit dates win when both are present. Returns null on anything
 * invalid — callers turn that into a 400.
 */
export function parseDateRange(params: URLSearchParams): DateRange | null {
  const since = params.get("since");
  const until = params.get("until");
  if (since || until) {
    if (!since || !until || !DATE_RE.test(since) || !DATE_RE.test(until)) return null;
    if (since > until) return null;
    return { since, until };
  }

  const preset = (params.get("preset") ?? "last_30d") as DatePreset;
  if (!PRESETS.includes(preset)) return null;
  return { preset };
}
