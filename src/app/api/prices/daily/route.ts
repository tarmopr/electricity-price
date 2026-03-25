import { NextRequest } from "next/server";
import { getDB } from "@/lib/db";
import { errorResponse, successResponse } from "@/lib/elering";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end) {
    return errorResponse(
      "Missing required query parameters: start, end (YYYY-MM-DD format)",
      400
    );
  }

  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  if (!DATE_RE.test(start) || !DATE_RE.test(end)) {
    return errorResponse("start and end must be in YYYY-MM-DD format", 400);
  }

  try {
    const db = await getDB();
    const results = await db
      .prepare(
        `SELECT date, avg_price, min_price, max_price, data_points
         FROM daily_averages
         WHERE date >= ? AND date <= ?
         ORDER BY date ASC`
      )
      .bind(start, end)
      .all();

    return successResponse(results.results);
  } catch (error) {
    console.error("Error fetching daily averages:", error);
    return errorResponse("Failed to fetch daily averages", 500);
  }
}
