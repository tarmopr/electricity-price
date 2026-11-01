// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { createSqliteD1 } from "@/__tests__/helpers/sqliteD1";

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(),
}));

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { POST } from "@/app/api/sync/recompute/route";

const ts = (iso: string) => Math.floor(Date.parse(iso) / 1000);

let d1: D1Database;
let sqlite: DatabaseSync;

beforeEach(() => {
  ({ d1, sqlite } = createSqliteD1());
  vi.mocked(getCloudflareContext).mockResolvedValue({ env: { DB: d1 }, cf: {}, ctx: {} } as never);
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("must not call Elering"))));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const post = (query: string, headers: Record<string, string> = {}) =>
  POST(new Request(`http://localhost/api/sync/recompute${query}`, { method: "POST", headers }) as never);

/** Hourly averages (as already stored in production) every hour in [a, b). */
function seedHourlyAverages(a: string, b: string, cents = 10) {
  const ins = sqlite.prepare(
    "INSERT INTO hourly_averages (timestamp, avg_price, min_price, max_price, data_points) VALUES (?, ?, ?, ?, 4)"
  );
  for (let t = ts(a); t < ts(b); t += 3600) ins.run(t, cents, cents, cents);
}

describe("POST /api/sync/recompute", () => {
  it.each([[""], ["?month=2025-13"], ["?month=2025-1"], ["?month=abc"]])(
    "returns 400 for a missing or malformed month (%s)",
    async (query) => {
      const res = await post(query);
      expect(res.status).toBe(400);
      expect(((await res.json()) as { error: string }).error).toContain("month");
    }
  );

  it("returns 401 when SYNC_SECRET is set and the bearer token is wrong", async () => {
    vi.stubEnv("SYNC_SECRET", "s3cret");
    expect((await post("?month=2025-10", { Authorization: "Bearer nope" })).status).toBe(401);
    expect((await post("?month=2025-10")).status).toBe(401);
  });

  it("rewrites the month's calendar aggregates from stored hourly averages", async () => {
    vi.stubEnv("SYNC_SECRET", "s3cret");
    seedHourlyAverages("2025-09-15T00:00:00Z", "2025-11-15T00:00:00Z");
    // Rows written by the old fixed '+2 hours' SQL
    sqlite.exec(`INSERT INTO daily_averages VALUES ('2025-10-01', 999, 999, 999, 23);
      INSERT INTO monthly_averages VALUES (2025, 10, 999, 999, 999, 744);`);

    const res = await post("?month=2025-10", { Authorization: "Bearer s3cret" });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: { month: string; rows: Record<string, number> } };
    expect(body.data.month).toBe("2025-10");
    expect(body.data.rows).toEqual({ daily: 35, weekly: 5, monthly: 1, weekdayHour: 168 });
    expect(sqlite.prepare("SELECT avg_price, data_points FROM daily_averages WHERE date = '2025-10-01'").get())
      .toEqual({ avg_price: 10, data_points: 24 });
    expect(sqlite.prepare("SELECT data_points FROM monthly_averages WHERE year = 2025 AND month = 10").get())
      .toEqual({ data_points: 745 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not rewrite raw prices or hourly averages", async () => {
    seedHourlyAverages("2025-10-01T00:00:00Z", "2025-10-02T00:00:00Z", 10);
    // A raw price that disagrees with the stored hourly average: must stay untouched
    sqlite.exec("INSERT INTO prices VALUES (1759280400, 500, 50)"); // 2025-10-01T01:00Z
    await post("?month=2025-10");
    expect(sqlite.prepare("SELECT avg_price FROM hourly_averages WHERE timestamp = 1759280400").get())
      .toEqual({ avg_price: 10 });
  });
});
