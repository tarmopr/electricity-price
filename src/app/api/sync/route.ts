import { NextRequest } from "next/server";
import {
  getDB,
  getSyncState,
  upsertPrices,
  recomputeAllAggregates,
} from "@/lib/db";
import {
  fetchFromElering,
  errorResponse,
  successResponse,
} from "@/lib/elering";
import { isSyncAuthorized } from "@/lib/syncAuth";

/**
 * Most a single sync fetches, sized for Workers Free (10 ms CPU, 50 D1 queries per
 * invocation, 100k rows written per day): 31 days is ~3k price slots. The extra hour
 * lets a whole Tallinn October (fall-back day) through. Rebuild aggregates only
 * with /api/sync/recompute.
 */
const MAX_SYNC_RANGE_MS = (31 * 24 + 1) * 60 * 60 * 1000;

/** Sorts [start, end) ranges and merges the ones that overlap or touch. */
function mergeRanges(ranges: [number, number][]): [number, number][] {
  const merged: [number, number][] = [];
  for (const [a, b] of [...ranges].sort((x, y) => x[0] - y[0])) {
    const last = merged[merged.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  return merged;
}

/**
 * POST /api/sync — Sync prices from Elering to D1.
 *
 * Automatic mode (no params or just end):
 *   Checks the latest timestamp in DB and fetches from there to 48h from now,
 *   at most 31 days per run (a longer gap is filled over the following runs).
 *   This means missed syncs are automatically recovered on the next run.
 *   If DB is empty, defaults to fetching the last 2 days.
 *
 * Manual mode (start provided):
 *   Fetches from the specified start to end (or 48h from now if no end), at most
 *   31 days per call. Useful for filling gaps in price history.
 *
 * Query params:
 *   - start: ISO date string for sync start (optional, enables manual mode)
 *   - end:   ISO date string for sync end (optional, defaults to 48h from now)
 */
export async function POST(request: NextRequest) {
  try {
    if (!isSyncAuthorized(request)) {
      return errorResponse('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const manualStart = searchParams.get("start");
    const manualEnd = searchParams.get("end");

    const now = new Date();

    // Default end: 48h from now (covers tomorrow's prices + buffer for data published after ~01:00 EET)
    const defaultEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    // --- Input validation (before any DB or API calls) ---
    let manualRange: { start: Date; end: Date } | null = null;
    if (manualStart) {
      const start = new Date(manualStart);
      const end = manualEnd ? new Date(manualEnd) : defaultEnd;

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
      if (start >= end) {
        return errorResponse("Start date must be before end date", 400);
      }

      if (end.getTime() - start.getTime() > MAX_SYNC_RANGE_MS) {
        return errorResponse(
          "Date range exceeds maximum of 31 days",
          400
        );
      }
      manualRange = { start, end };
    }

    // --- DB + fetch ---
    const db = await getDB();
    const { latest, catchUp } = await getSyncState(db);

    let start: Date;
    let end: Date;
    if (manualRange) {
      ({ start, end } = manualRange);
    } else {
      // Automatic mode: resume from latest timestamp in DB
      if (latest) {
        start = new Date(latest * 1000);
      } else {
        start = new Date(now);
        start.setDate(start.getDate() - 2);
        start.setHours(0, 0, 0, 0);
      }
      // Same Free-plan budget as manual mode: a long gap is fetched over several runs
      end = new Date(Math.min(defaultEnd.getTime(), start.getTime() + MAX_SYNC_RANGE_MS));
    }

    // Fetch from Elering
    const prices = await fetchFromElering(start, end);

    const synced =
      prices.length > 0
        ? {
            min: Math.min(...prices.map((p) => p.timestamp)),
            max: Math.max(...prices.map((p) => p.timestamp)),
          }
        : null;
    if (synced) await upsertPrices(db, prices);

    // Recompute aggregates for the synced range and for any range a failed run left
    // behind (overlapping ranges are merged; separate ones are recomputed separately)
    const ranges: [number, number][] = [];
    if (synced) ranges.push([synced.min, synced.max + 900]);
    if (catchUp) ranges.push([catchUp.start, catchUp.end]);
    for (const [rangeStart, rangeEnd] of mergeRanges(ranges)) {
      await recomputeAllAggregates(db, rangeStart, rangeEnd);
    }

    if (!synced) {
      return successResponse({
        message: catchUp
          ? "No new prices to sync; recomputed aggregates a previous run missed"
          : "No new prices to sync",
        synced: 0,
      });
    }

    return successResponse({
      message: `Synced ${prices.length} price points`,
      synced: prices.length,
      range: {
        start: new Date(synced.min * 1000).toISOString(),
        end: new Date(synced.max * 1000).toISOString(),
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
