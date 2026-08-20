import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  eachDay, weekStart, monthStart, bucketKeyFor, labelFor, groupDays,
  sumOrNull, lastOrNull, engagementRate, netGrowth,
} from "./instagram-math";

/* ------------------------------------------------------------------ *
 *  The rules these cover are the ones that silently corrupt a report
 *  when they are wrong: a missing figure read as zero, a rate averaged
 *  instead of recomputed, or a follower level summed like a flow.
 * ------------------------------------------------------------------ */

describe("sumOrNull", () => {
  test("sums the values that are present", () => {
    assert.equal(sumOrNull([1, 2, 3]), 6);
  });

  test("ignores nulls rather than counting them as zero", () => {
    assert.equal(sumOrNull([5, null, 5]), 10);
  });

  test("returns null when nothing was reported", () => {
    // The distinction the whole module rests on: no data is not zero.
    assert.equal(sumOrNull([null, null]), null);
    assert.equal(sumOrNull([]), null);
  });

  test("keeps a reported zero as zero", () => {
    assert.equal(sumOrNull([0, 0]), 0);
  });
});

describe("lastOrNull", () => {
  test("takes the closing value, not the sum", () => {
    // Followers is a level. Summing 5900 + 5910 + 5920 would be nonsense.
    assert.equal(lastOrNull([5900, 5910, 5920]), 5920);
  });

  test("skips trailing gaps", () => {
    assert.equal(lastOrNull([5900, 5910, null]), 5910);
  });

  test("returns null when never observed", () => {
    assert.equal(lastOrNull([null, null]), null);
  });
});

describe("engagementRate", () => {
  test("is interactions over reach as a percentage", () => {
    assert.equal(engagementRate(96, 1115), 8.61);
  });

  test("is recomputed from totals, not averaged from daily rates", () => {
    // One busy day and one quiet day. Averaging the two daily rates gives
    // (1% + 50%) / 2 = 25.5%, which is wrong by a factor of twenty — the
    // quiet day carries almost no weight in reality.
    const days = [
      { interactions: 30, reach: 3000 },
      { interactions: 1, reach: 2 },
    ];
    const correct = engagementRate(
      days.reduce((a, d) => a + d.interactions, 0),
      days.reduce((a, d) => a + d.reach, 0)
    );
    const naiveAverage =
      days.reduce((a, d) => a + (d.interactions / d.reach) * 100, 0) / days.length;

    assert.equal(correct, 1.03);
    assert.ok(naiveAverage > 25, "the naive average really is this far off");
  });

  test("is null when reach is unknown or zero", () => {
    assert.equal(engagementRate(10, null), null);
    assert.equal(engagementRate(10, 0), null);
    assert.equal(engagementRate(null, 100), null);
  });
});

describe("netGrowth", () => {
  test("is new followers minus unfollows", () => {
    assert.equal(netGrowth(16, 5), 11);
  });

  test("goes negative when more people left than joined", () => {
    assert.equal(netGrowth(2, 10), -8);
  });

  test("is null unless both halves are known", () => {
    // A day with follows but no unfollows would otherwise report the follows
    // as the net, inventing growth that was never measured.
    assert.equal(netGrowth(16, null), null);
    assert.equal(netGrowth(null, 5), null);
  });
});

describe("date bucketing", () => {
  test("eachDay is inclusive of both ends", () => {
    assert.deepEqual(eachDay("2026-08-01", "2026-08-03"), ["2026-08-01", "2026-08-02", "2026-08-03"]);
  });

  test("eachDay handles a single day", () => {
    assert.deepEqual(eachDay("2026-08-01", "2026-08-01"), ["2026-08-01"]);
  });

  test("eachDay crosses a month boundary", () => {
    assert.deepEqual(eachDay("2026-07-31", "2026-08-01"), ["2026-07-31", "2026-08-01"]);
  });

  test("weeks start on Monday", () => {
    // 2026-08-19 is a Wednesday; its week starts Monday the 17th.
    assert.equal(weekStart("2026-08-19"), "2026-08-17");
    assert.equal(weekStart("2026-08-17"), "2026-08-17");
    // Sunday belongs to the week that began the previous Monday, not the next.
    assert.equal(weekStart("2026-08-23"), "2026-08-17");
    assert.equal(weekStart("2026-08-24"), "2026-08-24");
  });

  test("months start on the first", () => {
    assert.equal(monthStart("2026-08-19"), "2026-08-01");
  });

  test("granularity selects the bucket key", () => {
    assert.equal(bucketKeyFor("2026-08-19", "daily"), "2026-08-19");
    assert.equal(bucketKeyFor("2026-08-19", "weekly"), "2026-08-17");
    assert.equal(bucketKeyFor("2026-08-19", "monthly"), "2026-08-01");
  });
});

describe("groupDays", () => {
  test("daily keeps one day per bucket", () => {
    const g = groupDays(eachDay("2026-08-01", "2026-08-03"), "daily");
    assert.equal(g.length, 3);
    assert.deepEqual(g[0].days, ["2026-08-01"]);
  });

  test("weekly groups by Monday and stays in order", () => {
    const g = groupDays(eachDay("2026-08-14", "2026-08-24"), "weekly");
    assert.deepEqual(g.map((b) => b.key), ["2026-08-10", "2026-08-17", "2026-08-24"]);
    // The first bucket is partial: the range starts mid-week on Friday.
    assert.deepEqual(g[0].days, ["2026-08-14", "2026-08-15", "2026-08-16"]);
    assert.equal(g[1].days.length, 7);
    assert.equal(g[2].days.length, 1);
  });

  test("monthly groups by month", () => {
    const g = groupDays(eachDay("2026-07-30", "2026-08-02"), "monthly");
    assert.deepEqual(g.map((b) => b.key), ["2026-07-01", "2026-08-01"]);
    assert.equal(g[0].days.length, 2);
    assert.equal(g[1].days.length, 2);
  });

  test("every day lands in exactly one bucket", () => {
    const days = eachDay("2026-06-01", "2026-08-31");
    for (const granularity of ["daily", "weekly", "monthly"] as const) {
      const total = groupDays(days, granularity).reduce((a, b) => a + b.days.length, 0);
      assert.equal(total, days.length, `${granularity} lost or duplicated days`);
    }
  });
});

describe("labelFor", () => {
  test("daily shows the day", () => {
    assert.equal(labelFor("2026-08-19", "daily", "2026-08-19"), "19 Aug");
  });

  test("monthly shows month and year", () => {
    assert.equal(labelFor("2026-08-01", "monthly", "2026-08-31"), "August 2026");
  });

  test("weekly shows the span", () => {
    assert.equal(labelFor("2026-08-17", "weekly", "2026-08-31"), "17 Aug – 23 Aug");
  });

  test("a week is never labelled before the start of the range", () => {
    // The range opens on Wednesday the 19th; the bucket's Monday is the 17th.
    // Advertising "17 Aug" would present two uncounted days as included.
    assert.equal(labelFor("2026-08-17", "weekly", "2026-08-31", "2026-08-19"), "19 Aug – 23 Aug");
  });

  test("a week is never labelled past the end of the range", () => {
    // Claiming "17 Aug – 23 Aug" when the data stops on the 19th would
    // present four missing days as though they were counted.
    assert.equal(labelFor("2026-08-17", "weekly", "2026-08-19"), "17 Aug – 19 Aug");
  });
});
