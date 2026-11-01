import { NextRequest } from "next/server";
import { getDB, recomputeCalendarAggregates } from "@/lib/db";
import { errorResponse, successResponse } from "@/lib/elering";
import { isSyncAuthorized } from "@/lib/syncAuth";
import { tallinnWallTimeToUtc } from "@/lib/timezone";

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

/**
 * POST /api/sync/recompute?month=YYYY-MM — Rewrite one Tallinn month's daily,
 * weekly, monthly and weekday-hour aggregates from the hourly averages already in D1.
 *
 * For backfills after a change to how aggregates are bucketed. Unlike a manual
 * /api/sync it does not refetch from Elering or rewrite prices/hourly_averages, so
 * one call stays well inside the Workers Free limits (10 ms CPU, 50 D1 queries per
 * invocation, 100k rows written per day). Recompute history one month per call.
 */
export async function POST(request: NextRequest) {
  try {
    if (!isSyncAuthorized(request)) {
      return errorResponse("Unauthorized", 401);
    }

    const month = new URL(request.url).searchParams.get("month") ?? "";
    const match = MONTH_PATTERN.exec(month);
    if (!match) {
      return errorResponse("Missing or invalid month. Use YYYY-MM (e.g., 2025-10)", 400);
    }

    const [year, monthNum] = [Number(match[1]), Number(match[2])];
    const nextMonth = monthNum === 12 ? `${year + 1}-01-01` : `${year}-${String(monthNum + 1).padStart(2, "0")}-01`;
    const start = tallinnWallTimeToUtc(`${month}-01`, 0, 0).getTime() / 1000;
    const end = tallinnWallTimeToUtc(nextMonth, 0, 0).getTime() / 1000;

    const db = await getDB();
    const rows = await recomputeCalendarAggregates(db, start, end);
    if (rows.monthly === 0) {
      // A typo or a never-synced month must not look like a successful backfill
      return errorResponse(`No hourly averages stored for ${month}`, 404);
    }

    return successResponse({ month, rows });
  } catch (error) {
    console.error("Recompute error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Unknown recompute error",
      500
    );
  }
}
