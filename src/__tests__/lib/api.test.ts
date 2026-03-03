import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  convertEurMwhToCentsKwh,
  applyVat,
  aggregatePrices,
  calculateStatistics,
  getPricesForDateRange,
  getCurrentPrice,
  ElectricityPrice,
} from "@/lib/api";

// ─── Pure function tests ────────────────────────────────────────────────────

describe("convertEurMwhToCentsKwh", () => {
  it("converts 100 EUR/MWh to 10 cents/kWh", () => {
    expect(convertEurMwhToCentsKwh(100)).toBe(10);
  });

  it("converts 0 EUR/MWh to 0 cents/kWh", () => {
    expect(convertEurMwhToCentsKwh(0)).toBe(0);
  });

  it("handles negative prices", () => {
    expect(convertEurMwhToCentsKwh(-50)).toBe(-5);
  });

  it("handles decimal values", () => {
    expect(convertEurMwhToCentsKwh(123.45)).toBeCloseTo(12.345);
  });
});

describe("applyVat", () => {
  it("applies default 22% VAT", () => {
    expect(applyVat(100)).toBeCloseTo(122);
  });

  it("applies custom VAT rate", () => {
    expect(applyVat(100, 0.1)).toBeCloseTo(110);
  });

  it("handles zero price", () => {
    expect(applyVat(0)).toBe(0);
  });

  it("handles negative price", () => {
    expect(applyVat(-10)).toBeCloseTo(-12.2);
  });

  it("handles zero VAT rate", () => {
    expect(applyVat(100, 0)).toBe(100);
  });
});

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
      priceCentsKwh: convertEurMwhToCentsKwh(eurMwh),
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
      priceCentsKwh: convertEurMwhToCentsKwh(eurMwh),
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
