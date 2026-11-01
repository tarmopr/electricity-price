// @vitest-environment node
import { describe, it, expect } from "vitest";
import { DatabaseSync } from "node:sqlite";
import {
  bucketTallinnAggregates,
  getTallinnAggregateRange,
  mondayWeekOfYear,
} from "@/lib/tallinnAggregates";
import { addDaysToDateStr } from "@/lib/timezone";

const ts = (iso: string) => Math.floor(Date.parse(iso) / 1000);

describe("mondayWeekOfYear", () => {
  it("matches SQLite strftime('%W') for every day 2023–2027", () => {
    // weekly_averages.week has always been SQLite %W; keep stored keys stable
    const sqlite = new DatabaseSync(":memory:");
    const stmt = sqlite.prepare("SELECT CAST(strftime('%W', ?) AS INTEGER) AS w");
    for (let d = "2023-01-01"; d < "2028-01-01"; d = addDaysToDateStr(d, 1)) {
      const [y, m, day] = d.split("-").map(Number);
      expect(mondayWeekOfYear(y, m, day), d).toBe(stmt.get(d)!.w);
    }
  });
});

describe("getTallinnAggregateRange", () => {
  it("covers whole Tallinn months and the whole weeks around them", () => {
    const range = getTallinnAggregateRange(ts("2025-10-15T00:00:00Z"), ts("2025-10-16T00:00:00Z"));
    // Mon 2025-09-29 00:00 EEST … Mon 2025-11-03 00:00 EET
    expect(range.readStart).toBe(ts("2025-09-28T21:00:00Z"));
    expect(range.readEnd).toBe(ts("2025-11-02T22:00:00Z"));
    expect([...range.months]).toEqual(["2025-10"]);
  });

  it("uses the Tallinn date of the range end, which is exclusive", () => {
    // Ends exactly at 2025-11-01 00:00 Tallinn → October only
    const range = getTallinnAggregateRange(ts("2025-10-31T12:00:00Z"), ts("2025-10-31T22:00:00Z"));
    expect([...range.months]).toEqual(["2025-10"]);
    // Starts at 2025-11-01 00:30 Tallinn (still Oct 31 in UTC) → November only
    const nov = getTallinnAggregateRange(ts("2025-10-31T22:30:00Z"), ts("2025-11-01T06:00:00Z"));
    expect([...nov.months]).toEqual(["2025-11"]);
  });

  it("lists every month for a range spanning a year boundary", () => {
    const range = getTallinnAggregateRange(ts("2025-12-20T00:00:00Z"), ts("2026-02-03T00:00:00Z"));
    expect([...range.months]).toEqual(["2025-12", "2026-01", "2026-02"]);
  });

  it("does not widen when the month or the next month starts on a Monday", () => {
    // 2025-09-01 and 2025-12-01 are Mondays
    const sep = getTallinnAggregateRange(ts("2025-09-10T00:00:00Z"), ts("2025-09-11T00:00:00Z"));
    expect(sep.readStart).toBe(ts("2025-08-31T21:00:00Z"));
    const nov = getTallinnAggregateRange(ts("2025-11-10T00:00:00Z"), ts("2025-11-11T00:00:00Z"));
    expect(nov.readEnd).toBe(ts("2025-11-30T22:00:00Z"));
  });
});

describe("bucketTallinnAggregates", () => {
  const row = (t: number, p = 10) => ({ timestamp: t, avg_price: p, min_price: p, max_price: p });

  it("ignores rows outside [readStart, readEnd)", () => {
    const range = getTallinnAggregateRange(ts("2025-10-15T00:00:00Z"), ts("2025-10-16T00:00:00Z"));
    const agg = bucketTallinnAggregates(
      [
        row(range.readStart - 3600, 999),
        row(range.readStart),
        row(range.readEnd - 3600),
        row(range.readEnd, 999),
      ],
      range
    );
    expect(agg.daily.map((d) => d.date)).toEqual(["2025-09-29", "2025-11-02"]);
    expect(agg.weekly.every((w) => w.maxPrice === 10)).toBe(true);
  });
});
