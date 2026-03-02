import { NextRequest, NextResponse } from "next/server";
import {
  getDB,
  eurMwhToCentsKwh,
  upsertPrices,
  recomputeAllAggregates,
} from "@/lib/db";

const ELERING_API = "https://dashboard.elering.ee/api/nps/price";
const CHUNK_SIZE_MS = 90 * 24 * 60 * 60 * 1000; // ~90 days

interface EleringResponse {
  success: boolean;
  data: {
    ee: { timestamp: number; price: number }[];
  };
}

/**
 * Fetch prices from Elering for a date range, chunking into 90-day intervals.
 */
async function fetchFromElering(
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
      ? currentEnd.toISOString().replace(".000Z", ".999Z")
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

/**
 * POST /api/sync — Sync prices from Elering to D1.
 * Query params:
 *   - backfill_days: Number of days to backfill (default: 2, max: 365)
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const backfillDays = Math.min(
      parseInt(searchParams.get("backfill_days") || "2", 10),
      365
    );

    const db = await getDB();

    // Determine sync range
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + 2); // Include tomorrow + day after (for next-day prices)
    end.setHours(23, 59, 59, 999);

    const start = new Date(now);
    start.setDate(start.getDate() - backfillDays);
    start.setHours(0, 0, 0, 0);

    // Fetch from Elering
    const prices = await fetchFromElering(start, end);

    if (prices.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No prices to sync",
        synced: 0,
      });
    }

    // Upsert into D1
    await upsertPrices(db, prices);

    // Determine the actual time range of synced data
    const minTimestamp = Math.min(...prices.map((p) => p.timestamp));
    const maxTimestamp = Math.max(...prices.map((p) => p.timestamp));

    // Recompute all aggregates for the affected range
    await recomputeAllAggregates(db, minTimestamp, maxTimestamp + 900); // +900s to include the last 15-min slot

    return NextResponse.json({
      success: true,
      message: `Synced ${prices.length} price points`,
      synced: prices.length,
      range: {
        start: new Date(minTimestamp * 1000).toISOString(),
        end: new Date(maxTimestamp * 1000).toISOString(),
      },
    });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown sync error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sync — Check sync status (last synced timestamp).
 */
export async function GET() {
  try {
    const db = await getDB();

    const result = await db
      .prepare(
        `SELECT MAX(timestamp) as latest, MIN(timestamp) as earliest, COUNT(*) as total FROM prices`
      )
      .first<{ latest: number | null; earliest: number | null; total: number }>();

    return NextResponse.json({
      success: true,
      data: {
        latestTimestamp: result?.latest
          ? new Date(result.latest * 1000).toISOString()
          : null,
        earliestTimestamp: result?.earliest
          ? new Date(result.earliest * 1000).toISOString()
          : null,
        totalPricePoints: result?.total || 0,
      },
    });
  } catch (error) {
    console.error("Sync status error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
