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
        `SELECT year, month, avg_price, min_price, max_price, data_points
         FROM monthly_averages
         WHERE year = ?
         ORDER BY month ASC`
      )
      .bind(parseInt(year, 10))
      .all();

    return successResponse(results.results);
  } catch (error) {
    console.error("Error fetching monthly averages:", error);
    return errorResponse("Failed to fetch monthly averages", 500);
  }
}
