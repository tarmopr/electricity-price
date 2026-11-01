// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
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

describe("db/migrations", () => {
  const migration = (file: string) => readFileSync(resolve(__dirname, "../../../db/migrations", file), "utf8");

  it("0001 drops the old duplicate indexes and can run twice", () => {
    const { sqlite: db } = createSqliteD1();
    db.exec(`CREATE INDEX idx_prices_timestamp ON prices(timestamp);
      CREATE INDEX idx_hourly_timestamp ON hourly_averages(timestamp);
      CREATE INDEX idx_daily_date ON daily_averages(date);
      CREATE INDEX idx_weekday_hour_period ON weekday_hour_averages(year, month);`);
    db.exec(migration("0001_drop_duplicate_indexes.sql"));
    db.exec(migration("0001_drop_duplicate_indexes.sql"));
    expect(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'").get())
      .toEqual({ n: 0 });
  });

  it("0002 removes %W weekly rows that no ISO week would overwrite", () => {
    const { sqlite: db } = createSqliteD1();
    // (2025, 0) and (2024, 53) are %W keys with no ISO equivalent
    db.exec(`INSERT INTO weekly_averages VALUES (2025, 0, 1, 1, 1, 48), (2024, 53, 1, 1, 1, 24), (2025, 40, 1, 1, 1, 168);
      INSERT INTO daily_averages VALUES ('2025-01-01', 1, 1, 1, 24);`);
    db.exec(migration("0002_reset_weekly_averages.sql"));
    expect(db.prepare("SELECT COUNT(*) AS n FROM weekly_averages").get()).toEqual({ n: 0 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM daily_averages").get()).toEqual({ n: 1 });
  });
});
