import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json(
      { error: "Missing required query parameters: start, end (YYYY-MM-DD format)" },
      { status: 400 }
    );
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

    return NextResponse.json({
      success: true,
      data: results.results,
    });
  } catch (error) {
    console.error("Error fetching daily averages:", error);
    return NextResponse.json(
      { error: "Failed to fetch daily averages" },
      { status: 500 }
    );
  }
}
