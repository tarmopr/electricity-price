export interface ElectricityPrice {
    timestamp: string; // ISO string
    date: Date; // Parsed Date object
    priceEurMwh: number; // Raw price from API
    priceCentsKwh: number; // Converted price
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

const CORS_PROXY = 'https://corsproxy.io/?';
const ELERING_API = 'https://dashboard.elering.ee/api/nps/price';

// Use CORS proxy for client-side fetching because static export removes Next.js rewrites
const API_BASE_URL = typeof window !== 'undefined'
    ? `${CORS_PROXY}${encodeURIComponent(ELERING_API)}`
    : ELERING_API;



/**
 * Convert Eur/Mwh to Cents/Kwh
 * 1 Eur = 100 Cents
 * 1 Mwh = 1000 Kwh
 * Therefore, (Eur * 100) / 1000 = Cents/Kwh = Eur / 10
 */
export function convertEurMwhToCentsKwh(price: number): number {
    return price / 10;
}

/**
 * Applies VAT to a price if requested
 */
export function applyVat(price: number, vatRate: number = 0.22): number {
    return price * (1 + vatRate);
}

/**
 * Formats a given date to the API's required ISO string format (UTC)
 */
function formatDateForApi(date: Date): string {
    return date.toISOString().replace('.000Z', '.999Z');
}

/**
 * Fetch prices between a start and end date
 */
export async function getPricesForDateRange(start: Date, end: Date): Promise<ElectricityPrice[]> {
    try {
        const startStr = encodeURIComponent(formatDateForApi(start));
        const endStr = encodeURIComponent(formatDateForApi(end));
        const url = `${API_BASE_URL}?start=${startStr}&end=${endStr}`;

        const res = await fetch(url, {
            next: { revalidate: 3600 } // Cache for 1 hour to prevent spamming the API
        });

        if (!res.ok) {
            throw new Error(`Failed to fetch prices: ${res.statusText}`);
        }

        const json: PriceDataResponse = await res.json();

        if (!json.success || !json.data || !json.data.ee) {
            throw new Error('Invalid API response format');
        }

        return json.data.ee.map(item => {
            // API returns unix timestamp in seconds
            const date = new Date(item.timestamp * 1000);
            return {
                timestamp: date.toISOString(),
                date,
                priceEurMwh: item.price,
                priceCentsKwh: convertEurMwhToCentsKwh(item.price)
            };
        }).sort((a, b) => a.date.getTime() - b.date.getTime()); // Ensure sorted by time
    } catch (error) {
        console.error('Error fetching electricity prices:', error);
        return [];
    }
}

/**
 * Utility to fetch data for the last 24 hours and the next 24 (or available) hours
 */
export async function getDashboardPrices(): Promise<ElectricityPrice[]> {
    const now = new Date();

    // Go back ~24 hours from current time
    const start = new Date(now);
    start.setHours(start.getHours() - 24);
    start.setMinutes(0, 0, 0);

    // Go forward to end of tomorrow (API usually has data for tomorrow by ~13:00)
    const end = new Date(now);
    end.setDate(end.getDate() + 2);
    end.setHours(23, 59, 59, 999);

    return getPricesForDateRange(start, end);
}

/**
 * Get just the current hour's exact price
 */
export async function getCurrentPrice(): Promise<ElectricityPrice | null> {
    try {
        const res = await fetch(`${API_BASE_URL}/EE/current`, {
            cache: 'no-store' // Always get fresh current price
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
            priceCentsKwh: convertEurMwhToCentsKwh(item.price)
        };
    } catch (error) {
        console.error('Error fetching current price:', error);
        return null;
    }
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

    // Extract base prices and sort them
    let values = prices.map(p => p.priceCentsKwh);
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
