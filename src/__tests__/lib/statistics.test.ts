import { describe, it, expect } from "vitest";
import { calculateStatistics } from "@/lib/statistics";
import type { ElectricityPrice } from "@/lib/api";

function makePrice(tsIso: string, eurMwh: number, isPredicted = false): ElectricityPrice {
    return {
        timestamp: tsIso,
        date: new Date(tsIso),
        priceEurMwh: eurMwh,
        priceCentsKwh: eurMwh / 10,
        isPredicted,
    };
}

describe("calculateStatistics", () => {
    it("returns null for empty input", () => {
        expect(calculateStatistics([])).toBeNull();
    });

    it("returns null when all prices are predicted", () => {
        const prices = [
            makePrice("2024-01-01T10:00:00.000Z", 100, true),
            makePrice("2024-01-01T11:00:00.000Z", 120, true),
        ];
        expect(calculateStatistics(prices)).toBeNull();
    });

    it("computes correct statistics for normal prices (no VAT)", () => {
        const prices = [
            makePrice("2024-01-01T10:00:00.000Z", 100), // 10 ¢/kWh
            makePrice("2024-01-01T11:00:00.000Z", 200), // 20 ¢/kWh
            makePrice("2024-01-01T12:00:00.000Z", 150), // 15 ¢/kWh
            makePrice("2024-01-01T13:00:00.000Z", 50),  // 5 ¢/kWh
        ];

        const stats = calculateStatistics(prices, false);
        expect(stats).not.toBeNull();
        expect(stats!.min).toBeCloseTo(5, 5);
        expect(stats!.max).toBeCloseTo(20, 5);
        expect(stats!.mean).toBeCloseTo(12.5, 5); // (5+10+15+20)/4
        expect(stats!.median).toBeCloseTo(12.5, 5); // (10+15)/2
    });

    it("applies VAT (22%) when includeVat is true", () => {
        const prices = [
            makePrice("2024-01-01T10:00:00.000Z", 100), // 10 ¢/kWh base
        ];

        const statsNoVat = calculateStatistics(prices, false);
        const statsWithVat = calculateStatistics(prices, true);

        expect(statsNoVat!.mean).toBeCloseTo(10, 5);
        // 10 * 1.22 = 12.2
        expect(statsWithVat!.mean).toBeCloseTo(12.2, 5);
    });

    it("handles negative prices correctly", () => {
        const prices = [
            makePrice("2024-01-01T10:00:00.000Z", -50), // -5 ¢/kWh
            makePrice("2024-01-01T11:00:00.000Z", 100),  // 10 ¢/kWh
            makePrice("2024-01-01T12:00:00.000Z", 200),  // 20 ¢/kWh
        ];

        const stats = calculateStatistics(prices, false);
        expect(stats).not.toBeNull();
        expect(stats!.min).toBeCloseTo(-5, 5);
        expect(stats!.max).toBeCloseTo(20, 5);
        expect(stats!.mean).toBeCloseTo(8.333, 2);
        expect(stats!.median).toBeCloseTo(10, 5);
    });

    it("handles a single price point", () => {
        const prices = [makePrice("2024-01-01T10:00:00.000Z", 120)]; // 12 ¢/kWh

        const stats = calculateStatistics(prices, false);
        expect(stats).not.toBeNull();
        expect(stats!.min).toBeCloseTo(12, 5);
        expect(stats!.max).toBeCloseTo(12, 5);
        expect(stats!.mean).toBeCloseTo(12, 5);
        expect(stats!.median).toBeCloseTo(12, 5);
        expect(stats!.p75).toBeCloseTo(12, 5);
        expect(stats!.p90).toBeCloseTo(12, 5);
        expect(stats!.p95).toBeCloseTo(12, 5);
    });

    it("ignores predicted prices in calculations", () => {
        const prices = [
            makePrice("2024-01-01T10:00:00.000Z", 100, false), // 10 ¢/kWh actual
            makePrice("2024-01-01T11:00:00.000Z", 200, false), // 20 ¢/kWh actual
            makePrice("2024-01-01T12:00:00.000Z", 9999, true), // predicted — should be ignored
        ];

        const stats = calculateStatistics(prices, false);
        expect(stats).not.toBeNull();
        expect(stats!.max).toBeCloseTo(20, 5);
        expect(stats!.mean).toBeCloseTo(15, 5);
    });
});
