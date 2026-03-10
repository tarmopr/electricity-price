import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import {
    getDateRangeForPeriod,
    getAggregationHours,
    useDashboardPrices,
} from "@/lib/useDashboardPrices";
import type { ElectricityPrice } from "@/lib/api";

// ─── getDateRangeForPeriod ────────────────────────────────────────────────────

describe("getDateRangeForPeriod", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        // Fix "now" to 2024-06-15 12:00 local
        vi.setSystemTime(new Date(2024, 5, 15, 12, 0, 0));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("'today' maps to today's start and end", () => {
        const { start, end } = getDateRangeForPeriod("today", "", "");
        expect(start.getHours()).toBe(0);
        expect(start.getMinutes()).toBe(0);
        expect(end.getHours()).toBe(23);
        expect(end.getMinutes()).toBe(59);
        expect(start.getDate()).toBe(end.getDate());
    });

    it("'yesterday' maps to previous day", () => {
        const { start, end } = getDateRangeForPeriod("yesterday", "", "");
        expect(start.getDate()).toBe(14); // June 14
        expect(end.getDate()).toBe(14);
    });

    it("'tomorrow' maps to next day", () => {
        const { start, end } = getDateRangeForPeriod("tomorrow", "", "");
        expect(start.getDate()).toBe(16); // June 16
        expect(end.getDate()).toBe(16);
    });

    it("'last_7_days' starts 7 days before today midnight", () => {
        const { start, end } = getDateRangeForPeriod("last_7_days", "", "");
        // 7 days before June 15 = June 8
        expect(start.getDate()).toBe(8);
        // End is end of today
        expect(end.getDate()).toBe(15);
    });

    it("'next_7_days' starts tomorrow and ends 7 days later", () => {
        const { start, end } = getDateRangeForPeriod("next_7_days", "", "");
        expect(start.getDate()).toBe(16); // starts tomorrow
        expect(end.getDate()).toBe(22); // 7 days after tomorrow
    });

    it("'last_30_days' starts ~1 month before today", () => {
        const { start, end } = getDateRangeForPeriod("last_30_days", "", "");
        // subMonths(today, 1) = May 15
        expect(start.getMonth()).toBe(4); // May = month 4
        expect(end.getDate()).toBe(15);
    });

    it("'custom' uses provided dates", () => {
        const { start, end } = getDateRangeForPeriod(
            "custom",
            "2024-03-01",
            "2024-03-31"
        );
        expect(start.getMonth()).toBe(2); // March = 2
        expect(start.getDate()).toBe(1);
        expect(end.getDate()).toBe(31);
    });

    it("'custom' with start > end swaps the dates", () => {
        const { start, end } = getDateRangeForPeriod(
            "custom",
            "2024-03-31",
            "2024-03-01"
        );
        // After swap: start should be March 1, end should be March 31
        expect(start.getDate()).toBe(1);
        expect(end.getDate()).toBe(31);
    });

    it("'custom' with empty strings falls back to today", () => {
        const { start, end } = getDateRangeForPeriod("custom", "", "");
        expect(start.getDate()).toBe(15); // today
        expect(end.getDate()).toBe(15);
    });

    it("'this_week' starts on Monday", () => {
        const { start } = getDateRangeForPeriod("this_week", "", "");
        // June 15, 2024 is a Saturday. Previous Monday = June 10
        expect(start.getDay()).toBe(1); // Monday
    });
});

// ─── getAggregationHours ──────────────────────────────────────────────────────

describe("getAggregationHours", () => {
    function makeRange(daysApart: number): { start: Date; end: Date } {
        const start = new Date("2024-01-01T00:00:00Z");
        const end = new Date(start.getTime() + daysApart * 24 * 60 * 60 * 1000);
        return { start, end };
    }

    it("returns 1 for last_7_days", () => {
        const { start, end } = makeRange(7);
        expect(getAggregationHours("last_7_days", start, end)).toBe(1);
    });

    it("returns 1 for this_week", () => {
        const { start, end } = makeRange(7);
        expect(getAggregationHours("this_week", start, end)).toBe(1);
    });

    it("returns 1 for next_7_days", () => {
        const { start, end } = makeRange(7);
        expect(getAggregationHours("next_7_days", start, end)).toBe(1);
    });

    it("returns 6 for last_30_days", () => {
        const { start, end } = makeRange(30);
        expect(getAggregationHours("last_30_days", start, end)).toBe(6);
    });

    it("returns 0 for today (no aggregation)", () => {
        const { start, end } = makeRange(1);
        expect(getAggregationHours("today", start, end)).toBe(0);
    });

    it("returns 0 for yesterday (no aggregation)", () => {
        const { start, end } = makeRange(1);
        expect(getAggregationHours("yesterday", start, end)).toBe(0);
    });

    it("returns 0 for tomorrow (no aggregation)", () => {
        const { start, end } = makeRange(1);
        expect(getAggregationHours("tomorrow", start, end)).toBe(0);
    });

    it("custom > 90 days returns 24", () => {
        const { start, end } = makeRange(91);
        expect(getAggregationHours("custom", start, end)).toBe(24);
    });

    it("custom 31-90 days returns 12", () => {
        const { start, end } = makeRange(60);
        expect(getAggregationHours("custom", start, end)).toBe(12);
    });

    it("custom 8-30 days returns 6", () => {
        const { start, end } = makeRange(15);
        expect(getAggregationHours("custom", start, end)).toBe(6);
    });

    it("custom 4-7 days returns 1", () => {
        const { start, end } = makeRange(5);
        expect(getAggregationHours("custom", start, end)).toBe(1);
    });

    it("custom <= 3 days returns 0 (no aggregation)", () => {
        const { start, end } = makeRange(2);
        expect(getAggregationHours("custom", start, end)).toBe(0);
    });
});

// ─── useDashboardPrices hook ──────────────────────────────────────────────────

vi.mock("@/lib/api", () => ({
    getPricesWithPrediction: vi.fn(),
    getHeatmapPricesWithPredictions: vi.fn(),
    getCurrentPrice: vi.fn(),
    aggregatePrices: vi.fn((prices: ElectricityPrice[]) => prices),
}));

vi.mock("@/lib/heatmapData", () => ({
    getHeatmapWeekRange: vi.fn(() => null),
}));

function makePrice(tsIso: string, eurMwh: number, isPredicted = false): ElectricityPrice {
    const date = new Date(tsIso);
    return {
        timestamp: tsIso,
        date,
        priceEurMwh: eurMwh,
        priceCentsKwh: eurMwh / 10,
        isPredicted,
    };
}

const { getPricesWithPrediction, getCurrentPrice } = vi.mocked(
    await import("@/lib/api")
);

describe("useDashboardPrices", () => {
    beforeEach(() => {
        getPricesWithPrediction.mockResolvedValue([
            makePrice("2024-06-15T10:00:00.000Z", 100),
            makePrice("2024-06-15T11:00:00.000Z", 110),
            makePrice("2024-06-15T12:00:00.000Z", 120),
            makePrice("2024-06-15T13:00:00.000Z", 130),
        ]);
        getCurrentPrice.mockResolvedValue(makePrice("2024-06-15T12:00:00.000Z", 120));
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("starts with loading=true and empty prices", () => {
        const { result } = renderHook(() =>
            useDashboardPrices("today", "", "")
        );
        expect(result.current.loading).toBe(true);
        expect(result.current.prices).toHaveLength(0);
    });

    it("loads prices and sets loading=false on success", async () => {
        const { result } = renderHook(() =>
            useDashboardPrices("today", "", "")
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.prices).toHaveLength(4);
        expect(result.current.error).toBeNull();
    });

    it("sets currentPrice from getCurrentPrice", async () => {
        const { result } = renderHook(() =>
            useDashboardPrices("today", "", "")
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.currentPrice?.priceEurMwh).toBe(120);
    });

    it("sets previous and next prices from chart data", async () => {
        const { result } = renderHook(() =>
            useDashboardPrices("today", "", "")
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        // Current is index 2 → previous is index 1, next is index 3
        expect(result.current.previousPrice?.priceEurMwh).toBe(110);
        expect(result.current.nextPrice?.priceEurMwh).toBe(130);
    });

    it("sets error state on fetch failure", async () => {
        getPricesWithPrediction.mockRejectedValueOnce(new Error("Network error"));

        const { result } = renderHook(() =>
            useDashboardPrices("today", "", "")
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.error).toBe("Network error");
        expect(result.current.prices).toHaveLength(0);
    });

    it("sets generic error message for non-Error rejections", async () => {
        getPricesWithPrediction.mockRejectedValueOnce("some string error");

        const { result } = renderHook(() =>
            useDashboardPrices("today", "", "")
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.error).toBe("Failed to load electricity prices");
    });

    it("sets up a 15-minute refresh interval and clears it on unmount", async () => {
        vi.useFakeTimers();

        const { result, unmount } = renderHook(() =>
            useDashboardPrices("today", "", "")
        );

        // Flush the initial fetch with act + advancing timers
        // (waitFor polling is broken with fake timers)
        await act(async () => {
            await vi.advanceTimersByTimeAsync(100);
        });

        expect(result.current.loading).toBe(false);

        const callCountAfterMount = getPricesWithPrediction.mock.calls.length;

        // Advance time by 15 minutes — should trigger a refresh
        await act(async () => {
            await vi.advanceTimersByTimeAsync(15 * 60 * 1000);
        });

        expect(getPricesWithPrediction.mock.calls.length).toBeGreaterThan(callCountAfterMount);

        unmount();

        const callCountAfterUnmount = getPricesWithPrediction.mock.calls.length;

        // Advance more time — should NOT trigger another refresh
        await act(async () => {
            await vi.advanceTimersByTimeAsync(15 * 60 * 1000);
        });

        expect(getPricesWithPrediction.mock.calls.length).toBe(callCountAfterUnmount);

        vi.useRealTimers();
    });

    it("merges predicted prices for future periods (next_7_days)", async () => {
        const futurePrices = [
            makePrice("2024-06-16T10:00:00.000Z", 50, true),
            makePrice("2024-06-17T10:00:00.000Z", 60, true),
        ];
        getPricesWithPrediction.mockResolvedValueOnce(futurePrices);
        getCurrentPrice.mockResolvedValueOnce(null);

        const { result } = renderHook(() =>
            useDashboardPrices("next_7_days", "", "")
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.prices.some(p => p.isPredicted)).toBe(true);
    });

    it("custom date range with start > end is handled without error", async () => {
        const { result } = renderHook(() =>
            useDashboardPrices("custom", "2024-06-20", "2024-06-10")
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        // Should load without throwing (dates are swapped internally)
        expect(result.current.error).toBeNull();
    });
});
