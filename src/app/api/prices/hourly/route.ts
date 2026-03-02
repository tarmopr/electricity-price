import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json(
      { error: "Missing required query parameters: start, end" },
      { status: 400 }
    );
  }

  try {
    const startTs = Math.floor(new Date(start).getTime() / 1000);
    const endTs = Math.floor(new Date(end).getTime() / 1000);

    const db = await getDB();
    const results = await db
      .prepare(
        `SELECT timestamp, avg_price, min_price, max_price, data_points
         FROM hourly_averages
         WHERE timestamp >= ? AND timestamp <= ?
         ORDER BY timestamp ASC`
      )
      .bind(startTs, endTs)
      .all();

    return NextResponse.json({
      success: true,
      data: results.results,
    });
  } catch (error) {
    console.error("Error fetching hourly averages:", error);
    return NextResponse.json(
      { error: "Failed to fetch hourly averages" },
      { status: 500 }
    );
  }
}
