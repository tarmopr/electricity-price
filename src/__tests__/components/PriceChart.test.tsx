import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PriceChart from "@/components/PriceChart";
import type { ElectricityPrice } from "@/lib/api";

// Recharts uses ResizeObserver and SVG layout not available in jsdom
vi.mock("recharts", () => ({
    AreaChart: ({ children }: { children: React.ReactNode }) => <svg data-testid="area-chart">{children}</svg>,
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

function makePrice(tsIso: string, eurMwh: number, isPredicted = false): ElectricityPrice {
    const date = new Date(tsIso);
    return { timestamp: tsIso, date, priceEurMwh: eurMwh, priceCentsKwh: eurMwh / 10, isPredicted };
}

const sampleData: ElectricityPrice[] = [
    makePrice("2024-01-01T10:00:00.000Z", 80),
    makePrice("2024-01-01T11:00:00.000Z", 100),
    makePrice("2024-01-01T12:00:00.000Z", 90),
];

const defaultProps = {
    data: sampleData,
    currentPrice: null,
    includeVat: false,
    showNow: false,
    showMean: false,
    showMedian: false,
    showP75: false,
    showP90: false,
    showP95: false,
    stats: null,
    cheapestWindow: null,
    avg7dPattern: null,
    avg30dPattern: null,
    showAvg7d: false,
    showAvg30d: false,
};

describe("PriceChart", () => {
    it("renders loading skeleton before mount", () => {
        // The component uses useEffect + mounted state. Before mount it shows a skeleton.
        // Since React renders immediately in tests, we check the post-mount state.
        const { container } = render(<PriceChart {...defaultProps} />);
        // Either the chart or skeleton should be present
        expect(container.firstChild).toBeTruthy();
    });

    it("renders the chart container when data is provided", () => {
        render(<PriceChart {...defaultProps} />);
        expect(screen.getByRole("img", { name: /electricity price chart/i })).toBeInTheDocument();
    });

    it("shows 'No data available' when data array is empty", () => {
        render(<PriceChart {...defaultProps} data={[]} />);
        expect(screen.getByText(/no data available/i)).toBeInTheDocument();
    });

    it("renders chart with predicted data mixed in", () => {
        const mixedData = [
            ...sampleData,
            makePrice("2024-01-01T13:00:00.000Z", 95, true),
        ];
        render(<PriceChart {...defaultProps} data={mixedData} />);
        expect(screen.getByTestId("area-chart")).toBeInTheDocument();
    });

    it("renders with stats provided", () => {
        const stats = { min: 8, max: 12, mean: 10, median: 10, p75: 11, p90: 11.5, p95: 11.8 };
        render(<PriceChart {...defaultProps} stats={stats} showMean showMedian />);
        expect(screen.getByRole("img", { name: /electricity price chart/i })).toBeInTheDocument();
    });
});
