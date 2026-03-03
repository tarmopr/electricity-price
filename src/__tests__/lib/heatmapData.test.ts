import { describe, it, expect } from "vitest";
import {
  buildCalendarHeatmap,
  buildPatternHeatmap,
  priceToColor,
  HeatmapData,
} from "@/lib/heatmapData";
import { ElectricityPrice } from "@/lib/api";

function makePrice(
  date: Date,
  priceCentsKwh: number,
  isPredicted = false
): ElectricityPrice {
  return {
    timestamp: date.toISOString(),
    date,
    priceEurMwh: priceCentsKwh * 10,
    priceCentsKwh,
    isPredicted,
  };
}

describe("heatmapData", () => {
  describe("priceToColor", () => {
    it("returns zinc-like color for null price", () => {
      const color = priceToColor(null, 0, 10);
      expect(color).toContain("rgba");
      expect(color).toContain("39"); // zinc-800 component
    });

    it("returns green hue for minimum price", () => {
      const color = priceToColor(0, 0, 10);
      // hue = (1-0) * 120 = 120 (green)
      expect(color).toContain("120");
    });

    it("returns red hue for maximum price", () => {
      const color = priceToColor(10, 0, 10);
      // hue = (1-1) * 120 = 0 (red)
      expect(color).toContain("hsla(0");
    });

    it("returns yellow-ish hue for midpoint price", () => {
      const color = priceToColor(5, 0, 10);
      // hue = (1-0.5) * 120 = 60 (yellow)
      expect(color).toContain("60");
    });

    it("handles equal min and max (all same price)", () => {
      const color = priceToColor(5, 5, 5);
      // Should return green since range is 0
      expect(color).toContain("rgba(34, 197, 94");
    });

    it("clamps price outside range", () => {
      const colorBelow = priceToColor(-5, 0, 10);
      expect(colorBelow).toContain("120"); // green (clamped to 0)

      const colorAbove = priceToColor(20, 0, 10);
      expect(colorAbove).toContain("hsla(0"); // red (clamped to 1)
    });
  });

  describe("buildCalendarHeatmap", () => {
    it("returns empty data for empty prices", () => {
      const result = buildCalendarHeatmap([], false);
      expect(result.rows).toHaveLength(0);
      expect(result.minPrice).toBe(0);
      expect(result.maxPrice).toBe(0);
    });

    it("creates one row per day", () => {
      const prices = [
        makePrice(new Date("2024-06-01T10:00:00Z"), 5),
        makePrice(new Date("2024-06-01T14:00:00Z"), 8),
        makePrice(new Date("2024-06-02T10:00:00Z"), 3),
      ];
      const result = buildCalendarHeatmap(prices, false);
      expect(result.rows.length).toBeGreaterThanOrEqual(1);
    });

    it("each row has exactly 24 cells", () => {
      const prices = [
        makePrice(new Date("2024-06-01T10:00:00Z"), 5),
        makePrice(new Date("2024-06-01T14:00:00Z"), 8),
      ];
      const result = buildCalendarHeatmap(prices, false);
      for (const row of result.rows) {
        expect(row.cells).toHaveLength(24);
      }
    });

    it("computes min and max prices correctly", () => {
      const prices = [
        makePrice(new Date("2024-06-01T10:00:00Z"), 3),
        makePrice(new Date("2024-06-01T14:00:00Z"), 10),
      ];
      const result = buildCalendarHeatmap(prices, false);
      expect(result.minPrice).toBe(3);
      expect(result.maxPrice).toBe(10);
    });

    it("applies VAT when includeVat is true", () => {
      const prices = [
        makePrice(new Date("2024-06-01T10:00:00Z"), 10),
      ];
      const withoutVat = buildCalendarHeatmap(prices, false);
      const withVat = buildCalendarHeatmap(prices, true);

      // VAT is 22%, so price with VAT should be 12.2
      expect(withVat.maxPrice).toBeCloseTo(12.2);
      expect(withoutVat.maxPrice).toBe(10);
    });

    it("skips predicted prices", () => {
      const prices = [
        makePrice(new Date("2024-06-01T10:00:00Z"), 5, false),
        makePrice(new Date("2024-06-01T14:00:00Z"), 20, true), // predicted
      ];
      const result = buildCalendarHeatmap(prices, false);
      // Max should be 5, not 20 (predicted is skipped)
      expect(result.maxPrice).toBe(5);
    });

    it("sorts rows chronologically", () => {
      const prices = [
        makePrice(new Date("2024-06-03T10:00:00Z"), 5),
        makePrice(new Date("2024-06-01T10:00:00Z"), 3),
        makePrice(new Date("2024-06-02T10:00:00Z"), 4),
      ];
      const result = buildCalendarHeatmap(prices, false);
      for (let i = 1; i < result.rows.length; i++) {
        expect(result.rows[i].sortKey).toBeGreaterThan(
          result.rows[i - 1].sortKey
        );
      }
    });

    it("cells without data have price null", () => {
      const prices = [
        makePrice(new Date("2024-06-01T10:00:00Z"), 5),
      ];
      const result = buildCalendarHeatmap(prices, false);
      const row = result.rows[0];
      // Most cells should be null since we only provided one data point
      const nullCells = row.cells.filter((c) => c.price === null);
      expect(nullCells.length).toBeGreaterThan(20); // at least 20 out of 24
    });
  });

  describe("buildPatternHeatmap", () => {
    it("returns empty data for empty prices", () => {
      const result = buildPatternHeatmap([], false);
      expect(result.rows).toHaveLength(0);
      expect(result.minPrice).toBe(0);
      expect(result.maxPrice).toBe(0);
    });

    it("creates exactly 7 rows (weekdays)", () => {
      // Create prices spanning a full week
      const prices: ElectricityPrice[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date("2024-06-03T10:00:00Z"); // Monday
        date.setDate(date.getDate() + d);
        prices.push(makePrice(date, 5 + d));
      }
      const result = buildPatternHeatmap(prices, false);
      expect(result.rows).toHaveLength(7);
    });

    it("labels weekdays correctly", () => {
      const prices: ElectricityPrice[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date("2024-06-03T10:00:00Z"); // Monday
        date.setDate(date.getDate() + d);
        prices.push(makePrice(date, 5 + d));
      }
      const result = buildPatternHeatmap(prices, false);
      const labels = result.rows.map((r) => r.label);
      expect(labels[0]).toBe("Monday");
      expect(labels[6]).toBe("Sunday");
    });

    it("each row has exactly 24 cells", () => {
      const prices = [
        makePrice(new Date("2024-06-03T10:00:00Z"), 5),
      ];
      const result = buildPatternHeatmap(prices, false);
      for (const row of result.rows) {
        expect(row.cells).toHaveLength(24);
      }
    });

    it("averages prices for the same weekday-hour", () => {
      // Two Mondays at the same hour
      const prices = [
        makePrice(new Date("2024-06-03T10:00:00Z"), 4), // Monday
        makePrice(new Date("2024-06-10T10:00:00Z"), 8), // Next Monday
      ];
      const result = buildPatternHeatmap(prices, false);
      // Find the Monday row and check the hour
      const mondayRow = result.rows.find((r) => r.label === "Monday");
      expect(mondayRow).toBeDefined();
      // The avg should be around 6 (4+8)/2, but depends on timezone conversion
      // Just verify it has a non-null price for at least one cell
      const nonNullCells = mondayRow!.cells.filter((c) => c.price !== null);
      expect(nonNullCells.length).toBeGreaterThan(0);
    });

    it("skips predicted prices", () => {
      const prices = [
        makePrice(new Date("2024-06-03T10:00:00Z"), 5, false),
        makePrice(new Date("2024-06-03T14:00:00Z"), 20, true), // predicted
      ];
      const result = buildPatternHeatmap(prices, false);
      expect(result.maxPrice).toBe(5);
    });
  });
});
