/**
 * Shared TypeScript interfaces for API responses.
 *
 * Used by server-side route handlers and client-side code
 * for type-safe API contracts.
 */

/**
 * Raw price row returned directly by API route handlers.
 * `timestamp` is a Unix seconds integer (number), as returned by the Elering API and stored in D1.
 * This differs from `ElectricityPrice` in `@/lib/api`, where `timestamp` is an ISO string
 * (the client-side model after transformation).
 */
export interface RawPriceRow {
  /** Unix epoch seconds (not milliseconds) */
  timestamp: number;
  /** Raw price in EUR/MWh */
  price: number;
}

// --- Hourly averages endpoint ---
export interface HourlyAverageRow {
  /** Unix epoch seconds — same convention as RawPriceRow */
  timestamp: number;
  avg_price: number;
  min_price: number;
  max_price: number;
  data_points: number;
}

// --- Daily averages endpoint ---
export interface DailyAverageRow {
  date: string;
  avg_price: number;
  min_price: number;
  max_price: number;
  data_points: number;
}

// --- Weekly averages endpoint ---
export interface WeeklyAverageRow {
  year: number;
  week: number;
  avg_price: number;
  min_price: number;
  max_price: number;
  data_points: number;
}

// --- Monthly averages endpoint ---
export interface MonthlyAverageRow {
  year: number;
  month: number;
  avg_price: number;
  min_price: number;
  max_price: number;
  data_points: number;
}

// --- Weekday-hour pattern endpoint ---
export interface WeekdayHourRow {
  year: number;
  month: number;
  weekday: number;
  hour: number;
  avg_price: number;
  sample_count: number;
}

// --- Sync endpoint ---
export interface SyncResult {
  message: string;
  synced: number;
  range?: {
    start: string;
    end: string;
  };
}

export interface SyncStatus {
  latestTimestamp: string | null;
  earliestTimestamp: string | null;
  totalPricePoints: number;
}

// --- Dashboard view types ---
export type Period = 'yesterday' | 'today' | 'tomorrow' | 'this_week' | 'last_7_days' | 'next_7_days' | 'last_30_days' | 'custom';
export type ViewMode = 'chart' | 'heatmap';
