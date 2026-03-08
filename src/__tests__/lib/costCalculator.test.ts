import { describe, it, expect } from "vitest";
import {
  calcCostEur,
  buildEstimates,
  PRESETS,
} from "@/lib/costCalculator";

describe("costCalculator", () => {
  describe("PRESETS", () => {
    it("contains at least 3 presets", () => {
      expect(PRESETS.length).toBeGreaterThanOrEqual(3);
    });

    it("each preset has a label, positive kWh, and positive durationHours", () => {
      for (const p of PRESETS) {
        expect(p.label).toBeTruthy();
        expect(p.kWh).toBeGreaterThan(0);
        expect(p.durationHours).toBeGreaterThan(0);
        expect(p.durationHours).toBeLessThanOrEqual(24);
      }
    });

    it("includes EV Charge at 40 kWh and 8 hours", () => {
      const ev = PRESETS.find((p) => p.label === "EV Charge");
      expect(ev).toBeDefined();
      expect(ev!.kWh).toBe(40);
      expect(ev!.durationHours).toBe(8);
    });

    it("includes Sauna at 15 kWh and 3 hours", () => {
      const sauna = PRESETS.find((p) => p.label === "Sauna");
      expect(sauna).toBeDefined();
      expect(sauna!.kWh).toBe(15);
      expect(sauna!.durationHours).toBe(3);
    });
  });

  describe("calcCostEur", () => {
    it("converts ¢/kWh * kWh to euros correctly", () => {
      // 10 ¢/kWh * 40 kWh = 400 ¢ = €4.00
      expect(calcCostEur(10, 40)).toBe(4);
    });

    it("returns 0 for zero consumption", () => {
      expect(calcCostEur(10, 0)).toBe(0);
    });

    it("returns 0 for zero price", () => {
      expect(calcCostEur(0, 40)).toBe(0);
    });

    it("handles fractional prices", () => {
      // 5.5 ¢/kWh * 2 kWh = 11 ¢ = €0.11
      expect(calcCostEur(5.5, 2)).toBeCloseTo(0.11);
    });

    it("handles negative prices (spot market can go negative)", () => {
      // -2 ¢/kWh * 40 kWh = -80 ¢ = -€0.80
      expect(calcCostEur(-2, 40)).toBeCloseTo(-0.8);
    });
  });

  describe("buildEstimates", () => {
    it("returns all 4 estimates when all prices provided", () => {
      const result = buildEstimates(40, 10, 3, 8, 20);
      expect(result).toHaveLength(4);

      const labels = result.map((e) => e.label);
      expect(labels).toContain("Starting Now");
      expect(labels).toContain("Cheapest Window");
      expect(labels).toContain("Day Average");
      expect(labels).toContain("Peak Price");
    });

    it("computes correct cost values", () => {
      const result = buildEstimates(40, 10, 3, 8, 20);

      const current = result.find((e) => e.label === "Starting Now")!;
      expect(current.costEur).toBe(4); // 10 * 40 / 100
      expect(current.priceCentsKwh).toBe(10);

      const cheapest = result.find((e) => e.label === "Cheapest Window")!;
      expect(cheapest.costEur).toBe(1.2); // 3 * 40 / 100

      const mean = result.find((e) => e.label === "Day Average")!;
      expect(mean.costEur).toBe(3.2); // 8 * 40 / 100

      const peak = result.find((e) => e.label === "Peak Price")!;
      expect(peak.costEur).toBe(8); // 20 * 40 / 100
    });

    it("omits entries when price is null", () => {
      const result = buildEstimates(40, null, 3, null, 20);
      expect(result).toHaveLength(2);

      const labels = result.map((e) => e.label);
      expect(labels).not.toContain("Starting Now");
      expect(labels).not.toContain("Day Average");
      expect(labels).toContain("Cheapest Window");
      expect(labels).toContain("Peak Price");
    });

    it("returns empty array when all prices are null", () => {
      const result = buildEstimates(40, null, null, null, null);
      expect(result).toHaveLength(0);
    });

    it("handles zero consumption", () => {
      const result = buildEstimates(0, 10, 3, 8, 20);
      expect(result).toHaveLength(4);
      for (const est of result) {
        expect(est.costEur).toBe(0);
      }
    });
  });
});
