/* ------------------------------------------------------------------ *
 *  Instagram aggregation rules
 *
 *  Pure functions, deliberately free of Prisma and `server-only` so the
 *  arithmetic that every reported figure depends on can be tested
 *  directly rather than through the database.
 * ------------------------------------------------------------------ */

export type Granularity = "daily" | "weekly" | "monthly";
export type Nullable = number | null;

export const DAY_MS = 86_400_000;

export const isoDay = (d: Date) => d.toISOString().slice(0, 10);
export const midnightUtc = (key: string) => new Date(`${key}T00:00:00.000Z`);

/** Every date from start to end inclusive. */
export function eachDay(startDate: string, endDate: string): string[] {
  const out: string[] = [];
  const end = midnightUtc(endDate).getTime();
  for (let t = midnightUtc(startDate).getTime(); t <= end; t += DAY_MS) {
    out.push(isoDay(new Date(t)));
  }
  return out;
}

/** Monday-start week, which is how a reporting week is normally read. */
export function weekStart(key: string): string {
  const d = midnightUtc(key);
  const shift = (d.getUTCDay() + 6) % 7;
  return isoDay(new Date(d.getTime() - shift * DAY_MS));
}

export const monthStart = (key: string) => `${key.slice(0, 7)}-01`;

export function bucketKeyFor(day: string, granularity: Granularity): string {
  if (granularity === "weekly") return weekStart(day);
  if (granularity === "monthly") return monthStart(day);
  return day;
}

const fmtDay = (k: string) =>
  midnightUtc(k).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export function labelFor(key: string, granularity: Granularity, endDate: string, startDate?: string): string {
  if (granularity === "daily") return fmtDay(key);
  if (granularity === "monthly") {
    return midnightUtc(key).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  }
  // A partial week is labelled by the days it actually contains, clamped at
  // both ends. A range starting mid-week otherwise announced "20 Jul – 26 Jul"
  // while holding figures only from the 22nd, presenting two absent days as
  // though they had been counted.
  const first = startDate
    ? new Date(Math.max(midnightUtc(key).getTime(), midnightUtc(startDate).getTime()))
    : midnightUtc(key);
  const last = new Date(Math.min(midnightUtc(key).getTime() + 6 * DAY_MS, midnightUtc(endDate).getTime()));
  return `${fmtDay(isoDay(first))} – ${fmtDay(isoDay(last))}`;
}

/**
 * Sums only the entries that carry a value.
 *
 * Returns null when none do. This is the rule that keeps "Meta reported
 * nothing" from rendering as a confident zero — the two must stay
 * distinguishable all the way to the screen.
 */
export function sumOrNull(values: Nullable[]): Nullable {
  const present = values.filter((v): v is number => v !== null && v !== undefined);
  return present.length ? present.reduce((a, b) => a + b, 0) : null;
}

/** The last value present in the list, or null. Levels take the close. */
export function lastOrNull(values: Nullable[]): Nullable {
  for (let i = values.length - 1; i >= 0; i--) {
    const v = values[i];
    if (v !== null && v !== undefined) return v;
  }
  return null;
}

/**
 * Interactions ÷ reach, as a percentage.
 *
 * Computed from summed numerator and denominator, never averaged from
 * per-bucket rates: averaging would weight a day with 3 views the same as a
 * day with 3,000 and quietly overstate a quiet period.
 */
export function engagementRate(interactions: Nullable, reach: Nullable): Nullable {
  if (interactions === null || reach === null || reach <= 0) return null;
  return Number(((interactions / reach) * 100).toFixed(2));
}

/**
 * Net follower movement for a period.
 *
 * Null unless both halves are known — a day holding follows but not unfollows
 * would otherwise report the follows as if they were the net.
 */
export function netGrowth(gained: Nullable, lost: Nullable): Nullable {
  if (gained === null || lost === null) return null;
  return gained - lost;
}

/** Groups the days of a range into bucket keys, preserving chronology. */
export function groupDays(days: string[], granularity: Granularity): { key: string; days: string[] }[] {
  const order: string[] = [];
  const map = new Map<string, string[]>();
  for (const day of days) {
    const key = bucketKeyFor(day, granularity);
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(day);
  }
  return order.map((key) => ({ key, days: map.get(key)! }));
}
