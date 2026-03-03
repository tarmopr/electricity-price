import { NextRequest } from "next/server";
import { getDB } from "@/lib/db";
import { errorResponse, successResponse } from "@/lib/elering";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  if (!year) {
    return errorResponse("Missing required query parameter: year", 400);
  }

  try {
    const db = await getDB();

    // If month is provided, query for that specific month.
    // If not, return all months for the year (can be aggregated client-side for quarter/season).
    let results;
    if (month) {
      results = await db
        .prepare(
          `SELECT year, month, weekday, hour, avg_price, sample_count
           FROM weekday_hour_averages
           WHERE year = ? AND month = ?
           ORDER BY weekday ASC, hour ASC`
        )
        .bind(parseInt(year, 10), parseInt(month, 10))
        .all();
    } else {
      results = await db
        .prepare(
          `SELECT year, month, weekday, hour, avg_price, sample_count
           FROM weekday_hour_averages
           WHERE year = ?
           ORDER BY month ASC, weekday ASC, hour ASC`
        )
        .bind(parseInt(year, 10))
        .all();
    }

    return successResponse(results.results);
  } catch (error) {
    console.error("Error fetching weekday-hour pattern:", error);
    return errorResponse("Failed to fetch weekday-hour pattern", 500);
  }
}
