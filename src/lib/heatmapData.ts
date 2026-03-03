/**
 * Heatmap data utilities.
 *
 * Transforms price arrays into grid structures suitable for
 * calendar (day × hour) and pattern (weekday × hour) heatmaps.
 */

import { ElectricityPrice, applyVat } from "@/lib/api";

export interface HeatmapCell {
  hour: number;
  price: number | null;
  count: number; // number of data points averaged
}

export interface HeatmapRow {
  label: string;
  /** Sort key for ordering rows */
  sortKey: number;
  cells: HeatmapCell[];
}

export interface HeatmapData {
  rows: HeatmapRow[];
  minPrice: number;
  maxPrice: number;
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
 */
export function buildCalendarHeatmap(
  prices: ElectricityPrice[],
  includeVat: boolean
): HeatmapData {
  if (prices.length === 0) {
    return { rows: [], minPrice: 0, maxPrice: 0 };
  }

  // Group prices by date string (in local timezone)
  const dayMap = new Map<
    string,
    { date: Date; hours: Map<number, { sum: number; count: number }> }
  >();

  for (const p of prices) {
    if (p.isPredicted) continue; // skip predicted data

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
      day.hours.set(hour, { sum: 0, count: 0 });
    }
    const bucket = day.hours.get(hour)!;
    bucket.sum += price;
    bucket.count += 1;
  }

  let minPrice = Infinity;
  let maxPrice = -Infinity;

  const rows: HeatmapRow[] = [];

  for (const [dateStr, day] of dayMap) {
    const cells: HeatmapCell[] = [];
    for (let h = 0; h < 24; h++) {
      const bucket = day.hours.get(h);
      if (bucket && bucket.count > 0) {
        const avg = bucket.sum / bucket.count;
        cells.push({ hour: h, price: avg, count: bucket.count });
        if (avg < minPrice) minPrice = avg;
        if (avg > maxPrice) maxPrice = avg;
      } else {
        cells.push({ hour: h, price: null, count: 0 });
      }
    }

    // Format label as "Mon 3 Mar"
    const d = new Date(dateStr + "T12:00:00"); // noon to avoid timezone shifts
    const label = d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });

    rows.push({
      label,
      sortKey: new Date(dateStr).getTime(),
      cells,
    });
  }

  // Sort oldest first
  rows.sort((a, b) => a.sortKey - b.sortKey);

  if (minPrice === Infinity) minPrice = 0;
  if (maxPrice === -Infinity) maxPrice = 0;

  return { rows, minPrice, maxPrice };
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
    return { rows: [], minPrice: 0, maxPrice: 0 };
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
    const jsDow = parseInt(
      local.toLocaleString("en-US", {
        timeZone: "Europe/Tallinn",
        weekday: "narrow",
      }),
      10
    );
    // Actually we can't parseInt a weekday name. Let's use getDay() approach
    // Use a reliable approach: get the date string, parse it, get JS day
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
        cells.push({ hour: h, price: avg, count: bucket.count });
        if (avg < minPrice) minPrice = avg;
        if (avg > maxPrice) maxPrice = avg;
      } else {
        cells.push({ hour: h, price: null, count: 0 });
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

  return { rows, minPrice, maxPrice };
}

/**
 * Map a price to a CSS color string (green → yellow → red).
 * Returns an rgba string for smooth interpolation.
 */
export function priceToColor(
  price: number | null,
  min: number,
  max: number
): string {
  if (price === null) return "rgba(39, 39, 42, 0.5)"; // zinc-800/50

  const range = max - min;
  if (range === 0) return "rgba(34, 197, 94, 0.6)"; // all same → green

  const t = Math.max(0, Math.min(1, (price - min) / range)); // 0..1

  // Green (120°) → Yellow (60°) → Red (0°)
  const hue = (1 - t) * 120;
  const saturation = 70 + t * 10; // 70–80%
  const lightness = 40 + (1 - Math.abs(t - 0.5) * 2) * 10; // brighter in middle

  return `hsla(${hue}, ${saturation}%, ${lightness}%, 0.7)`;
}
