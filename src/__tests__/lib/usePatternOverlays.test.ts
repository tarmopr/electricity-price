import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { usePatternOverlays } from "@/lib/usePatternOverlays";

vi.mock("@/lib/api", () => ({
    getHourlyAveragePattern: vi.fn(),
}));

vi.mock("@/lib/usePersistedState", () => ({
    usePersistedState: vi.fn((key: string, defaultVal: unknown) => {
        const { useState } = require("react");
        return useState(defaultVal);
    }),
}));

const { getHourlyAveragePattern } = vi.mocked(await import("@/lib/api"));

describe("usePatternOverlays", () => {
    beforeEach(() => {
        getHourlyAveragePattern.mockResolvedValue(new Map([[0, 5], [1, 6]]));
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("initializes with both overlays off and no pattern data", () => {
        const { result } = renderHook(() => usePatternOverlays());
        expect(result.current.showAvg7d).toBe(false);
        expect(result.current.showAvg30d).toBe(false);
        expect(result.current.avg7dPattern).toBeNull();
        expect(result.current.avg30dPattern).toBeNull();
    });

    it("fetches 7-day pattern when showAvg7d is toggled on", async () => {
        const { result } = renderHook(() => usePatternOverlays());

        act(() => {
            result.current.setShowAvg7d(true);
        });

        await waitFor(() => {
            expect(result.current.avg7dPattern).not.toBeNull();
        });

        expect(getHourlyAveragePattern).toHaveBeenCalledWith(7);
    });

    it("fetches 30-day pattern when showAvg30d is toggled on", async () => {
        const { result } = renderHook(() => usePatternOverlays());

        act(() => {
            result.current.setShowAvg30d(true);
        });

        await waitFor(() => {
            expect(result.current.avg30dPattern).not.toBeNull();
        });

        expect(getHourlyAveragePattern).toHaveBeenCalledWith(30);
    });

    it("clears 7d pattern and resets fetch tracking when toggled off", async () => {
        const { result } = renderHook(() => usePatternOverlays());

        // Toggle on
        act(() => { result.current.setShowAvg7d(true); });
        await waitFor(() => expect(result.current.avg7dPattern).not.toBeNull());

        // Toggle off
        act(() => { result.current.setShowAvg7d(false); });

        await waitFor(() => {
            expect(result.current.avg7dPattern).toBeNull();
        });
    });

    it("clears 30d pattern when toggled off", async () => {
        const { result } = renderHook(() => usePatternOverlays());

        act(() => { result.current.setShowAvg30d(true); });
        await waitFor(() => expect(result.current.avg30dPattern).not.toBeNull());

        act(() => { result.current.setShowAvg30d(false); });

        await waitFor(() => {
            expect(result.current.avg30dPattern).toBeNull();
        });
    });

    it("does not re-fetch if pattern is already loaded", async () => {
        const { result } = renderHook(() => usePatternOverlays());

        act(() => { result.current.setShowAvg7d(true); });
        await waitFor(() => expect(result.current.avg7dPattern).not.toBeNull());

        const callCount = getHourlyAveragePattern.mock.calls.length;

        // Re-render should not trigger another fetch
        act(() => { result.current.setShowAvg7d(true); });

        expect(getHourlyAveragePattern.mock.calls.length).toBe(callCount);
    });

    it("re-fetches after toggling off and on again", async () => {
        const { result } = renderHook(() => usePatternOverlays());

        act(() => { result.current.setShowAvg7d(true); });
        await waitFor(() => expect(result.current.avg7dPattern).not.toBeNull());

        // Toggle off — resets fetch tracking
        act(() => { result.current.setShowAvg7d(false); });
        await waitFor(() => expect(result.current.avg7dPattern).toBeNull());

        const callCount = getHourlyAveragePattern.mock.calls.length;

        // Toggle on again — should fetch again
        act(() => { result.current.setShowAvg7d(true); });
        await waitFor(() => expect(result.current.avg7dPattern).not.toBeNull());

        expect(getHourlyAveragePattern.mock.calls.length).toBeGreaterThan(callCount);
    });
});
