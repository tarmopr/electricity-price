import { describe, it, expect } from "vitest";
import {
  findCheapestWindow,
  getCheapestWindowHours,
  computeWindowAverage,
  CheapestWindow,
} from "@/lib/cheapestWindow";

/**
 * Helper to create hourly price data starting at a given date/time.
 * Each entry is 1 hour apart.
 */
function makePrices(
  startDate: Date,
  pricesArray: number[]
): { timestamp: string; displayPrice: number }[] {
  return pricesArray.map((price, i) => {
    const ts = new Date(startDate.getTime() + i * 60 * 60 * 1000);
    return { timestamp: ts.toISOString(), displayPrice: price };
  });
}

describe("cheapestWindow", () => {
  describe("findCheapestWindow", () => {
    it("returns null for empty price data", () => {
      const result = findCheapestWindow([], 3, null, new Date());
      expect(result).toBeNull();
    });

    it("returns null for zero hours", () => {
      const prices = makePrices(new Date("2024-06-15T00:00:00Z"), [5, 10, 3]);
      const result = findCheapestWindow(prices, 0, null, new Date("2024-06-15T00:00:00Z"));
      expect(result).toBeNull();
    });

    it("returns null when not enough data for window size", () => {
      const prices = makePrices(new Date("2024-06-15T00:00:00Z"), [5, 10]);
      const result = findCheapestWindow(prices, 3, null, new Date("2024-06-15T00:00:00Z"));
      expect(result).toBeNull();
    });

    it("returns null when all data is before scanFrom", () => {
      const prices = makePrices(new Date("2024-06-15T00:00:00Z"), [5, 10, 3]);
      const result = findCheapestWindow(
        prices,
        2,
        null,
        new Date("2024-06-16T00:00:00Z")
      );
      expect(result).toBeNull();
    });

    it("finds the cheapest 3-hour window without constraints", () => {
      // Prices: [10, 8, 3, 2, 5, 12, 7]
      // Cheapest 3h = indices 2,3,4 → sum=10, avg=3.33
      const start = new Date("2024-06-15T00:00:00Z");
      const prices = makePrices(start, [10, 8, 3, 2, 5, 12, 7]);

      const result = findCheapestWindow(prices, 3, null, start);
      expect(result).not.toBeNull();
      expect(result!.hours).toBe(3);
      expect(result!.startIndex).toBe(2);
      expect(result!.endIndex).toBe(4);
      expect(result!.averagePrice).toBeCloseTo(10 / 3);
      expect(result!.startTimestamp).toBe(prices[2].timestamp);
    });

    it("finds cheapest 1-hour window (minimum price)", () => {
      const start = new Date("2024-06-15T00:00:00Z");
      const prices = makePrices(start, [10, 8, 3, 2, 5]);

      const result = findCheapestWindow(prices, 1, null, start);
      expect(result).not.toBeNull();
      expect(result!.startIndex).toBe(3);
      expect(result!.averagePrice).toBe(2);
    });

    it("handles window size equal to data length", () => {
      const start = new Date("2024-06-15T00:00:00Z");
      const prices = makePrices(start, [10, 5, 3]);

      const result = findCheapestWindow(prices, 3, null, start);
      expect(result).not.toBeNull();
      expect(result!.startIndex).toBe(0);
      expect(result!.endIndex).toBe(2);
      expect(result!.averagePrice).toBe(6); // (10+5+3)/3
    });

    // --- scanFrom tests (today vs tomorrow) ---

    it("scans from current hour for today scenario", () => {
      // 24 hours of data, 00:00 to 23:00
      // Make hour 2-4 very cheap, but scanFrom is hour 5 → should skip them
      const start = new Date("2024-06-15T00:00:00Z");
      const pricesArr: number[] = Array.from({ length: 24 }, (_, i) =>
        i >= 2 && i <= 4 ? 1 : 10
      );
      // Also make hours 10-12 cheap but not as cheap
      pricesArr[10] = 2;
      pricesArr[11] = 2;
      pricesArr[12] = 2;

      const prices = makePrices(start, pricesArr);

      // Scan from hour 5 — should find hours 10-12 as cheapest
      const scanFrom = new Date("2024-06-15T05:00:00Z");
      const result = findCheapestWindow(prices, 3, null, scanFrom);
      expect(result).not.toBeNull();
      expect(result!.startIndex).toBe(10);
      expect(result!.endIndex).toBe(12);
    });

    it("scans from 00:00 for tomorrow scenario", () => {
      // Data spans today and tomorrow
      const todayStart = new Date("2024-06-15T00:00:00Z");
      const todayPrices = Array.from({ length: 24 }, () => 10);
      const tomorrowPrices = [5, 3, 2, 4, 8, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10];

      const prices = makePrices(todayStart, [...todayPrices, ...tomorrowPrices]);

      // Scan from tomorrow 00:00
      const scanFrom = new Date("2024-06-16T00:00:00Z");
      const result = findCheapestWindow(prices, 3, null, scanFrom);
      expect(result).not.toBeNull();
      // Cheapest 3h in tomorrow: indices 1,2,3 → prices 3,2,4 → sum=9
      expect(result!.startIndex).toBe(25); // 24 (today) + 1
      expect(result!.averagePrice).toBe(3); // (3+2+4)/3
    });

    // --- untilHour constraint tests ---

    it("respects untilHour constraint", () => {
      // Hours 00-23 with prices, cheapest at end of day
      const start = new Date("2024-06-15T00:00:00Z");
      const pricesArr: number[] = Array.from({ length: 24 }, (_, i) =>
        i >= 20 ? 1 : 10
      );
      // Hours 20-23 are cheap, but untilHour=20 means window must end by 20:00
      // Make hours 5-7 somewhat cheap
      pricesArr[5] = 3;
      pricesArr[6] = 3;
      pricesArr[7] = 3;

      const prices = makePrices(start, pricesArr);

      const result = findCheapestWindow(prices, 3, 20, start);
      expect(result).not.toBeNull();
      // Should find hours 5-7 since hours 20+ are excluded by untilHour
      expect(result!.startIndex).toBe(5);
      expect(result!.endIndex).toBe(7);
    });

    it("returns null when no window fits within untilHour", () => {
      // Only 2 hours of data, need 3 hours, untilHour=2
      const start = new Date("2024-06-15T00:00:00Z");
      const prices = makePrices(start, [5, 5]);

      const result = findCheapestWindow(prices, 3, 2, start);
      expect(result).toBeNull();
    });

    it("allows window when untilHour is null (no limit)", () => {
      const start = new Date("2024-06-15T20:00:00Z");
      const prices = makePrices(start, [10, 5, 3, 2]);

      const result = findCheapestWindow(prices, 3, null, start);
      expect(result).not.toBeNull();
      expect(result!.startIndex).toBe(1);
      expect(result!.averagePrice).toBeCloseTo(10 / 3);
    });

    it("handles untilHour that rolls over to next day", () => {
      // Data starts at 20:00 UTC = 22:00 Tallinn (EET, UTC+2, January).
      // untilHour=2 means 02:00 Tallinn = 00:00 UTC next day (4 Tallinn-hours away).
      const start = new Date("2024-01-15T20:00:00Z"); // 22:00 Tallinn
      const prices = makePrices(start, [10, 5, 3, 2, 8]); // Tallinn: 22, 23, 00, 01, 02

      const result = findCheapestWindow(prices, 2, 2, start);
      expect(result).not.toBeNull();
      // Window 00:00-01:00 Tallinn (sum=5) is cheapest; 01:00-02:00 is excluded (ends after limit)
      expect(result!.startIndex).toBe(2);
      expect(result!.endIndex).toBe(3);
    });

    // --- endTimestamp tests ---

    it("sets endTimestamp from next data point when available", () => {
      const start = new Date("2024-06-15T00:00:00Z");
      const prices = makePrices(start, [5, 3, 10, 8]);

      const result = findCheapestWindow(prices, 2, null, start);
      expect(result).not.toBeNull();
      // Cheapest 2h: indices 0,1 → endTimestamp should be prices[2].timestamp
      expect(result!.endTimestamp).toBe(prices[2].timestamp);
    });

    it("computes endTimestamp by adding 1h when at end of data", () => {
      const start = new Date("2024-06-15T00:00:00Z");
      const prices = makePrices(start, [10, 5, 3]);

      const result = findCheapestWindow(prices, 2, null, start);
      expect(result).not.toBeNull();
      // Cheapest 2h: indices 1,2 → no prices[3], so endTimestamp = prices[2] + 1h
      const expectedEnd = new Date(
        new Date(prices[2].timestamp).getTime() + 60 * 60 * 1000
      ).toISOString();
      expect(result!.endTimestamp).toBe(expectedEnd);
    });

    it("handles negative prices", () => {
      const start = new Date("2024-06-15T00:00:00Z");
      const prices = makePrices(start, [5, -3, -5, 2, 10]);

      const result = findCheapestWindow(prices, 2, null, start);
      expect(result).not.toBeNull();
      expect(result!.startIndex).toBe(1);
      expect(result!.averagePrice).toBe(-4); // (-3 + -5) / 2
    });
  });

  describe("computeWindowAverage", () => {
    it("returns null for empty prices", () => {
      expect(computeWindowAverage([], 3, new Date())).toBeNull();
    });

    it("returns null for zero duration", () => {
      const prices = makePrices(new Date("2024-06-15T00:00:00Z"), [5, 10, 3]);
      expect(
        computeWindowAverage(prices, 0, new Date("2024-06-15T00:00:00Z"))
      ).toBeNull();
    });

    it("returns null when scanFrom is after all data", () => {
      const prices = makePrices(new Date("2024-06-15T00:00:00Z"), [5, 10, 3]);
      expect(
        computeWindowAverage(prices, 2, new Date("2024-06-16T00:00:00Z"))
      ).toBeNull();
    });

    it("computes average over a 3-hour window", () => {
      const start = new Date("2024-06-15T00:00:00Z");
      const prices = makePrices(start, [10, 8, 3, 2, 5, 12, 7]);
      // Window from 00:00, 3 hours → prices 10, 8, 3
      expect(computeWindowAverage(prices, 3, start)).toBeCloseTo(7);
    });

    it("computes average starting from mid-data", () => {
      const start = new Date("2024-06-15T00:00:00Z");
      const prices = makePrices(start, [10, 8, 3, 2, 5, 12, 7]);
      const scanFrom = new Date("2024-06-15T03:00:00Z");
      // Window from 03:00, 3 hours → prices 2, 5, 12
      expect(computeWindowAverage(prices, 3, scanFrom)).toBeCloseTo(19 / 3);
    });

    it("averages available points when window extends beyond data", () => {
      const start = new Date("2024-06-15T00:00:00Z");
      const prices = makePrices(start, [10, 8, 3]);
      // Window from 01:00, 5 hours → only 01, 02 have data → prices 8, 3
      expect(
        computeWindowAverage(prices, 5, new Date("2024-06-15T01:00:00Z"))
      ).toBeCloseTo(5.5);
    });

    it("returns single price when window contains one point", () => {
      const start = new Date("2024-06-15T00:00:00Z");
      const prices = makePrices(start, [10, 8, 3]);
      expect(
        computeWindowAverage(prices, 1, new Date("2024-06-15T01:00:00Z"))
      ).toBe(8);
    });

    it("handles negative prices", () => {
      const start = new Date("2024-06-15T00:00:00Z");
      const prices = makePrices(start, [-5, -3, 2]);
      expect(computeWindowAverage(prices, 2, start)).toBe(-4);
    });

    it("returns null for negative duration", () => {
      const prices = makePrices(new Date("2024-06-15T00:00:00Z"), [5, 10, 3]);
      expect(
        computeWindowAverage(prices, -2, new Date("2024-06-15T00:00:00Z"))
      ).toBeNull();
    });

    it("returns different averages for different durations", () => {
      const start = new Date("2024-06-15T00:00:00Z");
      const prices = makePrices(start, [2, 4, 10, 20]);
      // 2 hours → (2 + 4) / 2 = 3
      expect(computeWindowAverage(prices, 2, start)).toBe(3);
      // 4 hours → (2 + 4 + 10 + 20) / 4 = 9
      expect(computeWindowAverage(prices, 4, start)).toBe(9);
    });
  });

  describe("getCheapestWindowHours", () => {
    it("returns empty set when window is null", () => {
      const result = getCheapestWindowHours(null);
      expect(result.size).toBe(0);
    });

    it("returns correct number of keys for a window", () => {
      const start = new Date("2024-06-15T10:00:00Z");
      const prices = makePrices(start, [5, 3, 2, 8, 10]);

      const window: CheapestWindow = {
        startTimestamp: prices[1].timestamp,
        endTimestamp: prices[3].timestamp,
        startHour: 11,
        hours: 2,
        averagePrice: 2.5,
        startIndex: 1,
        endIndex: 2,
      };

      const result = getCheapestWindowHours(window);
      expect(result.size).toBe(2);
    });

    it("generates keys spanning midnight correctly", () => {
      const start = new Date("2024-06-15T22:00:00Z");
      const prices = makePrices(start, [5, 3, 2, 8]);

      const window: CheapestWindow = {
        startTimestamp: prices[0].timestamp,
        endTimestamp: prices[3].timestamp,
        startHour: 22,
        hours: 3,
        averagePrice: 3.33,
        startIndex: 0,
        endIndex: 2,
      };

      const result = getCheapestWindowHours(window);
      // 3 hours starting at 22:00 UTC → covers 3 distinct hour keys
      expect(result.size).toBe(3);
    });

    it("generates correct count for an 8-hour window", () => {
      const start = new Date("2024-06-15T00:00:00Z");
      const prices = makePrices(start, Array.from({ length: 24 }, () => 5));

      const window: CheapestWindow = {
        startTimestamp: prices[2].timestamp,
        endTimestamp: prices[10].timestamp,
        startHour: 2,
        hours: 8,
        averagePrice: 5,
        startIndex: 2,
        endIndex: 9,
      };

      const result = getCheapestWindowHours(window);
      expect(result.size).toBe(8);
    });
  });
});
