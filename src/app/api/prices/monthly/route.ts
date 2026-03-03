import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year");

  if (!year) {
    return NextResponse.json(
      { error: "Missing required query parameter: year" },
      { status: 400 }
    );
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

    return NextResponse.json({
      success: true,
      data: results.results,
    });
  } catch (error) {
    console.error("Error fetching monthly averages:", error);
    return NextResponse.json(
      { error: "Failed to fetch monthly averages" },
      { status: 500 }
    );
  }
}
