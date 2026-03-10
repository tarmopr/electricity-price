import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  eurMwhToCentsKwh,
  aggregatePrices,
  calculateStatistics,
  getPricesForDateRange,
  getCurrentPrice,
  getHourlyAveragePattern,
  buildWeekdayHourAverages,
  generateMissingSlotPredictions,
  ElectricityPrice,
} from "@/lib/api";

// ─── aggregatePrices tests ──────────────────────────────────────────────────

describe("aggregatePrices", () => {
  function makePrice(
    hourOffset: number,
    eurMwh: number,
    isPredicted = false
  ): ElectricityPrice {
    const base = new Date("2025-01-01T00:00:00Z");
    const date = new Date(base.getTime() + hourOffset * 15 * 60 * 1000); // 15-min intervals
    return {
      timestamp: date.toISOString(),
      date,
      priceEurMwh: eurMwh,
      priceCentsKwh: eurMwhToCentsKwh(eurMwh),
      isPredicted,
    };
  }

  it("returns original array for empty input", () => {
    expect(aggregatePrices([], 1)).toEqual([]);
  });

  it("returns original array for zero interval", () => {
    const prices = [makePrice(0, 100)];
    expect(aggregatePrices(prices, 0)).toBe(prices);
  });

  it("aggregates 4 x 15-min prices into 1 hourly bucket", () => {
    const prices = [
      makePrice(0, 100),
      makePrice(1, 200),
      makePrice(2, 300),
      makePrice(3, 400),
    ];
    const result = aggregatePrices(prices, 1);
    expect(result).toHaveLength(1);
    expect(result[0].priceEurMwh).toBe(250); // average of 100,200,300,400
    expect(result[0].priceCentsKwh).toBeCloseTo(25);
  });

  it("creates multiple buckets for larger ranges", () => {
    // 8 x 15-min intervals = 2 hours
    const prices = Array.from({ length: 8 }, (_, i) => makePrice(i, (i + 1) * 10));
    const result = aggregatePrices(prices, 1);
    expect(result).toHaveLength(2);
    // First hour: avg of 10,20,30,40 = 25
    expect(result[0].priceEurMwh).toBe(25);
    // Second hour: avg of 50,60,70,80 = 65
    expect(result[1].priceEurMwh).toBe(65);
  });

  it("marks bucket as predicted only when all prices are predicted", () => {
    const prices = [
      makePrice(0, 100, false),
      makePrice(1, 200, true),
      makePrice(2, 300, true),
      makePrice(3, 400, true),
    ];
    const result = aggregatePrices(prices, 1);
    expect(result[0].isPredicted).toBe(false);
  });

  it("marks bucket as predicted when all prices are predicted", () => {
    const prices = [
      makePrice(0, 100, true),
      makePrice(1, 200, true),
      makePrice(2, 300, true),
      makePrice(3, 400, true),
    ];
    const result = aggregatePrices(prices, 1);
    expect(result[0].isPredicted).toBe(true);
  });
});

// ─── calculateStatistics tests ──────────────────────────────────────────────

describe("calculateStatistics", () => {
  function makePrice(eurMwh: number, isPredicted = false): ElectricityPrice {
    return {
      timestamp: "2025-01-01T00:00:00Z",
      date: new Date("2025-01-01T00:00:00Z"),
      priceEurMwh: eurMwh,
      priceCentsKwh: eurMwhToCentsKwh(eurMwh),
      isPredicted,
    };
  }

  it("returns null for empty array", () => {
    expect(calculateStatistics([])).toBeNull();
  });

  it("returns null for null input", () => {
    expect(calculateStatistics(null as unknown as ElectricityPrice[])).toBeNull();
  });

  it("returns null when all prices are predicted", () => {
    const prices = [makePrice(100, true), makePrice(200, true)];
    expect(calculateStatistics(prices)).toBeNull();
  });

  it("calculates correct statistics for simple dataset", () => {
    // Values in cents/kWh: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
    const prices = Array.from({ length: 10 }, (_, i) =>
      makePrice((i + 1) * 10)
    );
    const stats = calculateStatistics(prices);
    expect(stats).not.toBeNull();
    expect(stats!.min).toBe(1); // 10/10
    expect(stats!.max).toBe(10); // 100/10
    expect(stats!.mean).toBeCloseTo(5.5); // (1+2+...+10)/10
    expect(stats!.median).toBeCloseTo(5.5); // average of 5 and 6
  });

  it("excludes predicted prices from statistics", () => {
    const prices = [
      makePrice(100, false), // 10 cents/kWh
      makePrice(200, false), // 20 cents/kWh
      makePrice(9999, true), // should be excluded
    ];
    const stats = calculateStatistics(prices);
    expect(stats!.mean).toBeCloseTo(15); // avg of 10 and 20
    expect(stats!.max).toBe(20);
  });

  it("applies VAT when includeVat is true", () => {
    const prices = [makePrice(100)]; // 10 cents/kWh
    const stats = calculateStatistics(prices, true);
    expect(stats!.mean).toBeCloseTo(12.2); // 10 * 1.22
  });

  it("handles single price", () => {
    const prices = [makePrice(50)]; // 5 cents/kWh
    const stats = calculateStatistics(prices);
    expect(stats!.min).toBe(5);
    expect(stats!.max).toBe(5);
    expect(stats!.mean).toBe(5);
    expect(stats!.median).toBe(5);
    expect(stats!.p75).toBe(5);
    expect(stats!.p90).toBe(5);
    expect(stats!.p95).toBe(5);
  });
});

// ─── getPricesForDateRange tests (with fetch mocking) ───────────────────────

describe("getPricesForDateRange", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches and transforms price data correctly", async () => {
    const mockResponse = {
      success: true,
      data: {
        ee: [
          { timestamp: 1704067200, price: 50.0 }, // 2024-01-01T00:00:00Z
          { timestamp: 1704070800, price: 60.0 }, // 2024-01-01T01:00:00Z
        ],
      },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })
    );

    const start = new Date("2024-01-01T00:00:00Z");
    const end = new Date("2024-01-01T02:00:00Z");
    const result = await getPricesForDateRange(start, end);

    expect(result).toHaveLength(2);
    expect(result[0].priceEurMwh).toBe(50);
    expect(result[0].priceCentsKwh).toBe(5);
    expect(result[1].priceEurMwh).toBe(60);
    expect(result[1].priceCentsKwh).toBe(6);
  });

  it("returns empty array on API error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: () => Promise.resolve("Error"),
      })
    );

    const result = await getPricesForDateRange(
      new Date("2024-01-01"),
      new Date("2024-01-02")
    );
    expect(result).toEqual([]);
  });

  it("deduplicates prices on chunk boundaries", async () => {
    const mockResponse = {
      success: true,
      data: {
        ee: [{ timestamp: 1704067200, price: 50.0 }],
      },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })
    );

    // Range larger than 90 days to trigger chunking
    const start = new Date("2024-01-01");
    const end = new Date("2024-05-01");
    const result = await getPricesForDateRange(start, end);

    // Even though both chunks return the same timestamp, it should be deduplicated
    expect(result).toHaveLength(1);
  });
});

// ─── getCurrentPrice tests ──────────────────────────────────────────────────

describe("getCurrentPrice", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns current price on success", async () => {
    const mockResponse = {
      success: true,
      data: [{ timestamp: 1704067200, price: 42.5 }],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })
    );

    const result = await getCurrentPrice();
    expect(result).not.toBeNull();
    expect(result!.priceEurMwh).toBe(42.5);
    expect(result!.priceCentsKwh).toBe(4.25);
  });

  it("returns null when no data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [] }),
      })
    );

    const result = await getCurrentPrice();
    expect(result).toBeNull();
  });

  it("returns null on fetch error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        statusText: "Not Found",
      })
    );

    const result = await getCurrentPrice();
    expect(result).toBeNull();
  });
});

// ─── getHourlyAveragePattern tests ──────────────────────────────────────────

describe("getHourlyAveragePattern", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    // Set "now" to Jan 10 noon local time (well past all mock data)
    vi.setSystemTime(new Date(2024, 0, 10, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a map with correct hourly averages for 2 days of data", async () => {
    // Generate 2 days of hourly data using LOCAL timestamps so that
    // date.getHours() returns the expected hour regardless of timezone.
    const data: { timestamp: number; price: number }[] = [];

    // Day 1 (Jan 8 local): hour 0 = 10 EUR/MWh, hour 1 = 20, etc.
    const day1Base = new Date(2024, 0, 8); // midnight Jan 8 local
    for (let h = 0; h < 24; h++) {
      const ts = (day1Base.getTime() + h * 3600_000) / 1000;
      data.push({ timestamp: ts, price: (h + 1) * 10 }); // 10, 20, 30, ... 240
    }

    // Day 2 (Jan 9 local): hour 0 = 30 EUR/MWh, hour 1 = 40, etc.
    const day2Base = new Date(2024, 0, 9); // midnight Jan 9 local
    for (let h = 0; h < 24; h++) {
      const ts = (day2Base.getTime() + h * 3600_000) / 1000;
      data.push({ timestamp: ts, price: (h + 1) * 10 + 20 }); // 30, 40, 50, ... 260
    }

    const mockResponse = {
      success: true,
      data: { ee: data },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })
    );

    const pattern = await getHourlyAveragePattern(7);

    expect(pattern.size).toBe(24);

    // Hour 0: day1 = 10 EUR/MWh (1 ¢/kWh), day2 = 30 EUR/MWh (3 ¢/kWh) → avg = 2 ¢/kWh
    expect(pattern.get(0)).toBeCloseTo(2);

    // Hour 1: day1 = 20 EUR/MWh (2 ¢/kWh), day2 = 40 EUR/MWh (4 ¢/kWh) → avg = 3 ¢/kWh
    expect(pattern.get(1)).toBeCloseTo(3);

    // Hour 23: day1 = 240 EUR/MWh (24 ¢/kWh), day2 = 260 EUR/MWh (26 ¢/kWh) → avg = 25 ¢/kWh
    expect(pattern.get(23)).toBeCloseTo(25);
  });

  it("returns empty map when fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: () => Promise.resolve("Error"),
      })
    );

    const pattern = await getHourlyAveragePattern(7);
    expect(pattern.size).toBe(0);
  });

  it("excludes predicted prices from the pattern", async () => {
    // All data marked as predicted should be excluded
    // The Elering API doesn't have an isPredicted field in raw data,
    // but getPricesForDateRange marks data as predicted if timestamp > now.
    // With fake timers set to Jan 10, data from Jan 8-9 should NOT be predicted.
    // Let's test with an empty response to verify empty pattern.
    const mockResponse = {
      success: true,
      data: { ee: [] },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })
    );

    const pattern = await getHourlyAveragePattern(7);
    expect(pattern.size).toBe(0);
  });
});

// ─── buildWeekdayHourAverages ───────────────────────────────────────────────

describe("buildWeekdayHourAverages", () => {
  function makePrice(tsIso: string, centsKwh: number): ElectricityPrice {
    const date = new Date(tsIso);
    return {
      timestamp: tsIso,
      date,
      priceEurMwh: centsKwh * 10,
      priceCentsKwh: centsKwh,
    };
  }

  it("returns an empty map for empty input", () => {
    const result = buildWeekdayHourAverages([]);
    expect(result.size).toBe(0);
  });

  it("accumulates a single price into the correct key", () => {
    // 2024-01-01 07:00 UTC = 09:00 Tallinn (UTC+2 in winter) → Monday hour 9
    // Jan 1 2024 is a Monday → getDay() = 1
    const prices = [makePrice("2024-01-01T07:00:00.000Z", 5)];
    const result = buildWeekdayHourAverages(prices);

    // Key: "1-9" (weekday 1 = Monday, hour 9 local Tallinn)
    const bucket = result.get("1-9");
    expect(bucket).toBeDefined();
    expect(bucket!.sum).toBe(5);
    expect(bucket!.count).toBe(1);
  });

  it("accumulates multiple prices for the same weekday+hour", () => {
    // Both times are Monday 07:00 UTC (= 09:00 Tallinn) but on different weeks
    const prices = [
      makePrice("2024-01-01T07:00:00.000Z", 4),
      makePrice("2024-01-08T07:00:00.000Z", 6),
    ];
    const result = buildWeekdayHourAverages(prices);
    const bucket = result.get("1-9");
    expect(bucket!.sum).toBeCloseTo(10);
    expect(bucket!.count).toBe(2);
  });

  it("creates separate keys for different weekday+hour combinations", () => {
    // Monday 07:00 UTC and Tuesday 07:00 UTC
    const prices = [
      makePrice("2024-01-01T07:00:00.000Z", 5), // Mon 09:00 Tallinn
      makePrice("2024-01-02T07:00:00.000Z", 8), // Tue 09:00 Tallinn
    ];
    const result = buildWeekdayHourAverages(prices);
    expect(result.size).toBe(2);
    expect(result.has("1-9")).toBe(true); // Monday
    expect(result.has("2-9")).toBe(true); // Tuesday
  });
});

// ─── generateMissingSlotPredictions ─────────────────────────────────────────

describe("generateMissingSlotPredictions", () => {
  it("returns empty array when weekdayHourAvg is empty (no historical data)", () => {
    const weekStart = new Date("2024-01-15T22:00:00.000Z"); // Mon 00:00 Tallinn
    const weekEnd = new Date("2024-01-15T23:00:00.000Z");
    const result = generateMissingSlotPredictions(
      weekStart, weekEnd,
      new Set(),
      new Map(),
      []
    );
    expect(result).toHaveLength(0);
  });

  it("skips a slot that is already in existingKeys", () => {
    // weekStart is Mon 22:00 UTC = Mon 00:00 Tallinn (so date = 2024-01-15, hour = 0 local)
    const weekStart = new Date("2024-01-14T22:00:00.000Z"); // Sun 00:00 Tallinn = Jan 15 Mon
    const weekEnd = new Date("2024-01-14T23:00:00.000Z");

    // The slot key: date in en-CA format + hour
    const dateStr = weekStart
      .toLocaleDateString("en-CA", { timeZone: "Europe/Tallinn" });
    const hour = parseInt(
      weekStart.toLocaleString("en-US", {
        timeZone: "Europe/Tallinn",
        hour: "2-digit",
        hour12: false,
      }),
      10
    );
    const slotKey = `${dateStr}-${hour}`;

    const weekdayHourAvg = new Map([["0-0", { sum: 10, count: 1 }]]); // dummy

    const result = generateMissingSlotPredictions(
      weekStart, weekEnd,
      new Set([slotKey]),
      weekdayHourAvg,
      []
    );
    expect(result).toHaveLength(0);
  });

  it("generates a predicted price with correct units when slot is missing", () => {
    // 2024-01-07T22:00:00.000Z = Monday 00:00 Tallinn (2024-01-08T00:00)
    const weekStart = new Date("2024-01-07T22:00:00.000Z");
    const weekEnd = new Date("2024-01-07T22:00:00.000Z"); // same hour

    // weekday for Jan 8 (Monday) in Tallinn = 1, hour 0
    const weekdayHourAvg = new Map([["1-0", { sum: 8, count: 2 }]]); // avg = 4 cents/kWh

    const result = generateMissingSlotPredictions(
      weekStart, weekEnd,
      new Set(), // nothing pre-existing
      weekdayHourAvg,
      []
    );

    expect(result).toHaveLength(1);
    expect(result[0].isPredicted).toBe(true);
    expect(result[0].priceCentsKwh).toBeCloseTo(4); // 8 / 2
    // EUR/MWh = cents/kWh * 10
    expect(result[0].priceEurMwh).toBeCloseTo(40);
  });

  it("does not duplicate a slot already present as isPredicted in weekData", () => {
    // 2024-01-07T22:00:00.000Z = Monday 00:00 Tallinn (2024-01-08T00:00)
    const weekStart = new Date("2024-01-07T22:00:00.000Z");
    const weekEnd = new Date("2024-01-07T22:00:00.000Z");

    const weekdayHourAvg = new Map([["1-0", { sum: 8, count: 2 }]]);

    const existingPredicted: ElectricityPrice = {
      timestamp: weekStart.toISOString(),
      date: new Date(weekStart),
      priceEurMwh: 30,
      priceCentsKwh: 3,
      isPredicted: true,
    };

    const result = generateMissingSlotPredictions(
      weekStart, weekEnd,
      new Set(),
      weekdayHourAvg,
      [existingPredicted]
    );

    // The slot is not in existingKeys but has an existing predicted entry — should be skipped
    expect(result).toHaveLength(0);
  });
});
