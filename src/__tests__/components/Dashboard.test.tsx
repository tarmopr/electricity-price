import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import Dashboard from "@/components/Dashboard";
import type { ElectricityPrice } from "@/lib/api";

// ─── Mock all heavy dependencies ─────────────────────────────────────────────

vi.mock("@/lib/useDashboardPrices", () => ({
    useDashboardPrices: vi.fn(),
    getDateRangeForPeriod: vi.fn(),
    getAggregationHours: vi.fn(),
}));

vi.mock("@/lib/usePriceAlerts", () => ({
    usePriceAlerts: vi.fn(() => ({
        alertConfig: { enabled: false, threshold: 10, direction: "below" },
        setAlertConfig: vi.fn(),
        activeAlert: null,
        alertDismissed: false,
        dismissAlert: vi.fn(),
    })),
}));

vi.mock("@/lib/usePatternOverlays", () => ({
    usePatternOverlays: vi.fn(() => ({
        showAvg7d: false,
        setShowAvg7d: vi.fn(),
        showAvg30d: false,
        setShowAvg30d: vi.fn(),
        avg7dPattern: null,
        avg30dPattern: null,
    })),
}));

vi.mock("@/lib/usePersistedState", () => ({
    usePersistedState: vi.fn((key: string, defaultVal: unknown) => {
        const { useState } = require("react");
        return useState(defaultVal);
    }),
}));

vi.mock("@/lib/api", () => ({
    calculateStatistics: vi.fn(() => null),
    aggregatePrices: vi.fn((prices: ElectricityPrice[]) => prices),
}));

vi.mock("@/lib/shareState", () => ({
    decodeParamsToState: vi.fn(() => null),
}));

vi.mock("recharts", () => ({
    AreaChart: ({ children }: { children: React.ReactNode }) => <svg>{children}</svg>,
    Area: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    ReferenceLine: () => null,
    ReferenceArea: () => null,
    Line: () => null,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("framer-motion", () => {
    const React = require("react");
    return {
        motion: {
            span: React.forwardRef(
                ({ children, className }: { children: unknown; className?: string }, ref: React.Ref<HTMLSpanElement>) =>
                    React.createElement("span", { ref, className }, typeof children === "object" && children !== null && "get" in (children as object)
                        ? String((children as { get: () => unknown }).get())
                        : children)
            ),
        },
        useMotionValue: () => ({ get: () => 0, set: vi.fn(), on: vi.fn() }),
        useTransform: (_mv: unknown, fn: (v: number) => string) => ({ get: () => fn(0) }),
        animate: vi.fn(() => ({ stop: vi.fn() })),
    };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePrice(tsIso: string, eurMwh: number): ElectricityPrice {
    return { timestamp: tsIso, date: new Date(tsIso), priceEurMwh: eurMwh, priceCentsKwh: eurMwh / 10 };
}

const samplePrices = [
    makePrice("2024-01-01T10:00:00.000Z", 80),
    makePrice("2024-01-01T11:00:00.000Z", 100),
    makePrice("2024-01-01T12:00:00.000Z", 90),
];

// ─── Tests ───────────────────────────────────────────────────────────────────

const { useDashboardPrices } = vi.mocked(await import("@/lib/useDashboardPrices"));

describe("Dashboard", () => {
    beforeEach(() => {
        useDashboardPrices.mockReturnValue({
            prices: samplePrices,
            currentPrice: makePrice("2024-01-01T12:00:00.000Z", 90),
            previousPrice: makePrice("2024-01-01T11:00:00.000Z", 100),
            nextPrice: null,
            heatmapPrices: samplePrices,
            highlightedDates: undefined,
            loading: false,
            error: null,
        });
    });

    it("renders without crashing", () => {
        const { container } = render(<Dashboard />);
        expect(container.firstChild).toBeTruthy();
    });

    it("renders loading spinner when loading and prices empty", () => {
        useDashboardPrices.mockReturnValueOnce({
            prices: [],
            currentPrice: null,
            previousPrice: null,
            nextPrice: null,
            heatmapPrices: [],
            highlightedDates: undefined,
            loading: true,
            error: null,
        });

        render(<Dashboard />);
        expect(screen.getByText(/loading market data/i)).toBeInTheDocument();
    });

    it("renders error message when error is set", () => {
        useDashboardPrices.mockReturnValueOnce({
            prices: [],
            currentPrice: null,
            previousPrice: null,
            nextPrice: null,
            heatmapPrices: [],
            highlightedDates: undefined,
            loading: false,
            error: "Network error",
        });

        render(<Dashboard />);
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });

    it("renders Chart and Heatmap view mode buttons", () => {
        render(<Dashboard />);
        // Use exact match to avoid matching "Toggle chart controls" mobile button
        expect(screen.getByRole("button", { name: /^chart$/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^heatmap$/i })).toBeInTheDocument();
    });

    it("renders CurrentPriceCard (shows current price label)", () => {
        render(<Dashboard />);
        expect(screen.getByText(/current price/i)).toBeInTheDocument();
    });

    it("renders period selection controls", () => {
        render(<Dashboard />);
        expect(screen.getByRole("button", { name: /today/i })).toBeInTheDocument();
    });
});
