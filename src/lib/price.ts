/**
 * Shared price conversion utilities and constants.
 *
 * Single source of truth for EUR/MWh → ¢/kWh conversion, VAT application,
 * and the Elering API chunk size. Used by both server-side (db.ts, API routes)
 * and client-side (api.ts, components) code.
 */

/** Convert EUR/MWh to cents/kWh: (EUR × 100) / 1000 = EUR / 10 */
export function eurMwhToCentsKwh(price: number): number {
  return price / 10;
}

/** Apply VAT to a price. Default Estonian VAT rate is 22%. */
export function applyVat(price: number, vatRate: number = 0.22): number {
  return price * (1 + vatRate);
}

/** ~90 days in milliseconds, used for chunking large Elering API date ranges. */
export const CHUNK_SIZE_MS = 90 * 24 * 60 * 60 * 1000;
