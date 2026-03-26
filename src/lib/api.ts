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

import { eurMwhToCentsKwh, applyVat } from "@/lib/price";

// Re-export for backwards compatibility with existing consumers
export { applyVat, eurMwhToCentsKwh };

// Re-export from split modules for backwards compatibility
export { calculateStatistics, getHourlyAveragePattern } from './statistics';
export type { HourlyAveragePattern } from './statistics';
export { getPricesWithPrediction, getHeatmapPricesWithPredictions, buildWeekdayHourAverages, generateMissingSlotPredictions } from './prediction';

// Server-side API routes (proxy to Elering, no CORS issues)
const PRICES_API = '/api/prices';
const CURRENT_PRICE_API = '/api/prices/current';

/**
 * Fetch prices between a start and end date.
 * Chunking is handled server-side by /api/prices.
 */
export async function getPricesForDateRange(start: Date, end: Date): Promise<ElectricityPrice[]> {
    const startStr = start.toISOString();
    const endStr = end.toISOString().replace(/\.\d{3}Z$/, '.999Z');

    const url = `${PRICES_API}?start=${encodeURIComponent(startStr)}&end=${encodeURIComponent(endStr)}`;

    const res = await fetch(url, { cache: 'no-store' });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Failed to fetch prices: ${res.status} ${res.statusText} - ${errText}`);
    }

    const json: PriceDataResponse = await res.json();

    if (!json.success || !json.data || !json.data.ee) {
        throw new Error('Invalid API response format');
    }

    const prices = json.data.ee.map(item => {
        const date = new Date(item.timestamp * 1000);
        return {
            timestamp: date.toISOString(),
            date,
            priceEurMwh: item.price,
            priceCentsKwh: eurMwhToCentsKwh(item.price)
        };
    });

    return prices.sort((a, b) => a.date.getTime() - b.date.getTime());
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

