import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getPricesWithPrediction } from "@/lib/prediction";

/** Elering-shaped payload of 15-minute points [start, end] (inclusive), price by index. */
function quarterHourPayload(startIso: string, endIso: string, price: (i: number) => number) {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  const ee: { timestamp: number; price: number }[] = [];
  for (let t = start, i = 0; t <= end; t += 15 * 60_000, i++) {
    ee.push({ timestamp: t / 1000, price: price(i) });
  }
  return { success: true, data: { ee } };
}

describe("getPricesWithPrediction", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("starts hourly predictions on the hour after 15-minute actuals (no gap, no offset)", async () => {
    // Official 15-min prices published through 21:45Z today
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(quarterHourPayload("2024-06-06T00:00:00Z", "2024-06-15T21:45:00Z", (i) => 50 + (i % 96))),
      })
    );

    const result = await getPricesWithPrediction(
      new Date("2024-06-15T12:00:00Z"),
      new Date("2024-06-16T20:59:59.999Z")
    );

    const actual = result.filter((p) => !p.isPredicted);
    const predicted = result.filter((p) => p.isPredicted);
    expect(actual[actual.length - 1].timestamp).toBe("2024-06-15T21:45:00.000Z");
    expect(predicted[0].timestamp).toBe("2024-06-15T22:00:00.000Z");
    expect(predicted[1].timestamp).toBe("2024-06-15T23:00:00.000Z");
    // Every prediction is aligned to a full hour
    expect(predicted.every((p) => p.date.getTime() % 3_600_000 === 0)).toBe(true);
    // Uses history from the same time yesterday / last week (not the fallback)
    expect(predicted[0].priceEurMwh).toBeGreaterThan(0);
  });

  it("keeps hourly actuals unchanged: predictions start one hour after the last point", async () => {
    const start = new Date("2024-06-06T00:00:00Z").getTime();
    const ee: { timestamp: number; price: number }[] = [];
    for (let t = start; t <= new Date("2024-06-15T21:00:00Z").getTime(); t += 3_600_000) {
      ee.push({ timestamp: t / 1000, price: 80 });
    }
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true, data: { ee } }) })
    );

    const result = await getPricesWithPrediction(
      new Date("2024-06-15T12:00:00Z"),
      new Date("2024-06-16T20:59:59.999Z")
    );
    const predicted = result.filter((p) => p.isPredicted);
    expect(predicted[0].timestamp).toBe("2024-06-15T22:00:00.000Z");
    expect(predicted[0].priceEurMwh).toBe(80);
  });
});
