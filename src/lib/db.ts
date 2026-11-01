import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eurMwhToCentsKwh } from "@/lib/price";
import {
  bucketTallinnAggregates,
  getTallinnAggregateRange,
  type HourlyAverageRow,
} from "@/lib/tallinnAggregates";

export async function getDB(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  return (env as { DB: D1Database }).DB;
}

/**
 * Upsert raw 15-minute prices into the prices table.
 */
export async function upsertPrices(
  db: D1Database,
  prices: { timestamp: number; priceEurMwh: number }[]
): Promise<void> {
  if (prices.length === 0) return;

  const stmt = db.prepare(
    `INSERT OR REPLACE INTO prices (timestamp, price_eur_mwh, price_cents_kwh)
     VALUES (?, ?, ?)`
  );

  // D1 has no per-batch statement cap, but each batch counts as one query and
  // Workers Free allows 50 D1 queries per invocation. 1,000 slots per batch keeps a
  // 31-day manual sync (2,976 slots) at 3 queries while bounding each batch's
  // duration (D1 limits a batch to 30 s).
  const BATCH_SIZE = 1000;
  for (let i = 0; i < prices.length; i += BATCH_SIZE) {
    const batch = prices.slice(i, i + BATCH_SIZE);
    await db.batch(
      batch.map((p) =>
        stmt.bind(p.timestamp, p.priceEurMwh, eurMwhToCentsKwh(p.priceEurMwh))
      )
    );
  }
}

/**
 * Recompute hourly averages for a given time range.
 * Groups 15-min prices by hour boundary and inserts/replaces hourly averages.
 */
export async function recomputeHourlyAverages(
  db: D1Database,
  startTimestamp: number,
  endTimestamp: number
): Promise<void> {
  // Round start down to hour boundary and end up to hour boundary
  const hourStart = Math.floor(startTimestamp / 3600) * 3600;
  const hourEnd = Math.ceil(endTimestamp / 3600) * 3600;

  await db
    .prepare(
      `INSERT OR REPLACE INTO hourly_averages (timestamp, avg_price, min_price, max_price, data_points)
       SELECT
         (timestamp / 3600) * 3600 as hour_ts,
         AVG(price_cents_kwh) as avg_price,
         MIN(price_cents_kwh) as min_price,
         MAX(price_cents_kwh) as max_price,
         COUNT(*) as data_points
       FROM prices
       WHERE timestamp >= ? AND timestamp < ?
       GROUP BY hour_ts`
    )
    .bind(hourStart, hourEnd)
    .run();
}

/**
 * Run all aggregate recomputations for a synced time range.
 *
 * Hourly averages are computed from raw prices (normalizes mixed 15-min/1-hour data).
 * All higher-level aggregates (daily, weekly, monthly, weekday-hour) are computed
 * from hourly_averages to ensure each hour is weighted equally regardless of
 * the raw data granularity.
 */
export async function recomputeAllAggregates(
  db: D1Database,
  startTimestamp: number,
  endTimestamp: number
): Promise<CalendarAggregateCounts> {
  const { readStart, readEnd } = getTallinnAggregateRange(startTimestamp, endTimestamp);

  // 1. Hourly averages from raw prices for the whole window
  await recomputeHourlyAverages(db, readStart, readEnd);

  // 2. Higher-level aggregates from hourly_averages (equal hour weighting)
  return recomputeCalendarAggregates(db, startTimestamp, endTimestamp);
}

/** Rows written per calendar table by recomputeCalendarAggregates. */
export interface CalendarAggregateCounts {
  daily: number;
  weekly: number;
  monthly: number;
  weekdayHour: number;
}

/**
 * Rewrites daily, weekly, monthly and weekday-hour aggregates for a time range from
 * the hourly_averages already stored; raw prices and hourly_averages are not touched.
 *
 * Calendar bucketing uses Europe/Tallinn dates (DST-aware) and happens in
 * application code (see tallinnAggregates.ts) because SQLite has no timezone
 * support. The range is expanded to whole Tallinn months and the whole weeks
 * around them, so every rewritten day, week or month is recomputed from its full
 * window rather than a slice of it.
 */
export async function recomputeCalendarAggregates(
  db: D1Database,
  startTimestamp: number,
  endTimestamp: number
): Promise<CalendarAggregateCounts> {
  const range = getTallinnAggregateRange(startTimestamp, endTimestamp);
  const { readStart, readEnd } = range;

  const { results } = await db
    .prepare(
      `SELECT timestamp, avg_price, min_price, max_price
       FROM hourly_averages
       WHERE timestamp >= ? AND timestamp < ?
       ORDER BY timestamp`
    )
    .bind(readStart, readEnd)
    .all<HourlyAverageRow>();

  const agg = bucketTallinnAggregates(results, range);

  const dailyStmt = db.prepare(
    `INSERT OR REPLACE INTO daily_averages (date, avg_price, min_price, max_price, data_points)
     VALUES (?, ?, ?, ?, ?)`
  );
  const weeklyStmt = db.prepare(
    `INSERT OR REPLACE INTO weekly_averages (year, week, avg_price, min_price, max_price, data_points)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const monthlyStmt = db.prepare(
    `INSERT OR REPLACE INTO monthly_averages (year, month, avg_price, min_price, max_price, data_points)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const weekdayHourStmt = db.prepare(
    `INSERT OR REPLACE INTO weekday_hour_averages (year, month, weekday, hour, avg_price, sample_count)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const statements = [
    ...agg.daily.map((r) =>
      dailyStmt.bind(r.date, r.avgPrice, r.minPrice, r.maxPrice, r.dataPoints)
    ),
    ...agg.weekly.map((r) =>
      weeklyStmt.bind(r.year, r.week, r.avgPrice, r.minPrice, r.maxPrice, r.dataPoints)
    ),
    ...agg.monthly.map((r) =>
      monthlyStmt.bind(r.year, r.month, r.avgPrice, r.minPrice, r.maxPrice, r.dataPoints)
    ),
    ...agg.weekdayHour.map((r) =>
      weekdayHourStmt.bind(r.year, r.month, r.weekday, r.hour, r.avgPrice, r.sampleCount)
    ),
  ];

  // One batch = one transaction: if any write fails, daily/weekly/monthly/weekday-hour
  // stay as they were (hourly_averages, if recomputeAllAggregates rewrote it, is already
  // committed; a rerun recomputes everything). Don't split this into several batches: each would commit on its own
  // and a failure part-way would leave the tables inconsistent with each other.
  // D1 has no per-batch statement cap (the 30 s limit covers the whole batch) and a
  // batch counts as a single query toward the per-invocation limit.
  if (statements.length > 0) {
    await db.batch(statements);
  }

  return {
    daily: agg.daily.length,
    weekly: agg.weekly.length,
    monthly: agg.monthly.length,
    weekdayHour: agg.weekdayHour.length,
  };
}
