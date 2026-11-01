/**
 * Buckets UTC hourly averages into Europe/Tallinn calendar aggregates (daily,
 * weekly, monthly, weekday-hour) for the D1 aggregate tables.
 *
 * SQLite has no timezone support, so bucketing happens here with the DST-safe Intl
 * helpers in @/lib/timezone. prices and hourly_averages hold UTC timestamps; the
 * aggregate tables are keyed by Tallinn calendar values.
 * Higher-level aggregates are built from hourly averages so every hour has equal
 * weight regardless of raw data granularity (15-min vs 1-hour).
 */
import { addDaysToDateStr, getTallinnDateStr, getTallinnOffsetMs, tallinnWallTimeToUtc } from "@/lib/timezone";

export interface HourlyAverageRow {
  timestamp: number; // Unix seconds, UTC hour boundary
  avg_price: number;
  min_price: number;
  max_price: number;
}

export interface PriceAggregate {
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  dataPoints: number;
}

export interface TallinnAggregates {
  daily: (PriceAggregate & { date: string })[];
  weekly: (PriceAggregate & { year: number; week: number })[];
  monthly: (PriceAggregate & { year: number; month: number })[];
  weekdayHour: { year: number; month: number; weekday: number; hour: number; avgPrice: number; sampleCount: number }[];
}

export interface TallinnAggregateRange {
  /** Window start (Unix seconds, inclusive): Monday 00:00 Tallinn on/before the first month's 1st. */
  readStart: number;
  /** Window end (Unix seconds, exclusive): Monday 00:00 Tallinn on/after the 1st after the last month. */
  readEnd: number;
  /**
   * 'YYYY-MM' Tallinn calendar months the synced range spans; only these get monthly and
   * weekday-hour rows (data may still be partial for the current month).
   */
  months: ReadonlySet<string>;
}

const toUnix = (d: Date) => Math.floor(d.getTime() / 1000);

/** 0=Monday … 6=Sunday (not ISO 1–7) for a 'YYYY-MM-DD' calendar date. */
function isoWeekday(dateStr: string): number {
  return (new Date(dateStr + "T00:00:00Z").getUTCDay() + 6) % 7;
}

/**
 * Week of year with Monday as the first day of the week (00–53), identical to
 * SQLite strftime('%W'): days before the year's first Monday are week 0.
 * Keeps the keys already stored in weekly_averages stable.
 */
export function mondayWeekOfYear(year: number, month: number, day: number): number {
  const yday = (Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / 86_400_000;
  const weekday = (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
  return Math.floor((yday + 7 - weekday) / 7);
}

/**
 * Expands a synced range [startTs, endTs) to whole Tallinn months, then to the
 * whole Monday-weeks around them, so every rewritten day, week or month is
 * recomputed from its full window.
 */
export function getTallinnAggregateRange(startTs: number, endTs: number): TallinnAggregateRange {
  const firstDay = getTallinnDateStr(new Date(startTs * 1000));
  const lastDay = getTallinnDateStr(new Date((endTs - 1) * 1000)); // end is exclusive

  const monthStart = firstDay.slice(0, 8) + "01";
  const [ly, lm] = lastDay.split("-").map(Number);
  const monthEnd = new Date(Date.UTC(ly, lm, 1)).toISOString().slice(0, 10); // 1st of next month

  const months = new Set<string>();
  for (let m = monthStart; m < monthEnd; ) {
    months.add(m.slice(0, 7));
    const [y, mo] = m.split("-").map(Number);
    m = new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 10);
  }

  const weekStart = addDaysToDateStr(monthStart, -isoWeekday(monthStart));
  const weekEnd = addDaysToDateStr(monthEnd, (7 - isoWeekday(monthEnd)) % 7);

  return {
    readStart: toUnix(tallinnWallTimeToUtc(weekStart, 0, 0)),
    readEnd: toUnix(tallinnWallTimeToUtc(weekEnd, 0, 0)),
    months,
  };
}

interface Acc {
  sum: number;
  min: number;
  max: number;
  count: number;
}

function add(map: Map<string, Acc>, key: string, row: HourlyAverageRow) {
  const acc = map.get(key);
  if (acc) {
    acc.sum += row.avg_price;
    acc.min = Math.min(acc.min, row.min_price);
    acc.max = Math.max(acc.max, row.max_price);
    acc.count += 1;
  } else {
    map.set(key, { sum: row.avg_price, min: row.min_price, max: row.max_price, count: 1 });
  }
}

const toAggregate = (a: Acc): PriceAggregate => ({
  avgPrice: a.sum / a.count,
  minPrice: a.min,
  maxPrice: a.max,
  dataPoints: a.count,
});

/**
 * Groups hourly rows of `range` by Tallinn day, week, month and weekday-hour. Rows
 * outside [readStart, readEnd) are ignored. Monthly and weekday-hour groups are
 * emitted only for `range.months`; daily and weekly groups are complete because the
 * window is whole weeks (a week spanning Dec/Jan yields two %W rows, one per year).
 */
export function bucketTallinnAggregates(
  rows: HourlyAverageRow[],
  range: TallinnAggregateRange
): TallinnAggregates {
  const { readStart, readEnd, months } = range;
  const daily = new Map<string, Acc>();
  const weekly = new Map<string, Acc>();
  const monthly = new Map<string, Acc>();
  const weekdayHour = new Map<string, Acc>();

  // Intl lookups are costly on Workers' CPU budget. Tallinn's offset changes at most
  // once per UTC day, so cache it per day; days with a transition fall back to a
  // per-hour lookup.
  const dayOffset = new Map<number, number | null>();
  const offsetAt = (unix: number): number => {
    const day = Math.floor(unix / 86_400);
    let cached = dayOffset.get(day);
    if (cached === undefined) {
      const first = getTallinnOffsetMs(new Date(day * 86_400_000));
      const last = getTallinnOffsetMs(new Date((day + 1) * 86_400_000 - 1000));
      cached = first === last ? first : null;
      dayOffset.set(day, cached);
    }
    return cached ?? getTallinnOffsetMs(new Date(unix * 1000));
  };

  for (const row of rows) {
    if (row.timestamp < readStart || row.timestamp >= readEnd) continue;
    // Shift by the Tallinn offset at this instant, then read wall-clock fields via UTC getters
    const wall = new Date(row.timestamp * 1000 + offsetAt(row.timestamp));
    const year = wall.getUTCFullYear();
    const month = wall.getUTCMonth() + 1;
    const day = wall.getUTCDate();
    const date = wall.toISOString().slice(0, 10);

    add(daily, date, row);
    add(weekly, `${year}|${mondayWeekOfYear(year, month, day)}`, row);
    if (months.has(date.slice(0, 7))) {
      add(monthly, `${year}|${month}`, row);
      // weekday_hour_averages.weekday is 0=Monday … 6=Sunday (see isoWeekday)
      add(weekdayHour, `${year}|${month}|${isoWeekday(date)}|${wall.getUTCHours()}`, row);
    }
  }

  const nums = (key: string) => key.split("|").map(Number);
  return {
    daily: [...daily].map(([date, a]) => ({ date, ...toAggregate(a) })),
    weekly: [...weekly].map(([k, a]) => {
      const [year, week] = nums(k);
      return { year, week, ...toAggregate(a) };
    }),
    monthly: [...monthly].map(([k, a]) => {
      const [year, month] = nums(k);
      return { year, month, ...toAggregate(a) };
    }),
    weekdayHour: [...weekdayHour].map(([k, a]) => {
      const [year, month, weekday, hour] = nums(k);
      return { year, month, weekday, hour, avgPrice: a.sum / a.count, sampleCount: a.count };
    }),
  };
}
