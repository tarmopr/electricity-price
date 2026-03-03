import { NextRequest, NextResponse } from "next/server";
import { ELERING_API, errorResponse } from "@/lib/elering";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end) {
    return errorResponse("Missing required query parameters: start, end", 400);
  }

  try {
    const eleringUrl = `${ELERING_API}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
    const res = await fetch(eleringUrl, { cache: "no-store" });

    if (!res.ok) {
      const errText = await res.text();
      return errorResponse(
        `Elering API error: ${res.status} ${res.statusText}`,
        res.status,
        errText
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error proxying to Elering API:", error);
    return errorResponse("Failed to fetch prices from Elering", 502);
  }
}
