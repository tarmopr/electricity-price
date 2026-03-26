import { eurMwhToCentsKwh } from "@/lib/price";
import { getTallinnHour, getTallinnDateStr, getTallinnWeekday } from "@/lib/timezone";
import type { ElectricityPrice } from "@/lib/api";

/**
 * Generate predicted prices for missing hours up to the target end date.
 * Uses a blended average of the same hour yesterday and the same hour 7 days ago.
 */
function generatePredictedPrices(historicalData: ElectricityPrice[], targetEndDate: Date): ElectricityPrice[] {
    if (historicalData.length === 0) return [];

    const lastActualDataPoint = historicalData[historicalData.length - 1];
    const predictedPrices: ElectricityPrice[] = [];

    // Start predicting from the hour after the last actual data point.
    // Use UTC millisecond arithmetic to avoid DST-related hour skips/duplicates.
    const currentPredictionDate = new Date(lastActualDataPoint.date.getTime() + 3_600_000);

    while (currentPredictionDate < targetEndDate) {
        // Find same hour yesterday — subtract exactly 24 UTC hours so that
        // the lookup matches the hourly-aligned UTC timestamps in historicalData.
        const yesterdayDate = new Date(currentPredictionDate.getTime() - 86_400_000);
        const yesterdayData = historicalData.find(d => d.date.getTime() === yesterdayDate.getTime());

        // Find same hour 7 days ago
        const lastWeekDate = new Date(currentPredictionDate.getTime() - 7 * 86_400_000);
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

        // Move to next hour using UTC arithmetic to avoid DST skips/duplicates
        currentPredictionDate.setTime(currentPredictionDate.getTime() + 3_600_000);
    }

    return predictedPrices;
}

/**
 * Fetch prices between a start and end date, automatically fetching historical context
 * to generate and append predicted prices if the end date is in the future.
 */
export async function getPricesWithPrediction(start: Date, end: Date): Promise<ElectricityPrice[]> {
    // Lazy import to avoid circular dependency at module evaluation time
    const { getPricesForDateRange } = await import("@/lib/api");

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
 * Groups historical price data by (weekday, hour) in Europe/Tallinn timezone,
 * accumulating sum and count for computing 4-week averages.
 *
 * @returns Map keyed by `"weekday-hour"` (e.g. `"1-8"` = Monday at 08:00 Tallinn)
 */
export function buildWeekdayHourAverages(
  historicalData: ElectricityPrice[]
): Map<string, { sum: number; count: number }> {
  // weekday: 0=Sun..6=Sat (JS standard)
  const weekdayHourAvg = new Map<string, { sum: number; count: number }>();

  for (const p of historicalData) {
    const tallinnDay = getTallinnWeekday(p.date);
    const hour = getTallinnHour(p.date);
    const key = `${tallinnDay}-${hour}`;

    if (!weekdayHourAvg.has(key)) {
      weekdayHourAvg.set(key, { sum: 0, count: 0 });
    }
    const bucket = weekdayHourAvg.get(key)!;
    bucket.sum += p.priceCentsKwh;
    bucket.count += 1;
  }

  return weekdayHourAvg;
}

/**
 * Generates predicted ElectricityPrice entries for every hour slot within
 * [weekStart, weekEnd] that is absent from `existingKeys`.
 * Predictions use the 4-week average from `weekdayHourAvg`.
 */
export function generateMissingSlotPredictions(
  weekStart: Date,
  weekEnd: Date,
  existingKeys: Set<string>,
  weekdayHourAvg: Map<string, { sum: number; count: number }>,
  weekData: ElectricityPrice[]
): ElectricityPrice[] {
  const predictedPrices: ElectricityPrice[] = [];
  const current = new Date(weekStart);

  while (current <= weekEnd) {
    const dateStr = getTallinnDateStr(current);
    const hour = getTallinnHour(current);
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
        const tallinnDay = getTallinnWeekday(current);
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

    // Move to next hour using UTC arithmetic to avoid DST skips/duplicates
    current.setTime(current.getTime() + 3_600_000);
  }

  return predictedPrices;
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
      const dateStr = getTallinnDateStr(p.date);
      const hour = getTallinnHour(p.date);
      existingKeys.add(`${dateStr}-${hour}`);
    }
  }

  const weekdayHourAvg = buildWeekdayHourAverages(historicalData);
  const predictedPrices = generateMissingSlotPredictions(
    weekStart,
    weekEnd,
    existingKeys,
    weekdayHourAvg,
    weekData
  );

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
