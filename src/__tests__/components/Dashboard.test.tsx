import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

vi.mock("@/lib/useCostCalculator", () => ({
    useCostCalculator: vi.fn(),
}));

vi.mock("recharts", () => ({
    AreaChart: ({ children }: { children: React.ReactNode }) => <svg>{children}</svg>,
    Area: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    ReferenceDot: () => null,
    ReferenceLine: () => null,
    ReferenceArea: () => <g data-testid="cheapest-area" />,
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

const cheapestWindow = {
    startTimestamp: "2024-01-01T10:00:00.000Z",
    endTimestamp: "2024-01-01T12:00:00.000Z",
    startHour: 12,
    hours: 2,
    averagePrice: 8.5,
    startIndex: 0,
    endIndex: 7,
    isPredicted: false,
};

function makeCostCalc(overrides: Record<string, unknown> = {}) {
    return {
        costConsumptionKwh: 40,
        setCostConsumptionKwh: vi.fn(),
        costDurationHours: 8,
        setCostDurationHours: vi.fn(),
        costReadyBy: "07:00",
        setCostReadyBy: vi.fn(),
        costActivePreset: "EV Charge",
        setCostActivePreset: vi.fn(),
        costCalcOpen: false,
        setCostCalcOpen: vi.fn(),
        cheapestWindow: null,
        startingNowPrice: null,
        horizonAvgPrice: null,
        horizonMaxPrice: null,
        isPredicted: false,
        costNowMs: new Date("2024-01-01T09:00:00.000Z").getTime(),
        costLoading: false,
        costError: null,
        readyByLimitMs: null,
        startingNowEndMs: null,
        bestIgnoresDeadline: false,
        ...overrides,
    };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

const { useDashboardPrices } = vi.mocked(await import("@/lib/useDashboardPrices"));
const { useCostCalculator } = vi.mocked(await import("@/lib/useCostCalculator"));

describe("Dashboard", () => {
    beforeEach(() => {
        useCostCalculator.mockReturnValue(makeCostCalc() as unknown as ReturnType<typeof useCostCalculator>);
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

    it("renders skeleton loading state when loading and prices empty", () => {
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
        expect(screen.getByLabelText(/loading market data/i)).toBeInTheDocument();
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

    it("clicking VAT toggle changes the VAT button aria-pressed state", () => {
        render(<Dashboard />);
        // Find the VAT toggle button by its text content
        const vatButton = screen.getByRole("button", { name: /incl\. vat|excl\. vat|vat/i });
        const initialPressed = vatButton.getAttribute("aria-pressed");
        fireEvent.click(vatButton);
        // After click, the aria-pressed state should change
        expect(vatButton.getAttribute("aria-pressed")).not.toBe(initialPressed);
    });

    it("clicking Yesterday period button triggers period change", () => {
        render(<Dashboard />);
        const yesterdayButton = screen.getByRole("button", { name: /yesterday/i });
        expect(yesterdayButton).toBeInTheDocument();
        fireEvent.click(yesterdayButton);
        // After clicking yesterday, the button should reflect active state
        expect(yesterdayButton.getAttribute("aria-pressed")).toBe("true");
    });

    it("clicking Heatmap button switches to heatmap view", () => {
        render(<Dashboard />);
        const heatmapButton = screen.getByRole("button", { name: /^heatmap$/i });
        fireEvent.click(heatmapButton);
        // After switching to heatmap, the heatmap button should be active
        expect(heatmapButton.getAttribute("aria-pressed")).toBe("true");
        // Chart button should no longer be active
        const chartButton = screen.getByRole("button", { name: /^chart$/i });
        expect(chartButton.getAttribute("aria-pressed")).toBe("false");
    });

    it("calls useCostCalculator with VAT only (independent of chart period)", () => {
        render(<Dashboard />);
        expect(useCostCalculator).toHaveBeenCalledWith(true);
    });

    it("renders the Best Window card", () => {
        useCostCalculator.mockReturnValue(
            makeCostCalc({ cheapestWindow, startingNowPrice: 10 }) as unknown as ReturnType<typeof useCostCalculator>
        );
        render(<Dashboard />);
        expect(screen.getByRole("button", { name: /best time ·\s*ev charge/i })).toBeInTheDocument();
        // 8.5 ¢ × 40 kWh = €3.40
        expect(screen.getAllByText("€3.40").length).toBeGreaterThan(0);
    });

    it("tapping the Best Window card opens the cost calculator", () => {
        const setCostCalcOpen = vi.fn();
        useCostCalculator.mockReturnValue(
            makeCostCalc({ cheapestWindow, setCostCalcOpen }) as unknown as ReturnType<typeof useCostCalculator>
        );
        render(<Dashboard />);
        fireEvent.click(screen.getByRole("button", { name: /open cost calculator/i }));
        expect(setCostCalcOpen).toHaveBeenCalledWith(true);
    });

    it("passes the cheapest window to the chart even when the calculator is closed", () => {
        useCostCalculator.mockReturnValue(
            makeCostCalc({ cheapestWindow, costCalcOpen: false }) as unknown as ReturnType<typeof useCostCalculator>
        );
        render(<Dashboard />);
        expect(screen.getByTestId("cheapest-area")).toBeInTheDocument();
    });

    it("does not render the chart highlight when the window is outside the chart range", () => {
        useCostCalculator.mockReturnValue(
            makeCostCalc({
                cheapestWindow: {
                    ...cheapestWindow,
                    startTimestamp: "2024-01-02T01:00:00.000Z",
                    endTimestamp: "2024-01-02T03:00:00.000Z",
                },
            }) as unknown as ReturnType<typeof useCostCalculator>
        );
        render(<Dashboard />);
        expect(screen.queryByTestId("cheapest-area")).not.toBeInTheDocument();
    });

    it("shows a load error on the Best Window card when the cost calculator fetch failed", () => {
        useCostCalculator.mockReturnValue(
            makeCostCalc({ costError: "boom" }) as unknown as ReturnType<typeof useCostCalculator>
        );
        render(<Dashboard />);
        expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load prices");
    });

    it("highlights a deadline-ignoring fallback window on the chart and flags it on the card", () => {
        useCostCalculator.mockReturnValue(
            makeCostCalc({
                cheapestWindow,
                bestIgnoresDeadline: true,
                readyByLimitMs: new Date("2024-01-02T05:00:00.000Z").getTime(), // next 07:00 Tallinn
            }) as unknown as ReturnType<typeof useCostCalculator>
        );
        render(<Dashboard />);
        expect(screen.getByTestId("cheapest-area")).toBeInTheDocument();
        expect(screen.getByText(/Finishes after 07:00/)).toBeInTheDocument();
    });

    it("renders the Next 24h period pill", () => {
        render(<Dashboard />);
        expect(screen.getByRole("button", { name: /next 24h/i })).toBeInTheDocument();
    });
});
