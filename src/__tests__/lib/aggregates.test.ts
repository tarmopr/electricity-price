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
const seedHourly = (
  sqlite: DatabaseSync,
  startIso: string,
  endIso: string,
  centsAt?: (t: number) => number
) => seedSlots(sqlite, startIso, endIso, 3600, centsAt);

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
    // 2025-07-15 is a Tuesday (weekday 1, 0=Monday): the only seeded Tuesday, so hour 0 averages 100
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

  it("does not write partial rows for days or weeks outside the whole-week window", async () => {
    // Production hourly_averages holds all history, not just the recompute window
    sqlite.exec(
      "INSERT INTO hourly_averages SELECT timestamp, price_cents_kwh, price_cents_kwh, price_cents_kwh, 1 FROM prices"
    );
    await syncMidOctober();
    expect(daily("2025-09-29")).toMatchObject({ data_points: 24 }); // first day of window (Mon)
    expect(daily("2025-11-02")).toMatchObject({ data_points: 24 }); // last day of window (Sun)
    expect(daily("2025-09-28")).toBeUndefined();
    expect(daily("2025-11-03")).toBeUndefined();
    const weeks = sqlite
      .prepare("SELECT MIN(week) AS lo, MAX(week) AS hi, COUNT(*) AS n FROM weekly_averages")
      .get();
    expect(weeks).toEqual({ lo: 39, hi: 43, n: 5 });
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

describe("recomputeAllAggregates — atomic write", () => {
  const TABLES = ["daily_averages", "weekly_averages", "monthly_averages", "weekday_hour_averages"];
  const snapshot = () =>
    TABLES.map((t) => sqlite.prepare(`SELECT * FROM ${t} ORDER BY 1, 2, 3, 4`).all());

  it("rolls back all four calendar tables when any aggregate write fails", async () => {
    seedHourly(sqlite, "2025-09-15T00:00:00Z", "2025-11-15T00:00:00Z");
    // Fail on the 200th aggregate insert in any table. The sync writes ~209 rows and no
    // table has more than 168, so any split into several batches would commit some
    // rows before the failure, whatever the statement order.
    sqlite.exec(`
      INSERT INTO daily_averages VALUES ('2025-10-10', 999, 999, 999, 1);
      INSERT INTO monthly_averages VALUES (2025, 10, 999, 999, 999, 1);
      CREATE TABLE insert_count (n INTEGER); INSERT INTO insert_count VALUES (0);
      ${TABLES.map(
        (t) => `CREATE TRIGGER count_${t} BEFORE INSERT ON ${t} BEGIN
          UPDATE insert_count SET n = n + 1;
          SELECT RAISE(ABORT, 'simulated D1 failure') WHERE (SELECT n FROM insert_count) = 200;
        END;`
      ).join("\n")}
    `);
    const before = snapshot();
    await expect(
      recomputeAllAggregates(d1, ts("2025-10-15T00:00:00Z"), ts("2025-10-16T00:00:00Z"))
    ).rejects.toThrow("simulated D1 failure");
    expect(snapshot()).toEqual(before);
  });
});

/** Inserts one raw price every `step` seconds in [a, b); price in ¢/kWh. */
function seedSlots(sqlite: DatabaseSync, a: string, b: string, step = 3600, cents: (t: number) => number = () => 10) {
  const ins = sqlite.prepare("INSERT INTO prices (timestamp, price_eur_mwh, price_cents_kwh) VALUES (?, ?, ?)");
  for (let t = ts(a); t < ts(b); t += step) {
    const c = cents(t);
    ins.run(t, c * 10, c);
  }
}
const q = (sql: string, ...p: (string | number)[]) => sqlite.prepare(sql).get(...p);
const wd = (y: number, m: number, w: number, h: number) =>
  q("SELECT sample_count AS n FROM weekday_hour_averages WHERE year=? AND month=? AND weekday=? AND hour=?", y, m, w, h);

describe("recomputeAllAggregates — coverage", () => {
  it("writes all 168 weekday-hour rows of a month (~200 statements in one batch)", async () => {
    seedSlots(sqlite, "2025-09-15T00:00:00Z", "2025-11-15T00:00:00Z");
    await recomputeAllAggregates(d1, ts("2025-10-15T00:00:00Z"), ts("2025-10-16T00:00:00Z"));
    expect(q("SELECT COUNT(*) AS rows, SUM(sample_count) AS samples FROM weekday_hour_averages WHERE year=2025 AND month=10"))
      .toEqual({ rows: 168, samples: 31 * 24 + 1 });
    expect(wd(2025, 10, 2, 12)).toEqual({ n: 5 }); // Wednesdays 1,8,15,22,29
    expect(wd(2025, 10, 0, 12)).toEqual({ n: 4 }); // Mondays
    expect(wd(2025, 10, 6, 3)).toEqual({ n: 5 });  // 4 Sundays + repeated 03:00 on 26 Oct
  });

  it("overwrites stale rows (INSERT OR REPLACE)", async () => {
    seedSlots(sqlite, "2025-09-15T00:00:00Z", "2025-11-15T00:00:00Z");
    sqlite.exec(`INSERT INTO daily_averages VALUES ('2025-10-10', 999, 999, 999, 1);
      INSERT INTO monthly_averages VALUES (2025, 10, 999, 999, 999, 1);
      INSERT INTO weekly_averages VALUES (2025, 40, 999, 999, 999, 1);
      INSERT INTO weekday_hour_averages VALUES (2025, 10, 0, 0, 999, 1);`);
    await recomputeAllAggregates(d1, ts("2025-10-15T00:00:00Z"), ts("2025-10-16T00:00:00Z"));
    expect(q("SELECT avg_price, data_points FROM daily_averages WHERE date='2025-10-10'")).toEqual({ avg_price: 10, data_points: 24 });
    expect(q("SELECT avg_price, data_points FROM monthly_averages WHERE year=2025 AND month=10")).toEqual({ avg_price: 10, data_points: 745 });
    expect(q("SELECT avg_price, data_points FROM weekly_averages WHERE year=2025 AND week=40")).toEqual({ avg_price: 10, data_points: 168 });
    expect(q("SELECT avg_price, sample_count FROM weekday_hour_averages WHERE year=2025 AND month=10 AND weekday=0 AND hour=0")).toEqual({ avg_price: 10, sample_count: 4 });
  });

  it("fall-back day: repeated 03:00 gets two samples, 02:00 one", async () => {
    seedSlots(sqlite, "2025-10-25T00:00:00Z", "2025-10-28T00:00:00Z");
    await recomputeAllAggregates(d1, ts("2025-10-25T00:00:00Z"), ts("2025-10-28T00:00:00Z"));
    expect(wd(2025, 10, 6, 2)).toEqual({ n: 1 });
    expect(wd(2025, 10, 6, 3)).toEqual({ n: 2 });
    expect(wd(2025, 10, 6, 4)).toEqual({ n: 1 });
  });

  it("spring-forward day: no 03:00 slot, 02:00 and 04:00 present", async () => {
    seedSlots(sqlite, "2025-03-29T00:00:00Z", "2025-04-01T00:00:00Z");
    await recomputeAllAggregates(d1, ts("2025-03-29T00:00:00Z"), ts("2025-04-01T00:00:00Z"));
    expect(wd(2025, 3, 6, 2)).toEqual({ n: 1 });
    expect(wd(2025, 3, 6, 3)).toBeUndefined();
    expect(wd(2025, 3, 6, 4)).toEqual({ n: 1 });
  });

  it("daily min/max come from sub-hour extremes, not hourly averages", async () => {
    const slot = [8, 10, 12, 10];
    seedSlots(sqlite, "2025-01-14T22:00:00Z", "2025-01-15T22:00:00Z", 900, (t) => slot[(t / 900) % 4]);
    await recomputeAllAggregates(d1, ts("2025-01-15T00:00:00Z"), ts("2025-01-15T12:00:00Z"));
    expect(q("SELECT avg_price, min_price, max_price, data_points FROM daily_averages WHERE date='2025-01-15'"))
      .toEqual({ avg_price: 10, min_price: 8, max_price: 12, data_points: 24 });
  });

  it("year boundary: Tallinn 1 Jan 00:00 (31 Dec 22:00Z) lands in 2026 rows; %W week split", async () => {
    const spike = ts("2025-12-31T22:00:00Z");
    seedSlots(sqlite, "2025-12-28T22:00:00Z", "2026-01-05T22:00:00Z", 3600, (t) => (t === spike ? 100 : 10));
    await recomputeAllAggregates(d1, ts("2026-01-01T00:00:00Z"), ts("2026-01-02T00:00:00Z"));
    expect(q("SELECT max_price, data_points FROM daily_averages WHERE date='2026-01-01'")).toEqual({ max_price: 100, data_points: 24 });
    expect(q("SELECT max_price, data_points FROM daily_averages WHERE date='2025-12-31'")).toEqual({ max_price: 10, data_points: 24 });
    expect(q("SELECT data_points FROM weekly_averages WHERE year=2025 AND week=52")).toEqual({ data_points: 72 });
    expect(q("SELECT max_price, data_points FROM weekly_averages WHERE year=2026 AND week=0")).toEqual({ max_price: 100, data_points: 96 });
    expect(q("SELECT COUNT(*) AS n FROM weekly_averages")).toEqual({ n: 3 }); // (2025,52) (2026,0) (2026,1)
    expect(q("SELECT avg_price FROM weekday_hour_averages WHERE year=2026 AND month=1 AND weekday=3 AND hour=0")).toEqual({ avg_price: 100 });
    expect(q("SELECT COUNT(*) AS n FROM monthly_averages WHERE year=2025")).toEqual({ n: 0 });
  });

  it("sync spanning a Tallinn month boundary writes both months whole", async () => {
    seedSlots(sqlite, "2025-09-15T00:00:00Z", "2025-12-05T00:00:00Z");
    await recomputeAllAggregates(d1, ts("2025-10-31T12:00:00Z"), ts("2025-11-01T12:00:00Z"));
    expect(q("SELECT data_points FROM monthly_averages WHERE year=2025 AND month=10")).toEqual({ data_points: 745 });
    expect(q("SELECT data_points FROM monthly_averages WHERE year=2025 AND month=11")).toEqual({ data_points: 720 });
    expect(q("SELECT COUNT(*) AS n FROM weekday_hour_averages")).toEqual({ n: 336 });
  });

  it("no data in window: no throw, no rows, no batch", async () => {
    const batch = vi.spyOn(d1, "batch");
    await expect(recomputeAllAggregates(d1, ts("2025-10-15T00:00:00Z"), ts("2025-10-16T00:00:00Z"))).resolves.toBeUndefined();
    const total = q(`SELECT (SELECT COUNT(*) FROM daily_averages) + (SELECT COUNT(*) FROM weekly_averages)
      + (SELECT COUNT(*) FROM monthly_averages) + (SELECT COUNT(*) FROM weekday_hour_averages) AS n`);
    expect(total).toEqual({ n: 0 });
    expect(batch).not.toHaveBeenCalled();
  });
});
