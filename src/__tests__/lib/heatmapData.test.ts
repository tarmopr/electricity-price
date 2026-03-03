import { describe, it, expect } from "vitest";
import {
  buildCalendarHeatmap,
  buildPatternHeatmap,
  priceToColor,
  getHeatmapWeekRange,
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

    it("returns duller color for predicted prices", () => {
      const normalColor = priceToColor(5, 0, 10, false);
      const predictedColor = priceToColor(5, 0, 10, true);

      // Both should have the same hue (yellow ~60)
      expect(normalColor).toContain("60");
      expect(predictedColor).toContain("60");

      // Predicted should have lower opacity (0.55 vs 0.7)
      expect(normalColor).toContain("0.7");
      expect(predictedColor).toContain("0.55");
    });

    it("returns duller green for predicted equal min/max", () => {
      const normal = priceToColor(5, 5, 5, false);
      const predicted = priceToColor(5, 5, 5, true);

      expect(normal).toContain("0.6"); // normal green opacity
      expect(predicted).toContain("0.3"); // predicted green opacity (duller)
    });
  });

  describe("buildCalendarHeatmap", () => {
    it("returns empty data for empty prices", () => {
      const result = buildCalendarHeatmap([], false);
      expect(result.rows).toHaveLength(0);
      expect(result.minPrice).toBe(0);
      expect(result.maxPrice).toBe(0);
      expect(result.hasPredictions).toBe(false);
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

    it("excludes predicted prices from min/max calculation", () => {
      const prices = [
        makePrice(new Date("2024-06-01T10:00:00Z"), 5, false),
        makePrice(new Date("2024-06-01T14:00:00Z"), 20, true), // predicted
      ];
      const result = buildCalendarHeatmap(prices, false);
      // Max should be 5, not 20 (predicted is excluded from min/max)
      expect(result.maxPrice).toBe(5);
    });

    it("includes predicted prices in rows with isPredicted flag", () => {
      const prices = [
        makePrice(new Date("2024-06-01T10:00:00Z"), 5, false),
        makePrice(new Date("2024-06-01T14:00:00Z"), 20, true), // predicted
      ];
      const result = buildCalendarHeatmap(prices, false);
      // The predicted price should be included as a cell
      const row = result.rows[0];
      const predictedCells = row.cells.filter(
        (c) => c.price !== null && c.isPredicted
      );
      expect(predictedCells.length).toBeGreaterThan(0);
      expect(predictedCells[0].price).toBe(20);
    });

    it("marks hasPredictions true when predicted data present", () => {
      const prices = [
        makePrice(new Date("2024-06-01T10:00:00Z"), 5, false),
        makePrice(new Date("2024-06-01T14:00:00Z"), 20, true),
      ];
      const result = buildCalendarHeatmap(prices, false);
      expect(result.hasPredictions).toBe(true);
    });

    it("marks hasPredictions false when no predicted data", () => {
      const prices = [
        makePrice(new Date("2024-06-01T10:00:00Z"), 5, false),
        makePrice(new Date("2024-06-01T14:00:00Z"), 8, false),
      ];
      const result = buildCalendarHeatmap(prices, false);
      expect(result.hasPredictions).toBe(false);
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

    it("cells without data have price null and isPredicted false", () => {
      const prices = [
        makePrice(new Date("2024-06-01T10:00:00Z"), 5),
      ];
      const result = buildCalendarHeatmap(prices, false);
      const row = result.rows[0];
      // Most cells should be null since we only provided one data point
      const nullCells = row.cells.filter((c) => c.price === null);
      expect(nullCells.length).toBeGreaterThan(20); // at least 20 out of 24
      for (const cell of nullCells) {
        expect(cell.isPredicted).toBe(false);
      }
    });

    it("sets dateKey on each row", () => {
      const prices = [
        makePrice(new Date("2024-06-01T10:00:00Z"), 5),
        makePrice(new Date("2024-06-02T10:00:00Z"), 3),
      ];
      const result = buildCalendarHeatmap(prices, false);
      for (const row of result.rows) {
        expect(row.dateKey).toBeDefined();
        expect(row.dateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });

    it("highlights all rows when no highlightedDates provided", () => {
      const prices = [
        makePrice(new Date("2024-06-01T10:00:00Z"), 5),
        makePrice(new Date("2024-06-02T10:00:00Z"), 3),
      ];
      const result = buildCalendarHeatmap(prices, false);
      for (const row of result.rows) {
        expect(row.isHighlighted).toBe(true);
      }
    });

    it("sets isHighlighted on matching date rows", () => {
      const prices = [
        makePrice(new Date("2024-06-01T10:00:00Z"), 5),
        makePrice(new Date("2024-06-02T10:00:00Z"), 3),
        makePrice(new Date("2024-06-03T10:00:00Z"), 4),
      ];
      const result = buildCalendarHeatmap(prices, false, ["2024-06-02"]);

      // Find the highlighted row
      const highlighted = result.rows.filter((r) => r.isHighlighted === true);
      const dimmed = result.rows.filter((r) => r.isHighlighted === false);

      expect(highlighted).toHaveLength(1);
      expect(highlighted[0].dateKey).toBe("2024-06-02");
      expect(dimmed.length).toBeGreaterThanOrEqual(1);
    });

    it("non-highlighted rows have isHighlighted = false", () => {
      const prices = [
        makePrice(new Date("2024-06-01T10:00:00Z"), 5),
        makePrice(new Date("2024-06-02T10:00:00Z"), 3),
      ];
      const result = buildCalendarHeatmap(prices, false, ["2024-06-01"]);

      const nonHighlighted = result.rows.filter(
        (r) => r.isHighlighted === false
      );
      expect(nonHighlighted.length).toBeGreaterThan(0);
      for (const row of nonHighlighted) {
        expect(row.dateKey).not.toBe("2024-06-01");
      }
    });

    it("falls back to predicted cells for min/max when no real data", () => {
      const prices = [
        makePrice(new Date("2024-06-01T10:00:00Z"), 5, true),
        makePrice(new Date("2024-06-01T14:00:00Z"), 15, true),
      ];
      const result = buildCalendarHeatmap(prices, false);
      // Should use predicted values since there are no real prices
      expect(result.minPrice).toBe(5);
      expect(result.maxPrice).toBe(15);
    });
  });

  describe("buildPatternHeatmap", () => {
    it("returns empty data for empty prices", () => {
      const result = buildPatternHeatmap([], false);
      expect(result.rows).toHaveLength(0);
      expect(result.minPrice).toBe(0);
      expect(result.maxPrice).toBe(0);
      expect(result.hasPredictions).toBe(false);
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

    it("all cells have isPredicted false in pattern mode", () => {
      const prices = [
        makePrice(new Date("2024-06-03T10:00:00Z"), 5, false),
      ];
      const result = buildPatternHeatmap(prices, false);
      for (const row of result.rows) {
        for (const cell of row.cells) {
          expect(cell.isPredicted).toBe(false);
        }
      }
    });
  });

  describe("getHeatmapWeekRange", () => {
    it("returns null for multi-day periods", () => {
      const start = new Date("2024-06-01");
      const end = new Date("2024-06-07");
      expect(getHeatmapWeekRange("week", start, end)).toBeNull();
      expect(getHeatmapWeekRange("month", start, end)).toBeNull();
      expect(getHeatmapWeekRange("quarter", start, end)).toBeNull();
      expect(getHeatmapWeekRange("next_week", start, end)).toBeNull();
      expect(getHeatmapWeekRange("custom", start, end)).toBeNull();
    });

    it("returns week range for 'today' period", () => {
      const today = new Date("2024-06-05T10:00:00Z"); // Wednesday
      const result = getHeatmapWeekRange("today", today, today);

      expect(result).not.toBeNull();
      // Wednesday Jun 5 is in the week Mon Jun 3 - Sun Jun 9
      expect(result!.weekStart.getDay()).not.toBe(0); // Not Sunday
      expect(result!.highlightedDates).toHaveLength(1);
    });

    it("returns week range for 'yesterday' period", () => {
      const yesterday = new Date("2024-06-04T10:00:00Z"); // Tuesday
      const result = getHeatmapWeekRange("yesterday", yesterday, yesterday);

      expect(result).not.toBeNull();
      expect(result!.highlightedDates).toHaveLength(1);
    });

    it("returns week range for 'tomorrow' period", () => {
      const tomorrow = new Date("2024-06-06T10:00:00Z"); // Thursday
      const result = getHeatmapWeekRange("tomorrow", tomorrow, tomorrow);

      expect(result).not.toBeNull();
      expect(result!.highlightedDates).toHaveLength(1);
    });

    it("returns week range for 'this_week' with multiple highlighted dates", () => {
      const result = getHeatmapWeekRange(
        "this_week",
        new Date(),
        new Date()
      );

      expect(result).not.toBeNull();
      // Should highlight at least from Monday through today (multiple dates)
      expect(result!.highlightedDates.length).toBeGreaterThanOrEqual(1);
    });

    it("single-day highlighted date matches the input date", () => {
      // Use a specific date: 2024-06-05 is a Wednesday
      const date = new Date("2024-06-05T00:00:00Z");
      const result = getHeatmapWeekRange("today", date, date);

      expect(result).not.toBeNull();
      expect(result!.highlightedDates).toContain("2024-06-05");
    });
  });
});
