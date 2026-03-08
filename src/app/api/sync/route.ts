import { NextRequest } from "next/server";
import {
  getDB,
  upsertPrices,
  recomputeAllAggregates,
} from "@/lib/db";
import {
  fetchFromElering,
  errorResponse,
  successResponse,
} from "@/lib/elering";

/**
 * POST /api/sync — Sync prices from Elering to D1.
 *
 * Automatic mode (no params or just end):
 *   Checks the latest timestamp in DB and fetches from there to tomorrow end-of-day.
 *   This means missed syncs are automatically recovered on the next run.
 *   If DB is empty, defaults to fetching the last 2 days.
 *
 * Manual mode (start provided):
 *   Fetches from the specified start to end (or tomorrow end-of-day if no end).
 *   Useful for historical backfill. Elering API allows max 1 year per chunk,
 *   but this route handles chunking automatically.
 *
 * Query params:
 *   - start: ISO date string for sync start (optional, enables manual mode)
 *   - end:   ISO date string for sync end (optional, defaults to tomorrow 23:59:59)
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const manualStart = searchParams.get("start");
    const manualEnd = searchParams.get("end");

    const now = new Date();

    // Default end: 48h from now (covers tomorrow's prices + buffer for data published after ~01:00 EET)
    const defaultEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    let start: Date;
    let end: Date;

    if (manualStart) {
      // Manual mode: use provided start/end
      start = new Date(manualStart);
      end = manualEnd ? new Date(manualEnd) : defaultEnd;

      if (isNaN(start.getTime())) {
        return errorResponse(
          "Invalid start date format. Use ISO 8601 (e.g., 2025-03-01T00:00:00.000Z)",
          400
        );
      }
      if (isNaN(end.getTime())) {
        return errorResponse(
          "Invalid end date format. Use ISO 8601 (e.g., 2025-03-01T23:59:59.999Z)",
          400
        );
      }

      // Validate start is before end
      if (start >= end) {
        return errorResponse(
          "Start date must be before end date",
          400
        );
      }

      // Validate max range: 2 years (730 days)
      const maxRangeMs = 730 * 24 * 60 * 60 * 1000;
      if (end.getTime() - start.getTime() > maxRangeMs) {
        return errorResponse(
          "Date range exceeds maximum of 2 years",
          400
        );
      }
    } else {
      // Automatic mode: resume from latest timestamp in DB
      const db = await getDB();
      const latest = await db
        .prepare("SELECT MAX(timestamp) as latest FROM prices")
        .first<{ latest: number | null }>();

      if (latest?.latest) {
        // Start from the latest known timestamp (will upsert duplicates harmlessly)
        start = new Date(latest.latest * 1000);
      } else {
        // DB is empty, fetch last 2 days as starting point
        start = new Date(now);
        start.setDate(start.getDate() - 2);
        start.setHours(0, 0, 0, 0);
      }

      end = defaultEnd;
    }

    // Fetch from Elering
    const prices = await fetchFromElering(start, end);

    if (prices.length === 0) {
      return successResponse({
        message: "No new prices to sync",
        synced: 0,
      });
    }

    // Get DB connection for upsert and aggregation
    const db = await getDB();

    // Upsert into D1
    await upsertPrices(db, prices);

    // Determine the actual time range of synced data
    const minTimestamp = Math.min(...prices.map((p) => p.timestamp));
    const maxTimestamp = Math.max(...prices.map((p) => p.timestamp));

    // Recompute all aggregates for the affected range
    await recomputeAllAggregates(db, minTimestamp, maxTimestamp + 900);

    return successResponse({
      message: `Synced ${prices.length} price points`,
      synced: prices.length,
      range: {
        start: new Date(minTimestamp * 1000).toISOString(),
        end: new Date(maxTimestamp * 1000).toISOString(),
      },
    });
  } catch (error) {
    console.error("Sync error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Unknown sync error",
      500
    );
  }
}

/**
 * GET /api/sync — Check sync status (latest/earliest timestamp and total count).
 */
export async function GET() {
  try {
    const db = await getDB();

    const result = await db
      .prepare(
        `SELECT MAX(timestamp) as latest, MIN(timestamp) as earliest, COUNT(*) as total FROM prices`
      )
      .first<{ latest: number | null; earliest: number | null; total: number }>();

    return successResponse({
      latestTimestamp: result?.latest
        ? new Date(result.latest * 1000).toISOString()
        : null,
      earliestTimestamp: result?.earliest
        ? new Date(result.earliest * 1000).toISOString()
        : null,
      totalPricePoints: result?.total || 0,
    });
  } catch (error) {
    console.error("Sync status error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Unknown error",
      500
    );
  }
}
