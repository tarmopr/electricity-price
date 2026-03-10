export interface ElectricityPrice {
    timestamp: string; // ISO string
    date: Date; // Parsed Date object
    priceEurMwh: number; // Raw price from API
    priceCentsKwh: number; // Converted price
    isPredicted?: boolean; // Flag to indicate if the price is predicted
}

export interface PriceDataResponse {
    success: boolean;
    data: {
        ee: {
            timestamp: number;
            price: number;
        }[];
    };
}

export interface CurrentPriceResponse {
    success: boolean;
    data: {
        timestamp: number;
        price: number;
    }[];
}

import { eurMwhToCentsKwh, applyVat, CHUNK_SIZE_MS } from "@/lib/price";

// Re-export for backwards compatibility with existing consumers
export { applyVat, eurMwhToCentsKwh };

/** @deprecated Use `eurMwhToCentsKwh` from `@/lib/price` instead. */
export const convertEurMwhToCentsKwh = eurMwhToCentsKwh;

// Server-side API routes (proxy to Elering, no CORS issues)
const PRICES_API = '/api/prices';
const CURRENT_PRICE_API = '/api/prices/current';

/**
 * Formats a given date to the API's required ISO string format (UTC)
 */
function formatDateForApi(date: Date, isEnd: boolean = false): string {
    const isoString = date.toISOString();
    if (isEnd) {
        return isoString.replace('.000Z', '.999Z');
    }
    return isoString;
}

/**
 * Fetch prices between a start and end date, automatically chunking requests
 * into 3-month intervals to bypass the API's 1-year max limit.
 */
export async function getPricesForDateRange(start: Date, end: Date): Promise<ElectricityPrice[]> {
    let currentStart = new Date(start);
    let allPrices: ElectricityPrice[] = [];

    try {
        while (currentStart < end) {
            let currentEnd = new Date(currentStart.getTime() + CHUNK_SIZE_MS);
            if (currentEnd > end) {
                currentEnd = end;
            }

            const startStr = formatDateForApi(currentStart, false);
            // Only use .999Z for the absolute final end date of the user's requested range
            const isAbsoluteEnd = currentEnd.getTime() === end.getTime();
            const endStr = formatDateForApi(currentEnd, isAbsoluteEnd);

            const url = `${PRICES_API}?start=${encodeURIComponent(startStr)}&end=${encodeURIComponent(endStr)}`;

            const res = await fetch(url, {
                cache: 'no-store'
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Failed to fetch chunk ${startStr} to ${endStr}: ${res.status} ${res.statusText} - ${errText}`);
            }

            const json: PriceDataResponse = await res.json();

            if (!json.success || !json.data || !json.data.ee) {
                throw new Error('Invalid API response format');
            }

            const chunkPrices = json.data.ee.map(item => {
                const date = new Date(item.timestamp * 1000);
                return {
                    timestamp: date.toISOString(),
                    date,
                    priceEurMwh: item.price,
                    priceCentsKwh: eurMwhToCentsKwh(item.price)
                };
            });

            allPrices = [...allPrices, ...chunkPrices];

            // Advance the start pointer. Add 1 millisecond so we don't overlap boundaries identically
            currentStart = new Date(currentEnd.getTime() + 1);
        }

        // Remove any exact duplicates that might occur on chunk boundaries and sort
        const uniquePrices = Array.from(new Map(allPrices.map(item => [item.timestamp, item])).values());
        return uniquePrices.sort((a, b) => a.date.getTime() - b.date.getTime());

    } catch (error) {
        console.error('Error fetching electricity prices:', error);
        return [];
    }
}

/**
 * Fetch prices between a start and end date, automatically fetching historical context
 * to generate and append predicted prices if the end date is in the future.
 */
export async function getPricesWithPrediction(start: Date, end: Date): Promise<ElectricityPrice[]> {
    const now = new Date();

    // If we are looking into the future, we need at least 8 days of history for the prediction algorithm to work
    let fetchStart = start;
    if (end > now) {
        const historyRequired = new Date(now);
        historyRequired.setDate(historyRequired.getDate() - 8);
        historyRequired.setMinutes(0, 0, 0);

        if (historyRequired < fetchStart) {
            fetchStart = historyRequired;
        }
    }

    const data = await getPricesForDateRange(fetchStart, end);

    // Filter to start returning from the requested start date
    const actualData = data.filter(d => d.date.getTime() >= start.getTime());
    let predictedData: ElectricityPrice[] = [];

    if (end > now && data.length > 0) {
        predictedData = generatePredictedPrices(data, end);
        // Ensure we only return predictions that fall within the requested date range
        predictedData = predictedData.filter(d => d.date.getTime() >= start.getTime());
    }

    return [...actualData, ...predictedData];
}

/**
 * Aggregates a high-resolution array of ElectricityPrices into larger N-hour buckets.
 * Calculates the mathematical average of the priceEurMwh for each bucket.
 * 
 * @param prices The raw array of prices, typically spaced 15-minutes apart
 * @param intervalHours The number of hours each aggregated bucket should span
 * @returns A new array of averaged ElectricityPrice objects
 */
export function aggregatePrices(prices: ElectricityPrice[], intervalHours: number): ElectricityPrice[] {
    if (!prices || prices.length === 0 || intervalHours <= 0) return prices;

    const aggregated: ElectricityPrice[] = [];
    const intervalMs = intervalHours * 60 * 60 * 1000;

    let currentBucketStart = prices[0].date.getTime();
    let currentBucketEnd = currentBucketStart + intervalMs;

    let bucketSumEurMwh = 0;
    let bucketCount = 0;
    let bucketAllPredicted = true;

    for (const price of prices) {
        const time = price.date.getTime();

        if (time >= currentBucketEnd) {
            if (bucketCount > 0) {
                const avgEurMwh = bucketSumEurMwh / bucketCount;
                const bucketDate = new Date(currentBucketStart);
                aggregated.push({
                    timestamp: bucketDate.toISOString(),
                    date: bucketDate,
                    priceEurMwh: avgEurMwh,
                    priceCentsKwh: eurMwhToCentsKwh(avgEurMwh),
                    isPredicted: bucketAllPredicted
                });
            }

            while (time >= currentBucketEnd) {
                currentBucketStart += intervalMs;
                currentBucketEnd += intervalMs;
            }

            bucketSumEurMwh = 0;
            bucketCount = 0;
            bucketAllPredicted = true;
        }

        bucketSumEurMwh += price.priceEurMwh;
        bucketCount++;
        if (!price.isPredicted) {
            bucketAllPredicted = false;
        }
    }

    if (bucketCount > 0) {
        const avgEurMwh = bucketSumEurMwh / bucketCount;
        const bucketDate = new Date(currentBucketStart);
        aggregated.push({
            timestamp: bucketDate.toISOString(),
            date: bucketDate,
            priceEurMwh: avgEurMwh,
            priceCentsKwh: eurMwhToCentsKwh(avgEurMwh),
            isPredicted: bucketAllPredicted
        });
    }

    return aggregated;
}

/**
 * Utility to fetch data for the last 24 hours and the next 24 (or available) hours,
 * and predict missing future hours up to the end of tomorrow.
 */
export async function getDashboardPrices(): Promise<ElectricityPrice[]> {
    const now = new Date();

    const start = new Date(now);
    start.setHours(start.getHours() - 24);
    start.setMinutes(0, 0, 0);

    const end = new Date(now);
    end.setDate(end.getDate() + 2);
    end.setHours(23, 59, 59, 999);

    return getPricesWithPrediction(start, end);
}

/**
 * Generate predicted prices for missing hours up to the target end date.
 * Uses a blended average of the same hour yesterday and the same hour 7 days ago.
 */
function generatePredictedPrices(historicalData: ElectricityPrice[], targetEndDate: Date): ElectricityPrice[] {
    if (historicalData.length === 0) return [];

    const lastActualDataPoint = historicalData[historicalData.length - 1];
    const predictedPrices: ElectricityPrice[] = [];

    // Start predicting from the hour after the last actual data point
    const currentPredictionDate = new Date(lastActualDataPoint.date);
    currentPredictionDate.setHours(currentPredictionDate.getHours() + 1);

    while (currentPredictionDate < targetEndDate) {
        // Find same hour yesterday
        const yesterdayDate = new Date(currentPredictionDate);
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterdayData = historicalData.find(d => d.date.getTime() === yesterdayDate.getTime());

        // Find same hour 7 days ago
        const lastWeekDate = new Date(currentPredictionDate);
        lastWeekDate.setDate(lastWeekDate.getDate() - 7);
        const lastWeekData = historicalData.find(d => d.date.getTime() === lastWeekDate.getTime());

        // Calculate predicted price (average of yesterday and last week, if available)
        let predictedEurMwh = 0;
        let sources = 0;

        if (yesterdayData) {
            predictedEurMwh += yesterdayData.priceEurMwh;
            sources++;
        }
        if (lastWeekData) {
            predictedEurMwh += lastWeekData.priceEurMwh;
            sources++;
        }

        if (sources > 0) {
            predictedEurMwh /= sources;
        } else {
            // Fallback if no history is found: simply replicate the last known value
            predictedEurMwh = predictedPrices.length > 0
                ? predictedPrices[predictedPrices.length - 1].priceEurMwh
                : lastActualDataPoint.priceEurMwh;
        }

        predictedPrices.push({
            timestamp: currentPredictionDate.toISOString(),
            date: new Date(currentPredictionDate),
            priceEurMwh: predictedEurMwh,
            priceCentsKwh: eurMwhToCentsKwh(predictedEurMwh),
            isPredicted: true
        });

        // Move to next hour
        currentPredictionDate.setHours(currentPredictionDate.getHours() + 1);
    }

    return predictedPrices;
}

/**
 * Get just the current hour's exact price
 */
export async function getCurrentPrice(): Promise<ElectricityPrice | null> {
    try {
        const res = await fetch(CURRENT_PRICE_API, {
            cache: 'no-store'
        });

        if (!res.ok) {
            throw new Error(`Failed to fetch current price: ${res.statusText}`);
        }

        const json: CurrentPriceResponse = await res.json();

        if (!json.success || !json.data || json.data.length === 0) {
            return null;
        }

        const item = json.data[0];
        const date = new Date(item.timestamp * 1000);

        return {
            timestamp: date.toISOString(),
            date,
            priceEurMwh: item.price,
            priceCentsKwh: eurMwhToCentsKwh(item.price)
        };
    } catch (error) {
        console.error('Error fetching current price:', error);
        return null;
    }
}

/**
 * Fetch prices for a heatmap week view, including 4-week historical predictions
 * for any missing date-hour slots within the week range.
 *
 * This fetches the week range + 28 days of history, then fills in missing slots
 * with averaged prices from the same weekday+hour over the previous 4 weeks.
 */
export async function getHeatmapPricesWithPredictions(
  weekStart: Date,
  weekEnd: Date
): Promise<ElectricityPrice[]> {
  // Fetch 28 days before weekStart for prediction context + the week itself
  const historyStart = new Date(weekStart);
  historyStart.setDate(historyStart.getDate() - 28);

  const allData = await getPricesWithPrediction(historyStart, weekEnd);

  // Separate historical (before week) and week data
  const weekStartMs = weekStart.getTime();
  const weekEndMs = weekEnd.getTime();

  const historicalData = allData.filter(
    (p) => p.date.getTime() < weekStartMs && !p.isPredicted
  );
  const weekData = allData.filter(
    (p) => p.date.getTime() >= weekStartMs && p.date.getTime() <= weekEndMs
  );

  // Build a set of existing (date-hour) keys within the week (non-predicted only)
  const existingKeys = new Set<string>();
  for (const p of weekData) {
    if (!p.isPredicted) {
      // Use Europe/Tallinn timezone for consistent date-hour keys
      const local = new Date(p.date);
      const dateStr = local.toLocaleDateString("en-CA", {
        timeZone: "Europe/Tallinn",
      });
      const hour = parseInt(
        local.toLocaleString("en-US", {
          timeZone: "Europe/Tallinn",
          hour: "2-digit",
          hour12: false,
        }),
        10
      );
      existingKeys.add(`${dateStr}-${hour}`);
    }
  }

  // Group historical data by (weekday, hour) for 4-week average predictions
  // weekday: 0=Sun..6=Sat (JS standard)
  const weekdayHourAvg = new Map<
    string,
    { sum: number; count: number }
  >();

  for (const p of historicalData) {
    const local = new Date(p.date);
    const tallinnDate = local.toLocaleDateString("en-CA", {
      timeZone: "Europe/Tallinn",
    });
    const tallinnDay = new Date(tallinnDate + "T12:00:00").getDay();
    const hour = parseInt(
      local.toLocaleString("en-US", {
        timeZone: "Europe/Tallinn",
        hour: "2-digit",
        hour12: false,
      }),
      10
    );
    const key = `${tallinnDay}-${hour}`;

    if (!weekdayHourAvg.has(key)) {
      weekdayHourAvg.set(key, { sum: 0, count: 0 });
    }
    const bucket = weekdayHourAvg.get(key)!;
    bucket.sum += p.priceCentsKwh;
    bucket.count += 1;
  }

  // Generate predicted prices for missing hour slots in the week
  const predictedPrices: ElectricityPrice[] = [];
  const current = new Date(weekStart);

  while (current <= weekEnd) {
    const local = new Date(current);
    const dateStr = local.toLocaleDateString("en-CA", {
      timeZone: "Europe/Tallinn",
    });
    const hour = parseInt(
      local.toLocaleString("en-US", {
        timeZone: "Europe/Tallinn",
        hour: "2-digit",
        hour12: false,
      }),
      10
    );

    const slotKey = `${dateStr}-${hour}`;

    if (!existingKeys.has(slotKey)) {
      // Check if we already have a predicted value from getPricesWithPrediction
      const existingPredicted = weekData.find(
        (p) =>
          p.isPredicted &&
          p.date.getTime() === current.getTime()
      );

      if (!existingPredicted) {
        // Generate 4-week average prediction
        const tallinnDate = local.toLocaleDateString("en-CA", {
          timeZone: "Europe/Tallinn",
        });
        const tallinnDay = new Date(tallinnDate + "T12:00:00").getDay();
        const wdKey = `${tallinnDay}-${hour}`;
        const avg = weekdayHourAvg.get(wdKey);

        if (avg && avg.count > 0) {
          const avgPrice = avg.sum / avg.count;
          predictedPrices.push({
            timestamp: current.toISOString(),
            date: new Date(current),
            priceEurMwh: avgPrice * 10, // convert back from cents/kWh to EUR/MWh
            priceCentsKwh: avgPrice,
            isPredicted: true,
          });
        }
      }
    }

    // Move to next hour
    current.setHours(current.getHours() + 1);
  }

  // Combine week data + new predictions, sort by date
  const combined = [...weekData, ...predictedPrices];
  combined.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Deduplicate by timestamp (prefer non-predicted)
  const seen = new Map<string, ElectricityPrice>();
  for (const p of combined) {
    const existing = seen.get(p.timestamp);
    if (!existing || (existing.isPredicted && !p.isPredicted)) {
      seen.set(p.timestamp, p);
    }
  }

  return Array.from(seen.values()).sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );
}

/**
 * Calculate statistical measures (Median, Percentiles, Mean)
 */
export function calculateStatistics(prices: ElectricityPrice[], includeVat: boolean = false): {
    min: number;
    max: number;
    mean: number;
    median: number;
    p75: number;
    p90: number;
    p95: number;
} | null {
    if (!prices || prices.length === 0) return null;

    // Filter out predicted prices for statistics calculation to avoid skewing
    const actualPrices = prices.filter(p => !p.isPredicted);
    if (actualPrices.length === 0) return null;

    // Extract base prices and sort them
    let values = actualPrices.map(p => p.priceCentsKwh);
    if (includeVat) {
        values = values.map(v => applyVat(v));
    }

    values.sort((a, b) => a - b);

    const min = values[0];
    const max = values[values.length - 1];
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;

    const getPercentile = (p: number) => {
        const index = (p / 100) * (values.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        const weight = index - lower;
        if (upper >= values.length) return values[lower];
        return values[lower] * (1 - weight) + values[upper] * weight;
    };

    return {
        min,
        max,
        mean,
        median: getPercentile(50),
        p75: getPercentile(75),
        p90: getPercentile(90),
        p95: getPercentile(95),
    };
}

/**
 * Map from hour-of-day (0-23) to average price in cents/kWh.
 */
export type HourlyAveragePattern = Map<number, number>;

/**
 * Compute per-hour-of-day average prices from historical data.
 *
 * Fetches raw prices for the past `days` days, aggregates to hourly buckets,
 * then groups by hour-of-day and returns the average for each hour.
 *
 * @param days Number of past days to include (e.g. 7 or 30)
 * @returns Map of hour (0-23) → average price in cents/kWh (before VAT)
 */
export async function getHourlyAveragePattern(days: number): Promise<HourlyAveragePattern> {
    const now = new Date();
    const end = new Date(now);
    end.setHours(0, 0, 0, 0); // start of today

    const start = new Date(end);
    start.setDate(start.getDate() - days);

    const rawPrices = await getPricesForDateRange(start, end);
    const hourlyPrices = aggregatePrices(rawPrices, 1);

    // Group by hour-of-day and accumulate
    const sums = new Map<number, number>();
    const counts = new Map<number, number>();

    for (const p of hourlyPrices) {
        if (p.isPredicted) continue; // only use actual data
        const hour = p.date.getHours();
        sums.set(hour, (sums.get(hour) ?? 0) + p.priceCentsKwh);
        counts.set(hour, (counts.get(hour) ?? 0) + 1);
    }

    const pattern: HourlyAveragePattern = new Map();
    for (let h = 0; h < 24; h++) {
        const sum = sums.get(h);
        const count = counts.get(h);
        if (sum !== undefined && count !== undefined && count > 0) {
            pattern.set(h, sum / count);
        }
    }

    return pattern;
}
