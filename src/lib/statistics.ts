import { applyVat } from "@/lib/price";
import { getTallinnHour } from "@/lib/timezone";
import type { ElectricityPrice } from "@/lib/api";

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
 * Uses lazy imports of api.ts to avoid circular dependency issues.
 *
 * @param days Number of past days to include (e.g. 7 or 30)
 * @returns Map of hour (0-23) → average price in cents/kWh (before VAT)
 */
export async function getHourlyAveragePattern(days: number): Promise<HourlyAveragePattern> {
    // Lazy import to avoid circular dependency at module evaluation time
    const { getPricesForDateRange, aggregatePrices } = await import("@/lib/api");

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
        const hour = getTallinnHour(p.date); // always group by Europe/Tallinn hour
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
