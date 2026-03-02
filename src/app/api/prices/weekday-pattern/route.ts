import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  if (!year) {
    return NextResponse.json(
      { error: "Missing required query parameter: year" },
      { status: 400 }
    );
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

    return NextResponse.json({
      success: true,
      data: results.results,
    });
  } catch (error) {
    console.error("Error fetching weekday-hour pattern:", error);
    return NextResponse.json(
      { error: "Failed to fetch weekday-hour pattern" },
      { status: 500 }
    );
  }
}
