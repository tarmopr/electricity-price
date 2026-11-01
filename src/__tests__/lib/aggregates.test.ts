// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { createSqliteD1 } from "@/__tests__/helpers/sqliteD1";

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(),
}));

import { recomputeAllAggregates } from "@/lib/db";

// Real-SQL tests for the aggregate tables (issue #14): every row must be bucketed
// by its Europe/Tallinn date, including during summer time (EEST, UTC+3).

const ts = (iso: string) => Math.floor(Date.parse(iso) / 1000);

/** Inserts one raw price per hour in [startIso, endIso); price in ¢/kWh. */
function seedHourly(
  sqlite: DatabaseSync,
  startIso: string,
  endIso: string,
  centsAt: (t: number) => number = () => 10
) {
  const insert = sqlite.prepare(
    "INSERT INTO prices (timestamp, price_eur_mwh, price_cents_kwh) VALUES (?, ?, ?)"
  );
  for (let t = ts(startIso); t < ts(endIso); t += 3600) {
    const cents = centsAt(t);
    insert.run(t, cents * 10, cents);
  }
}

let d1: D1Database;
let sqlite: DatabaseSync;

beforeEach(() => {
  ({ d1, sqlite } = createSqliteD1());
});

const daily = (date: string) =>
  sqlite.prepare("SELECT * FROM daily_averages WHERE date = ?").get(date);
const monthly = (year: number, month: number) =>
  sqlite.prepare("SELECT * FROM monthly_averages WHERE year = ? AND month = ?").get(year, month);

describe("recomputeAllAggregates — Tallinn summer time (EEST)", () => {
  // 2025-07-14T21:00Z is 2025-07-15 00:00 in Tallinn (UTC+3)
  const spike = ts("2025-07-14T21:00:00Z");

  beforeEach(async () => {
    seedHourly(sqlite, "2025-07-13T21:00:00Z", "2025-07-16T21:00:00Z", (t) =>
      t === spike ? 100 : 10
    );
    await recomputeAllAggregates(d1, ts("2025-07-14T00:00:00Z"), ts("2025-07-16T00:00:00Z"));
  });

  it("attributes the 21:00 UTC hour to the next Tallinn day", () => {
    expect(daily("2025-07-15")).toMatchObject({ max_price: 100, data_points: 24 });
    expect(daily("2025-07-14")).toMatchObject({ max_price: 10, data_points: 24 });
  });

  it("puts the 21:00 UTC hour in the next weekday's hour 0", () => {
    // 2025-07-15 is a Tuesday (ISO weekday 1); only that day has a 00:00 slot of 100
    const row = sqlite
      .prepare(
        "SELECT avg_price FROM weekday_hour_averages WHERE year = 2025 AND month = 7 AND weekday = 1 AND hour = 0"
      )
      .get();
    expect(row).toEqual({ avg_price: 100 });
  });
});

describe("recomputeAllAggregates — DST transition days", () => {
  it("counts 23 hours on the spring-forward day", async () => {
    seedHourly(sqlite, "2025-03-29T00:00:00Z", "2025-04-01T00:00:00Z");
    await recomputeAllAggregates(d1, ts("2025-03-29T00:00:00Z"), ts("2025-04-01T00:00:00Z"));
    expect(daily("2025-03-30")).toMatchObject({ data_points: 23 });
  });

  it("counts 25 hours on the fall-back day", async () => {
    seedHourly(sqlite, "2025-10-25T00:00:00Z", "2025-10-28T00:00:00Z");
    await recomputeAllAggregates(d1, ts("2025-10-25T00:00:00Z"), ts("2025-10-28T00:00:00Z"));
    expect(daily("2025-10-26")).toMatchObject({ data_points: 25 });
  });
});

describe("recomputeAllAggregates — month and week boundaries", () => {
  beforeEach(() => {
    seedHourly(sqlite, "2025-09-15T00:00:00Z", "2025-11-15T00:00:00Z");
  });

  const syncMidOctober = () =>
    recomputeAllAggregates(d1, ts("2025-10-15T00:00:00Z"), ts("2025-10-16T00:00:00Z"));

  it("recomputes the first Tallinn day of the month with all 24 hours", async () => {
    await syncMidOctober();
    // 2025-10-01 00:00 Tallinn is 2025-09-30T21:00Z — before the UTC month start
    expect(daily("2025-10-01")).toMatchObject({ data_points: 24 });
  });

  it("recomputes the whole Tallinn month (745 hours incl. the fall-back hour)", async () => {
    await syncMidOctober();
    expect(monthly(2025, 10)).toMatchObject({ data_points: 31 * 24 + 1 });
  });

  it("recomputes weeks that span two months with all 168 hours", async () => {
    await syncMidOctober();
    const week = (date: string) =>
      sqlite
        .prepare(
          "SELECT w.data_points FROM weekly_averages w WHERE w.year = 2025 AND w.week = CAST(strftime('%W', ?) AS INTEGER)"
        )
        .get(date);
    expect(week("2025-09-29")).toEqual({ data_points: 168 }); // Mon 29 Sep – Sun 5 Oct
    expect(week("2025-10-27")).toEqual({ data_points: 168 }); // Mon 27 Oct – Sun 2 Nov
  });

  it("does not write partial rows for neighbouring months", async () => {
    sqlite
      .prepare(
        "INSERT INTO monthly_averages (year, month, avg_price, min_price, max_price, data_points) VALUES (2025, 9, 999, 999, 999, 1)"
      )
      .run();
    await syncMidOctober();
    expect(monthly(2025, 9)).toMatchObject({ avg_price: 999, data_points: 1 });
    expect(monthly(2025, 11)).toBeUndefined();
    const novPattern = sqlite
      .prepare("SELECT COUNT(*) AS n FROM weekday_hour_averages WHERE year = 2025 AND month = 11")
      .get();
    expect(novPattern).toEqual({ n: 0 });
  });
});

describe("recomputeAllAggregates — values", () => {
  it("averages hourly averages with equal weight and keeps min/max", async () => {
    // Tallinn 2025-01-15 (EET, UTC+2): 22:00Z on the 14th → 22:00Z on the 15th
    seedHourly(sqlite, "2025-01-14T22:00:00Z", "2025-01-15T22:00:00Z", (t) =>
      t === ts("2025-01-15T10:00:00Z") ? 34 : 10
    );
    await recomputeAllAggregates(d1, ts("2025-01-15T00:00:00Z"), ts("2025-01-15T12:00:00Z"));
    const row = daily("2025-01-15") as { avg_price: number; min_price: number; max_price: number; data_points: number };
    expect(row.data_points).toBe(24);
    expect(row.avg_price).toBeCloseTo((23 * 10 + 34) / 24);
    expect(row.min_price).toBe(10);
    expect(row.max_price).toBe(34);
  });
});
