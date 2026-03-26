/**
 * Shared Elering API utilities for server-side API routes.
 *
 * Contains the Elering API base URL, response types, and data fetching
 * logic used by multiple API routes (prices proxy, current price, sync).
 */

import { NextResponse } from "next/server";
import { CHUNK_SIZE_MS } from "@/lib/price";

// ─── Constants ───────────────────────────────────────────────────────────────

export const ELERING_API = "https://dashboard.elering.ee/api/nps/price";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EleringPriceItem {
  timestamp: number;
  price: number;
}

export interface EleringResponse {
  success: boolean;
  data: {
    ee: EleringPriceItem[];
  };
}

// ─── API Response Helpers ────────────────────────────────────────────────────

/** Return a JSON error response */
export function errorResponse(
  message: string,
  status: number,
  details?: string
) {
  return NextResponse.json(
    { error: message, ...(details ? { details } : {}) },
    { status }
  );
}

/** Return a JSON success response with data */
export function successResponse<T>(data: T) {
  return NextResponse.json({ success: true, data });
}

// ─── Elering Data Fetching ───────────────────────────────────────────────────

/**
 * Fetch prices from Elering for a date range, automatically chunking into
 * 90-day intervals. Elering API allows a maximum of 1 year per request.
 *
 * Returns deduplicated price points sorted by timestamp.
 */
export async function fetchFromElering(
  start: Date,
  end: Date
): Promise<{ timestamp: number; priceEurMwh: number }[]> {
  const allPrices: { timestamp: number; priceEurMwh: number }[] = [];
  let currentStart = new Date(start);

  while (currentStart < end) {
    let currentEnd = new Date(currentStart.getTime() + CHUNK_SIZE_MS);
    if (currentEnd > end) currentEnd = end;

    const startStr = currentStart.toISOString();
    const isAbsoluteEnd = currentEnd.getTime() === end.getTime();
    const endStr = isAbsoluteEnd
      ? currentEnd.toISOString().replace(/\.\d{3}Z$/, ".999Z")
      : currentEnd.toISOString();

    const url = `${ELERING_API}?start=${encodeURIComponent(startStr)}&end=${encodeURIComponent(endStr)}`;
    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      throw new Error(
        `Elering API error: ${res.status} ${res.statusText}`
      );
    }

    const json: EleringResponse = await res.json();
    if (!json.success || !json.data?.ee) {
      throw new Error("Invalid Elering API response format");
    }

    for (const item of json.data.ee) {
      allPrices.push({ timestamp: item.timestamp, priceEurMwh: item.price });
    }

    currentStart = new Date(currentEnd.getTime() + 1);
  }

  // Deduplicate by timestamp
  const seen = new Set<number>();
  return allPrices.filter((p) => {
    if (seen.has(p.timestamp)) return false;
    seen.add(p.timestamp);
    return true;
  });
}
