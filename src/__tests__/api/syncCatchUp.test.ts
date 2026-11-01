// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { createSqliteD1 } from "@/__tests__/helpers/sqliteD1";

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(),
}));

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { POST } from "@/app/api/sync/route";
import { recomputeAllAggregates } from "@/lib/db";

// Automatic sync must recompute aggregates a previous run failed to write: it resumes
// fetching from the latest stored price, so the failed run's prices are never fetched
// again. Tallinn is UTC+2 here (after the 2025-10-26 fall-back).

const ts = (iso: string) => Math.floor(Date.parse(iso) / 1000);

let d1: D1Database;
let sqlite: DatabaseSync;

beforeEach(() => {
  ({ d1, sqlite } = createSqliteD1());
  vi.mocked(getCloudflareContext).mockResolvedValue({ env: { DB: d1 }, cf: {}, ctx: {} } as never);
});

afterEach(() => vi.unstubAllGlobals());

/** One price per hour in [a, b), 10 ¢/kWh. */
function seedPrices(a: string, b: string) {
  const ins = sqlite.prepare("INSERT INTO prices (timestamp, price_eur_mwh, price_cents_kwh) VALUES (?, 100, 10)");
  for (let t = ts(a); t < ts(b); t += 3600) ins.run(t);
}

/** Elering returns one price per hour in [a, b) (or nothing). */
function stubElering(a?: string, b?: string) {
  const ee: { timestamp: number; price: number }[] = [];
  if (a && b) for (let t = ts(a); t < ts(b); t += 3600) ee.push({ timestamp: t, price: 100 });
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ success: true, data: { ee } }) })));
}

const autoSync = () => POST(new Request("http://localhost/api/sync", { method: "POST" }) as never);
const q = (sql: string) => sqlite.prepare(sql).get();

describe("POST /api/sync (automatic) — catch-up after a failed aggregate write", () => {
  beforeEach(async () => {
    // Last good run: prices and aggregates through Tallinn 2025-10-30
    seedPrices("2025-09-15T00:00:00Z", "2025-10-30T22:00:00Z");
    await recomputeAllAggregates(d1, ts("2025-10-30T00:00:00Z"), ts("2025-10-30T22:00:00Z"));
    // Failed run: Tallinn 2025-10-31 prices stored, aggregate write failed
    seedPrices("2025-10-30T22:00:00Z", "2025-10-31T22:00:00Z");
  });

  it("recomputes the previous month when the next run only fetches the new month", async () => {
    stubElering("2025-10-31T22:00:00Z", "2025-11-01T22:00:00Z"); // Tallinn 2025-11-01
    const res = await autoSync();
    expect(res.status).toBe(200);
    expect(q("SELECT data_points FROM daily_averages WHERE date = '2025-10-31'")).toEqual({ data_points: 24 });
    expect(q("SELECT data_points FROM monthly_averages WHERE year = 2025 AND month = 10")).toEqual({ data_points: 745 });
    expect(q("SELECT data_points FROM monthly_averages WHERE year = 2025 AND month = 11")).toEqual({ data_points: 24 });
  });

  it("also catches up during a manual sync of a later range", async () => {
    stubElering("2025-10-31T22:00:00Z", "2025-11-01T22:00:00Z");
    const res = await POST(new Request(
      "http://localhost/api/sync?start=2025-10-31T22:00:00Z&end=2025-11-01T22:00:00Z",
      { method: "POST" }
    ) as never);
    expect(res.status).toBe(200);
    expect(q("SELECT data_points FROM monthly_averages WHERE year = 2025 AND month = 10")).toEqual({ data_points: 745 });
  });

  it("catches up separately when a manual sync covers an older, unrelated range", async () => {
    stubElering("2025-09-15T00:00:00Z", "2025-09-16T00:00:00Z");
    const res = await POST(new Request(
      "http://localhost/api/sync?start=2025-09-15T00:00:00Z&end=2025-09-16T00:00:00Z",
      { method: "POST" }
    ) as never);
    expect(res.status).toBe(200);
    expect(q("SELECT data_points FROM monthly_averages WHERE year = 2025 AND month = 10")).toEqual({ data_points: 745 });
    // The gap between the two ranges is not recomputed (August is untouched)
    expect(q("SELECT COUNT(*) AS n FROM monthly_averages WHERE month = 8")).toEqual({ n: 0 });
  });

  it("recomputes even when Elering has no new prices", async () => {
    stubElering();
    const res = await autoSync();
    expect(res.status).toBe(200);
    expect(q("SELECT data_points FROM daily_averages WHERE date = '2025-10-31'")).toEqual({ data_points: 24 });
    expect(q("SELECT data_points FROM monthly_averages WHERE year = 2025 AND month = 10")).toEqual({ data_points: 745 });
  });
});

describe("POST /api/sync (automatic) — partial last day at a month boundary", () => {
  // Elering's day runs to 00:00 CET, so after every good run the latest Tallinn day
  // holds only 00:00–00:59. Last good run: data through Tallinn 2025-10-31 00:59.
  beforeEach(async () => {
    seedPrices("2025-09-15T00:00:00Z", "2025-10-30T23:00:00Z");
    await recomputeAllAggregates(d1, ts("2025-10-30T00:00:00Z"), ts("2025-10-30T23:00:00Z"));
    // Failed run: rest of Tallinn 10-31 and all of 11-01 up to 00:59 on 11-02 stored
    seedPrices("2025-10-30T23:00:00Z", "2025-11-01T23:00:00Z");
  });

  it("recomputes the watermark day itself, so the previous month ends up whole", async () => {
    stubElering("2025-11-01T23:00:00Z", "2025-11-02T23:00:00Z");
    expect((await autoSync()).status).toBe(200);
    expect(q("SELECT data_points FROM daily_averages WHERE date = '2025-10-31'")).toEqual({ data_points: 24 });
    expect(q("SELECT data_points FROM monthly_averages WHERE year = 2025 AND month = 10")).toEqual({ data_points: 745 });
    expect(q("SELECT SUM(sample_count) AS n FROM weekday_hour_averages WHERE year = 2025 AND month = 10")).toEqual({ n: 745 });
  });
});

describe("POST /api/sync (automatic) — nothing to catch up", () => {
  it("does not recompute when aggregates are current and there are no new prices", async () => {
    seedPrices("2025-10-01T00:00:00Z", "2025-10-30T22:00:00Z");
    await recomputeAllAggregates(d1, ts("2025-10-01T00:00:00Z"), ts("2025-10-30T22:00:00Z"));
    stubElering();
    const batch = vi.spyOn(d1, "batch");
    const res = await autoSync();
    expect(((await res.json()) as { data: { synced: number } }).data.synced).toBe(0);
    expect(batch).not.toHaveBeenCalled();
  });
});

describe("POST /api/sync (automatic) — Free-plan fetch window", () => {
  it("fetches at most 31 days per run and resumes on the next run", async () => {
    // e.g. the first cron after backfilling only January on a fresh database
    seedPrices("2025-01-01T00:00:00Z", "2025-01-31T22:00:00Z");
    stubElering();
    await autoSync();
    const urls = vi.mocked(fetch).mock.calls.map(([url]) => new URL(String(url)));
    const startMs = Date.parse(urls[0].searchParams.get("start")!);
    const endMs = Math.max(...urls.map((u) => Date.parse(u.searchParams.get("end")!)));
    expect(startMs).toBe(Date.parse("2025-01-31T21:00:00Z"));
    // fetchFromElering sends the final end as …999Z (inclusive), hence the extra second
    expect(endMs - startMs).toBeLessThan((31 * 24 + 1) * 3600 * 1000 + 1000);
  });
});
