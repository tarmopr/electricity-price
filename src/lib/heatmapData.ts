/**
 * Heatmap data utilities.
 *
 * Transforms price arrays into grid structures suitable for
 * calendar (day × hour) and pattern (weekday × hour) heatmaps.
 */

import { ElectricityPrice } from "@/lib/api";
import { applyVat } from "@/lib/price";
import { Period } from "@/lib/types";
import {
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  format,
  addDays,
  eachDayOfInterval,
} from "date-fns";

export interface HeatmapCell {
  hour: number;
  price: number | null;
  count: number; // number of data points averaged
  isPredicted: boolean; // whether data is from predictions
}

export interface HeatmapRow {
  label: string;
  /** Sort key for ordering rows */
  sortKey: number;
  cells: HeatmapCell[];
  /** Date key in 'YYYY-MM-DD' format (calendar mode only) */
  dateKey?: string;
  /** Whether this row is the selected/highlighted day */
  isHighlighted?: boolean;
}

export interface HeatmapData {
  rows: HeatmapRow[];
  minPrice: number;
  maxPrice: number;
  /** Whether any cell in the data contains predicted values */
  hasPredictions: boolean;
}

const WEEKDAY_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/**
 * Build a calendar heatmap: each row is a date, each column is an hour (0–23).
 * Prices are grouped by local date and hour using the Europe/Tallinn timezone.
 *
 * @param highlightedDates - Optional array of 'YYYY-MM-DD' strings to highlight.
 *   If provided, matching rows get `isHighlighted = true` and others get `false`.
 *   If undefined/empty, all rows get `isHighlighted = true` (default behavior).
 */
export function buildCalendarHeatmap(
  prices: ElectricityPrice[],
  includeVat: boolean,
  highlightedDates?: string[]
): HeatmapData {
  if (prices.length === 0) {
    return { rows: [], minPrice: 0, maxPrice: 0, hasPredictions: false };
  }

  // Group prices by date string (in local timezone)
  const dayMap = new Map<
    string,
    {
      date: Date;
      hours: Map<
        number,
        { sum: number; count: number; predictedCount: number }
      >;
    }
  >();

  for (const p of prices) {
    const local = new Date(p.date);
    // Use Intl to get the date in Europe/Tallinn
    const dateStr = local.toLocaleDateString("en-CA", {
      timeZone: "Europe/Tallinn",
    }); // YYYY-MM-DD
    const hour = parseInt(
      local.toLocaleString("en-US", {
        timeZone: "Europe/Tallinn",
        hour: "2-digit",
        hour12: false,
      }),
      10
    );

    if (!dayMap.has(dateStr)) {
      dayMap.set(dateStr, { date: new Date(dateStr), hours: new Map() });
    }

    const day = dayMap.get(dateStr)!;
    const price = includeVat
      ? applyVat(p.priceCentsKwh)
      : p.priceCentsKwh;

    if (!day.hours.has(hour)) {
      day.hours.set(hour, { sum: 0, count: 0, predictedCount: 0 });
    }
    const bucket = day.hours.get(hour)!;
    bucket.sum += price;
    bucket.count += 1;
    if (p.isPredicted) {
      bucket.predictedCount += 1;
    }
  }

  let minPrice = Infinity;
  let maxPrice = -Infinity;
  let hasPredictions = false;

  const rows: HeatmapRow[] = [];
  const hasHighlightSpec =
    highlightedDates !== undefined && highlightedDates.length > 0;

  for (const [dateStr, day] of dayMap) {
    const cells: HeatmapCell[] = [];
    for (let h = 0; h < 24; h++) {
      const bucket = day.hours.get(h);
      if (bucket && bucket.count > 0) {
        const avg = bucket.sum / bucket.count;
        const isPredicted = bucket.predictedCount === bucket.count;
        cells.push({ hour: h, price: avg, count: bucket.count, isPredicted });

        if (isPredicted) {
          hasPredictions = true;
        }

        // Only use non-predicted cells for min/max to anchor color scale to real data
        if (!isPredicted) {
          if (avg < minPrice) minPrice = avg;
          if (avg > maxPrice) maxPrice = avg;
        }
      } else {
        cells.push({ hour: h, price: null, count: 0, isPredicted: false });
      }
    }

    // Format label as "Mon 3 Mar"
    const d = new Date(dateStr + "T12:00:00"); // noon to avoid timezone shifts
    const label = d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });

    const isHighlighted = hasHighlightSpec
      ? highlightedDates.includes(dateStr)
      : true; // default: all highlighted when no spec

    rows.push({
      label,
      sortKey: new Date(dateStr).getTime(),
      cells,
      dateKey: dateStr,
      isHighlighted,
    });
  }

  // If min/max were only from predicted data, fall back to including predicted
  if (minPrice === Infinity || maxPrice === -Infinity) {
    for (const row of rows) {
      for (const cell of row.cells) {
        if (cell.price !== null) {
          if (cell.price < minPrice) minPrice = cell.price;
          if (cell.price > maxPrice) maxPrice = cell.price;
        }
      }
    }
  }

  // Sort oldest first
  rows.sort((a, b) => a.sortKey - b.sortKey);

  if (minPrice === Infinity) minPrice = 0;
  if (maxPrice === -Infinity) maxPrice = 0;

  return { rows, minPrice, maxPrice, hasPredictions };
}

/**
 * Build a pattern heatmap: each row is a weekday (Mon–Sun), each column is an hour.
 * Computes average price per weekday-hour from the given price data.
 */
export function buildPatternHeatmap(
  prices: ElectricityPrice[],
  includeVat: boolean
): HeatmapData {
  if (prices.length === 0) {
    return { rows: [], minPrice: 0, maxPrice: 0, hasPredictions: false };
  }

  // weekday (0=Mon..6=Sun) → hour → { sum, count }
  const grid = new Map<number, Map<number, { sum: number; count: number }>>();

  for (let wd = 0; wd < 7; wd++) {
    grid.set(wd, new Map());
  }

  for (const p of prices) {
    if (p.isPredicted) continue;

    const local = new Date(p.date);
    // Get weekday in Tallinn timezone (0=Sun in JS, convert to 0=Mon)
    const tallinnDate = local.toLocaleDateString("en-CA", {
      timeZone: "Europe/Tallinn",
    });
    const tallinnDay = new Date(tallinnDate + "T12:00:00").getDay(); // 0=Sun
    const isoDow = tallinnDay === 0 ? 6 : tallinnDay - 1; // 0=Mon..6=Sun

    const hour = parseInt(
      local.toLocaleString("en-US", {
        timeZone: "Europe/Tallinn",
        hour: "2-digit",
        hour12: false,
      }),
      10
    );

    const price = includeVat
      ? applyVat(p.priceCentsKwh)
      : p.priceCentsKwh;

    const hourMap = grid.get(isoDow)!;
    if (!hourMap.has(hour)) {
      hourMap.set(hour, { sum: 0, count: 0 });
    }
    const bucket = hourMap.get(hour)!;
    bucket.sum += price;
    bucket.count += 1;
  }

  let minPrice = Infinity;
  let maxPrice = -Infinity;

  const rows: HeatmapRow[] = [];

  for (let wd = 0; wd < 7; wd++) {
    const hourMap = grid.get(wd)!;
    const cells: HeatmapCell[] = [];

    for (let h = 0; h < 24; h++) {
      const bucket = hourMap.get(h);
      if (bucket && bucket.count > 0) {
        const avg = bucket.sum / bucket.count;
        cells.push({
          hour: h,
          price: avg,
          count: bucket.count,
          isPredicted: false,
        });
        if (avg < minPrice) minPrice = avg;
        if (avg > maxPrice) maxPrice = avg;
      } else {
        cells.push({ hour: h, price: null, count: 0, isPredicted: false });
      }
    }

    rows.push({
      label: WEEKDAY_LABELS[wd],
      sortKey: wd,
      cells,
    });
  }

  rows.sort((a, b) => a.sortKey - b.sortKey);

  if (minPrice === Infinity) minPrice = 0;
  if (maxPrice === -Infinity) maxPrice = 0;

  return { rows, minPrice, maxPrice, hasPredictions: false };
}

/**
 * Map a price to a CSS color string (green → yellow → red).
 * Returns an hsla string for smooth interpolation.
 *
 * @param isPredicted - If true, returns a duller/washed-out color to distinguish
 *   predicted values from actual prices.
 */
export function priceToColor(
  price: number | null,
  min: number,
  max: number,
  isPredicted: boolean = false
): string {
  if (price === null) return "rgba(39, 39, 42, 0.5)"; // zinc-800/50

  const range = max - min;
  if (range === 0) {
    return isPredicted
      ? "rgba(34, 197, 94, 0.3)" // green but duller
      : "rgba(34, 197, 94, 0.6)"; // all same → green
  }

  const t = Math.max(0, Math.min(1, (price - min) / range)); // 0..1

  // Green (120°) → Yellow (60°) → Red (0°)
  const hue = (1 - t) * 120;

  if (isPredicted) {
    // Predicted: moderate saturation, higher lightness for a pastel/faded look
    // that is still distinguishable across the price range
    const saturation = 40 + t * 15; // 40–55% (vs 70–80% for real)
    const lightness = 35 + (1 - Math.abs(t - 0.5) * 2) * 10;
    return `hsla(${hue}, ${saturation}%, ${lightness}%, 0.55)`;
  }

  const saturation = 70 + t * 10; // 70–80%
  const lightness = 40 + (1 - Math.abs(t - 0.5) * 2) * 10; // brighter in middle

  return `hsla(${hue}, ${saturation}%, ${lightness}%, 0.7)`;
}

export interface HeatmapWeekRange {
  weekStart: Date;
  weekEnd: Date;
  highlightedDates: string[];
}

/**
 * Determine whether a period should expand to a full week in the heatmap,
 * and if so, return the week boundaries and which dates to highlight.
 *
 * Returns `null` for periods that should use standard behavior.
 */
export function getHeatmapWeekRange(
  period: Period,
  periodStart: Date,
  _periodEnd: Date
): HeatmapWeekRange | null {
  const SINGLE_DAY_TIMEFRAMES: Period[] = [
    "yesterday",
    "today",
    "tomorrow",
  ];

  if (SINGLE_DAY_TIMEFRAMES.includes(period)) {
    // Expand to the full Mon–Sun week containing the selected day
    const weekStart = startOfWeek(periodStart, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(periodStart, { weekStartsOn: 1 });

    // Highlight only the selected date
    const selectedDate = format(periodStart, "yyyy-MM-dd");

    return {
      weekStart: startOfDay(weekStart),
      weekEnd: endOfDay(weekEnd),
      highlightedDates: [selectedDate],
    };
  }

  if (period === "this_week") {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    // Highlight all days from Monday through today
    // (and tomorrow if data is typically available)
    const today = startOfDay(now);
    const tomorrow = addDays(today, 1);

    const allDays = eachDayOfInterval({
      start: weekStart,
      end: tomorrow > weekEnd ? weekEnd : tomorrow,
    });

    const highlightedDates = allDays.map((d) => format(d, "yyyy-MM-dd"));

    return {
      weekStart: startOfDay(weekStart),
      weekEnd: endOfDay(weekEnd),
      highlightedDates,
    };
  }

  return null;
}
