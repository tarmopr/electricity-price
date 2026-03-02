import { NextRequest, NextResponse } from "next/server";

const ELERING_API = "https://dashboard.elering.ee/api/nps/price";

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
    const eleringUrl = `${ELERING_API}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
    const res = await fetch(eleringUrl, { cache: "no-store" });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: `Elering API error: ${res.status} ${res.statusText}`, details: errText },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error proxying to Elering API:", error);
    return NextResponse.json(
      { error: "Failed to fetch prices from Elering" },
      { status: 502 }
    );
  }
}
