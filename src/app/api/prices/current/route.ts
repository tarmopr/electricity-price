import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "edge";

const ELERING_API = "https://dashboard.elering.ee/api/nps/price";

export async function GET() {
  // Try D1 first, fall back to Elering API
  try {
    const db = await getDB();
    const now = Math.floor(Date.now() / 1000);
    // Find the most recent 15-min slot at or before now
    const result = await db
      .prepare(
        `SELECT timestamp, price_eur_mwh as price
         FROM prices
         WHERE timestamp <= ?
         ORDER BY timestamp DESC
         LIMIT 1`
      )
      .bind(now)
      .first<{ timestamp: number; price: number }>();

    if (result) {
      // Return in the same shape as the Elering API for compatibility
      return NextResponse.json({
        success: true,
        data: [{ timestamp: result.timestamp, price: result.price }],
      });
    }
  } catch {
    // D1 unavailable or empty — fall through to Elering
  }

  // Fallback: fetch directly from Elering
  try {
    const res = await fetch(`${ELERING_API}/EE/current`, { cache: "no-store" });

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
    console.error("Error fetching current price:", error);
    return NextResponse.json(
      { error: "Failed to fetch current price" },
      { status: 502 }
    );
  }
}
