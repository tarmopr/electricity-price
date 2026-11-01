// @vitest-environment node
import { describe, it, expect } from "vitest";
import { createSqliteD1 } from "@/__tests__/helpers/sqliteD1";

// D1 counts every index update as an extra row written (Workers Free: 100k rows
// written per day), so the schema must not carry indexes that duplicate a primary key.

const { sqlite } = createSqliteD1();
const plan = (sql: string) =>
  sqlite
    .prepare(`EXPLAIN QUERY PLAN ${sql}`)
    .all(...Array.from(sql.matchAll(/\?/g), () => 1))
    .map((r) => String(r.detail))
    .join(" | ");

describe("db/schema.sql", () => {
  it("has no explicit indexes (every table is served by its primary key)", () => {
    expect(sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_autoindex%'").all())
      .toEqual([]);
  });

  // Queries from src/app/api and src/lib/db.ts
  it.each([
    "SELECT * FROM prices WHERE timestamp <= ? ORDER BY timestamp DESC LIMIT 1",
    "SELECT (timestamp / 3600) * 3600 AS h, AVG(price_cents_kwh) FROM prices WHERE timestamp >= ? AND timestamp < ? GROUP BY h",
    "SELECT MAX(timestamp) FROM prices",
    "SELECT * FROM hourly_averages WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC",
    "SELECT * FROM daily_averages WHERE date >= ? AND date <= ? ORDER BY date ASC",
    "SELECT MAX(date) FROM daily_averages",
    "SELECT * FROM weekly_averages WHERE year = ? ORDER BY week ASC",
    "SELECT * FROM monthly_averages WHERE year = ? ORDER BY month ASC",
    "SELECT * FROM weekday_hour_averages WHERE year = ? AND month = ? ORDER BY weekday ASC, hour ASC",
    "SELECT * FROM weekday_hour_averages WHERE year = ? ORDER BY month ASC, weekday ASC, hour ASC",
  ])("%s seeks by primary key without a full scan or sort", (sql) => {
    const detail = plan(sql);
    expect(detail).not.toMatch(/^SCAN|\| SCAN|TEMP B-TREE FOR ORDER BY/);
  });
});
