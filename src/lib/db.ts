import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eurMwhToCentsKwh } from "@/lib/price";

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

  // D1 batch limit is 100 statements per batch
  const BATCH_SIZE = 100;
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
 * Recompute daily averages for affected dates.
 * Uses hourly_averages as source to ensure equal hour weighting regardless
 * of whether raw data is 15-min or 1-hour granularity.
 */
export async function recomputeDailyAverages(
  db: D1Database,
  startTimestamp: number,
  endTimestamp: number
): Promise<void> {
  await db
    .prepare(
      `INSERT OR REPLACE INTO daily_averages (date, avg_price, min_price, max_price, data_points)
       SELECT
         strftime('%Y-%m-%d', timestamp, 'unixepoch') as date_str,
         AVG(avg_price) as avg_price,
         MIN(min_price) as min_price,
         MAX(max_price) as max_price,
         COUNT(*) as data_points
       FROM hourly_averages
       WHERE timestamp >= ? AND timestamp < ?
       GROUP BY date_str`
    )
    .bind(startTimestamp, endTimestamp)
    .run();
}

/**
 * Recompute weekly averages for affected weeks.
 * Uses hourly_averages as source to ensure equal hour weighting regardless
 * of whether raw data is 15-min or 1-hour granularity.
 */
export async function recomputeWeeklyAverages(
  db: D1Database,
  startTimestamp: number,
  endTimestamp: number
): Promise<void> {
  await db
    .prepare(
      `INSERT OR REPLACE INTO weekly_averages (year, week, avg_price, min_price, max_price, data_points)
       SELECT
         CAST(strftime('%Y', timestamp, 'unixepoch') AS INTEGER) as year,
         CAST(strftime('%W', timestamp, 'unixepoch') AS INTEGER) as week,
         AVG(avg_price) as avg_price,
         MIN(min_price) as min_price,
         MAX(max_price) as max_price,
         COUNT(*) as data_points
       FROM hourly_averages
       WHERE timestamp >= ? AND timestamp < ?
       GROUP BY year, week`
    )
    .bind(startTimestamp, endTimestamp)
    .run();
}

/**
 * Recompute monthly averages for affected months.
 * Uses hourly_averages as source to ensure equal hour weighting regardless
 * of whether raw data is 15-min or 1-hour granularity.
 */
export async function recomputeMonthlyAverages(
  db: D1Database,
  startTimestamp: number,
  endTimestamp: number
): Promise<void> {
  await db
    .prepare(
      `INSERT OR REPLACE INTO monthly_averages (year, month, avg_price, min_price, max_price, data_points)
       SELECT
         CAST(strftime('%Y', timestamp, 'unixepoch') AS INTEGER) as year,
         CAST(strftime('%m', timestamp, 'unixepoch') AS INTEGER) as month,
         AVG(avg_price) as avg_price,
         MIN(min_price) as min_price,
         MAX(max_price) as max_price,
         COUNT(*) as data_points
       FROM hourly_averages
       WHERE timestamp >= ? AND timestamp < ?
       GROUP BY year, month`
    )
    .bind(startTimestamp, endTimestamp)
    .run();
}

/**
 * Recompute weekday-hour averages for affected year+month periods.
 * Uses hourly_averages as source to ensure equal hour weighting regardless
 * of whether raw data is 15-min or 1-hour granularity.
 * Uses strftime('%w') which returns 0=Sunday, so we convert to ISO: 0=Monday.
 */
export async function recomputeWeekdayHourAverages(
  db: D1Database,
  startTimestamp: number,
  endTimestamp: number
): Promise<void> {
  await db
    .prepare(
      `INSERT OR REPLACE INTO weekday_hour_averages (year, month, weekday, hour, avg_price, sample_count)
       SELECT
         CAST(strftime('%Y', timestamp, 'unixepoch') AS INTEGER) as year,
         CAST(strftime('%m', timestamp, 'unixepoch') AS INTEGER) as month,
         -- Convert from SQLite %w (0=Sunday) to ISO (0=Monday)
         CASE CAST(strftime('%w', timestamp, 'unixepoch') AS INTEGER)
           WHEN 0 THEN 6  -- Sunday -> 6
           ELSE CAST(strftime('%w', timestamp, 'unixepoch') AS INTEGER) - 1
         END as weekday,
         CAST(strftime('%H', timestamp, 'unixepoch') AS INTEGER) as hour,
         AVG(avg_price) as avg_price,
         COUNT(*) as sample_count
       FROM hourly_averages
       WHERE timestamp >= ? AND timestamp < ?
       GROUP BY year, month, weekday, hour`
    )
    .bind(startTimestamp, endTimestamp)
    .run();
}

/**
 * Run all aggregate recomputations for a given time range.
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
): Promise<void> {
  // For daily/weekly/monthly/weekday, we need to recompute for the full months
  // that contain the affected range, to get correct aggregates
  const startDate = new Date(startTimestamp * 1000);
  const endDate = new Date(endTimestamp * 1000);

  // Expand range to full months
  const monthStart = new Date(
    Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1)
  );
  const monthEnd = new Date(
    Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth() + 1, 1)
  );

  const expandedStart = Math.floor(monthStart.getTime() / 1000);
  const expandedEnd = Math.floor(monthEnd.getTime() / 1000);

  // 1. Hourly averages from raw prices (expanded range so higher-level aggs have data)
  await recomputeHourlyAverages(db, expandedStart, expandedEnd);
  // 2. All higher-level aggregates from hourly_averages (equal hour weighting)
  await recomputeDailyAverages(db, expandedStart, expandedEnd);
  await recomputeWeeklyAverages(db, expandedStart, expandedEnd);
  await recomputeMonthlyAverages(db, expandedStart, expandedEnd);
  await recomputeWeekdayHourAverages(db, expandedStart, expandedEnd);
}
