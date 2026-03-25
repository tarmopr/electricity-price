import { NextRequest, NextResponse } from "next/server";
import { fetchFromElering, errorResponse } from "@/lib/elering";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end) {
    return errorResponse("Missing required query parameters: start, end", 400);
  }

  const startDate = new Date(start);
  const endDate = new Date(end);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return errorResponse("Invalid date format", 400);
  }

  try {
    const prices = await fetchFromElering(startDate, endDate);
    return NextResponse.json({
      success: true,
      data: {
        ee: prices.map(p => ({ timestamp: p.timestamp, price: p.priceEurMwh })),
      },
    });
  } catch (error) {
    console.error("Error proxying to Elering API:", error);
    return errorResponse("Failed to fetch prices from Elering", 502);
  }
}
