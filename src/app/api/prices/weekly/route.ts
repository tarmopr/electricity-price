import { NextRequest } from "next/server";
import { getDB } from "@/lib/db";
import { errorResponse, successResponse } from "@/lib/elering";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year");

  if (!year) {
    return errorResponse("Missing required query parameter: year", 400);
  }

  try {
    const db = await getDB();
    const results = await db
      .prepare(
        `SELECT year, week, avg_price, min_price, max_price, data_points
         FROM weekly_averages
         WHERE year = ?
         ORDER BY week ASC`
      )
      .bind(parseInt(year, 10))
      .all();

    return successResponse(results.results);
  } catch (error) {
    console.error("Error fetching weekly averages:", error);
    return errorResponse("Failed to fetch weekly averages", 500);
  }
}
