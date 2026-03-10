/**
 * Cheapest window utilities.
 *
 * Finds the cheapest consecutive time window of a given duration
 * within a set of hourly price data, optionally limited by an
 * "until" hour constraint.
 */

export interface CheapestWindow {
  /** ISO timestamp of the first hour in the window */
  startTimestamp: string;
  /** ISO timestamp of the hour after the last (for ReferenceArea end) */
  endTimestamp: string;
  /** Hour of day (0-23) the window starts */
  startHour: number;
  /** Duration of the window in hours */
  hours: number;
  /** Average price (cents/kWh) across the window */
  averagePrice: number;
  /** Start index in the source price array */
  startIndex: number;
  /** End index in the source price array (inclusive) */
  endIndex: number;
}

interface PricePoint {
  timestamp: string;
  displayPrice: number;
}

/**
 * Find the cheapest consecutive window of `hours` length within the price data.
 *
 * @param prices - Array of price points with timestamp and displayPrice
 * @param hours - Number of consecutive hours in the window
 * @param untilHour - Hour limit (0-23). The window must end by this hour.
 *   If null, no time limit is applied (scan to end of data).
 * @param scanFrom - Start scanning from this time. For "today" this is the
 *   current hour; for "tomorrow" this is the start of tomorrow (00:00).
 * @returns The cheapest window, or null if no valid window exists
 */
export function findCheapestWindow(
  prices: PricePoint[],
  hours: number,
  untilHour: number | null,
  scanFrom: Date
): CheapestWindow | null {
  if (prices.length === 0 || hours <= 0) return null;

  const scanFromMs = scanFrom.getTime();

  // Find the first data point at or after scanFrom
  const startIndex = prices.findIndex(
    (item) => new Date(item.timestamp).getTime() >= scanFromMs
  );

  if (startIndex === -1) {
    // All data is before scanFrom — nothing to analyze
    return null;
  }

  const windowSize = Math.min(hours, prices.length - startIndex);
  if (windowSize <= 0 || windowSize < hours) {
    // Not enough data points for the requested window
    return null;
  }

  // Compute the absolute end limit timestamp from untilHour
  let endLimitMs: number | null = null;
  if (untilHour !== null) {
    // For each candidate window, we compute the limit relative to
    // the window's first item. But as an optimization we can compute
    // a base limit from the first analyzed item.
    const baseTime = new Date(prices[startIndex].timestamp);
    const limitDate = new Date(baseTime);
    limitDate.setHours(untilHour, 0, 0, 0);

    // If the limit time is at or before the scan start, roll to next day
    if (limitDate.getTime() <= baseTime.getTime()) {
      limitDate.setDate(limitDate.getDate() + 1);
    }

    endLimitMs = limitDate.getTime();
  }

  let minSum = Infinity;
  let minIndex = -1;

  for (let i = startIndex; i <= prices.length - hours; i++) {
    // Check the end time of this window against the until limit
    const lastItem = prices[i + hours - 1];
    const windowEndMs =
      new Date(lastItem.timestamp).getTime() + 60 * 60 * 1000; // +1 hour (end of last bucket)

    if (endLimitMs !== null && windowEndMs > endLimitMs) {
      // This window finishes after the until limit — skip it and all subsequent
      break;
    }

    let sum = 0;
    for (let j = 0; j < hours; j++) {
      sum += prices[i + j].displayPrice;
    }

    if (sum < minSum) {
      minSum = sum;
      minIndex = i;
    }
  }

  if (minIndex === -1) return null;

  const endIndex = minIndex + hours - 1;

  // Determine endTimestamp: if there's a next data point, use its timestamp;
  // otherwise, add 1 hour to the last item's timestamp.
  const endTimestamp =
    endIndex + 1 < prices.length
      ? prices[endIndex + 1].timestamp
      : new Date(
          new Date(prices[endIndex].timestamp).getTime() + 60 * 60 * 1000
        ).toISOString();

  const startDate = new Date(prices[minIndex].timestamp);

  return {
    startTimestamp: prices[minIndex].timestamp,
    endTimestamp,
    startHour: startDate.getHours(),
    hours,
    averagePrice: minSum / hours,
    startIndex: minIndex,
    endIndex,
  };
}

/**
 * Compute the average price over a time window starting from a given point.
 *
 * Works with any data granularity (15-min, hourly, etc.) — averages all data
 * points whose timestamps fall within [scanFrom, scanFrom + durationHours).
 *
 * @param prices - Array of price points with timestamp and displayPrice
 * @param durationHours - Length of the window in hours
 * @param scanFrom - Start of the window (typically "now" rounded to the hour)
 * @returns Average displayPrice of points in the window, or null if none found
 */
export function computeWindowAverage(
  prices: PricePoint[],
  durationHours: number,
  scanFrom: Date
): number | null {
  if (prices.length === 0 || durationHours <= 0) return null;

  const startMs = scanFrom.getTime();
  const endMs = startMs + durationHours * 60 * 60 * 1000;

  let sum = 0;
  let count = 0;

  for (const p of prices) {
    const t = new Date(p.timestamp).getTime();
    if (t >= endMs) break;
    if (t >= startMs) {
      sum += p.displayPrice;
      count++;
    }
  }

  return count > 0 ? sum / count : null;
}

/**
 * Get the set of "YYYY-MM-DD:HH" keys covered by a cheapest window.
 * Uses Europe/Tallinn timezone for consistency with heatmap cells.
 *
 * Generates keys directly from the window's startTimestamp and hours count,
 * so it does not depend on the source price array or its indices.
 *
 * @param window - The cheapest window to extract hours from
 * @returns Set of "YYYY-MM-DD:HH" keys, or empty set if window is null
 */
export function getCheapestWindowHours(
  window: CheapestWindow | null
): Set<string> {
  const keys = new Set<string>();
  if (!window) return keys;

  const startMs = new Date(window.startTimestamp).getTime();

  for (let i = 0; i < window.hours; i++) {
    const date = new Date(startMs + i * 60 * 60 * 1000);
    const dateStr = date.toLocaleDateString("en-CA", {
      timeZone: "Europe/Tallinn",
    }); // YYYY-MM-DD
    const hour = parseInt(
      date.toLocaleString("en-US", {
        timeZone: "Europe/Tallinn",
        hour: "2-digit",
        hourCycle: "h23",
      }),
      10
    );

    keys.add(`${dateStr}:${hour}`);
  }

  return keys;
}
