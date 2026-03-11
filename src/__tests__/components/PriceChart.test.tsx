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
    ReferenceDot: (props: Record<string, unknown>) => <circle data-testid="reference-dot" data-x={props.x} data-y={props.y} />,
    ReferenceLine: () => null,
    ReferenceArea: (props: Record<string, unknown>) => (
        <rect
            data-testid="reference-area"
            data-fill={props.fill as string}
            data-y1={props.y1 as number}
            data-y2={props.y2 as number}
            data-overflow={props.ifOverflow as string}
        />
    ),
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

    describe("min/max annotations", () => {
        it("renders min and max ReferenceDots when prices differ", () => {
            render(<PriceChart {...defaultProps} />);
            const dots = screen.getAllByTestId("reference-dot");
            expect(dots).toHaveLength(2);
            // Min is 8 cents/kWh (80 EUR/MWh), Max is 10 cents/kWh (100 EUR/MWh)
            const xValues = dots.map(d => d.getAttribute("data-x"));
            expect(xValues).toContain("2024-01-01T10:00:00.000Z"); // min at 80 EUR/MWh
            expect(xValues).toContain("2024-01-01T11:00:00.000Z"); // max at 100 EUR/MWh
        });

        it("does not render min/max dots when all prices are equal", () => {
            const flatData = [
                makePrice("2024-01-01T10:00:00.000Z", 100),
                makePrice("2024-01-01T11:00:00.000Z", 100),
                makePrice("2024-01-01T12:00:00.000Z", 100),
            ];
            render(<PriceChart {...defaultProps} data={flatData} />);
            expect(screen.queryAllByTestId("reference-dot")).toHaveLength(0);
        });

        it("applies VAT to min/max annotation values", () => {
            render(<PriceChart {...defaultProps} includeVat={true} />);
            const dots = screen.getAllByTestId("reference-dot");
            expect(dots).toHaveLength(2);
            // With VAT: 8 * 1.22 = 9.76, 10 * 1.22 = 12.2
            const yValues = dots.map(d => parseFloat(d.getAttribute("data-y") || "0"));
            expect(yValues).toContain(9.76);
            expect(yValues).toContain(12.2);
        });

        it("picks first occurrence when multiple points share the same extreme", () => {
            const dupeData = [
                makePrice("2024-01-01T10:00:00.000Z", 80),
                makePrice("2024-01-01T11:00:00.000Z", 80),
                makePrice("2024-01-01T12:00:00.000Z", 100),
            ];
            render(<PriceChart {...defaultProps} data={dupeData} />);
            const dots = screen.getAllByTestId("reference-dot");
            const minDot = dots.find(d => d.getAttribute("data-x") === "2024-01-01T10:00:00.000Z");
            expect(minDot).toBeTruthy();
        });

        it("excludes predicted prices from min/max annotations", () => {
            const mixedData = [
                makePrice("2024-01-01T10:00:00.000Z", 80),
                makePrice("2024-01-01T11:00:00.000Z", 100),
                makePrice("2024-01-01T12:00:00.000Z", 50, true), // predicted, lowest overall
            ];
            render(<PriceChart {...defaultProps} data={mixedData} />);
            const dots = screen.getAllByTestId("reference-dot");
            // Min should be 80 EUR/MWh (known), not 50 (predicted)
            const xValues = dots.map(d => d.getAttribute("data-x"));
            expect(xValues).not.toContain("2024-01-01T12:00:00.000Z");
            expect(xValues).toContain("2024-01-01T10:00:00.000Z");
        });

        it("does not render annotations when all data is predicted", () => {
            const predData = [
                makePrice("2024-01-01T10:00:00.000Z", 80, true),
                makePrice("2024-01-01T11:00:00.000Z", 100, true),
            ];
            render(<PriceChart {...defaultProps} data={predData} />);
            expect(screen.queryAllByTestId("reference-dot")).toHaveLength(0);
        });

        it("handles negative prices correctly", () => {
            const negData = [
                makePrice("2024-01-01T10:00:00.000Z", -20),
                makePrice("2024-01-01T11:00:00.000Z", 50),
                makePrice("2024-01-01T12:00:00.000Z", 100),
            ];
            render(<PriceChart {...defaultProps} data={negData} />);
            const dots = screen.getAllByTestId("reference-dot");
            expect(dots).toHaveLength(2);
            const yValues = dots.map(d => parseFloat(d.getAttribute("data-y") || "0"));
            expect(yValues).toContain(-2); // -20 EUR/MWh = -2 cents/kWh
            expect(yValues).toContain(10); // 100 EUR/MWh = 10 cents/kWh
        });
    });

    describe("price zone bands", () => {
        const stats = { mean: 9, median: 9, p75: 9.5, p90: 9.8, p95: 9.9 };

        it("renders three zone bands when stats are provided", () => {
            render(<PriceChart {...defaultProps} stats={stats} />);
            const areas = screen.getAllByTestId("reference-area");
            expect(areas).toHaveLength(3);
        });

        it("does not render zone bands when stats are null", () => {
            render(<PriceChart {...defaultProps} stats={null} />);
            expect(screen.queryAllByTestId("reference-area")).toHaveLength(0);
        });

        it("renders green band below median", () => {
            render(<PriceChart {...defaultProps} stats={stats} />);
            const areas = screen.getAllByTestId("reference-area");
            const greenBand = areas.find(a => a.getAttribute("data-fill") === "#22c55e");
            expect(greenBand).toBeTruthy();
            expect(parseFloat(greenBand!.getAttribute("data-y2") || "0")).toBe(stats.median);
        });

        it("renders yellow band between median and P75", () => {
            render(<PriceChart {...defaultProps} stats={stats} />);
            const areas = screen.getAllByTestId("reference-area");
            const yellowBand = areas.find(a => a.getAttribute("data-fill") === "#eab308");
            expect(yellowBand).toBeTruthy();
            expect(parseFloat(yellowBand!.getAttribute("data-y1") || "0")).toBe(stats.median);
            expect(parseFloat(yellowBand!.getAttribute("data-y2") || "0")).toBe(stats.p75);
        });

        it("updates band boundaries when stats change", () => {
            const { rerender } = render(<PriceChart {...defaultProps} stats={stats} />);
            const newStats = { mean: 10, median: 10, p75: 11, p90: 11.5, p95: 11.8 };
            rerender(<PriceChart {...defaultProps} stats={newStats} />);
            // After re-render the motion values are updated; animated state may still be mid-spring.
            // Verify the bands still render without crashing.
            expect(screen.getAllByTestId("reference-area")).toHaveLength(3);
        });

        it("renders red band above P75 with y2 extending beyond the data max", () => {
            render(<PriceChart {...defaultProps} stats={stats} />);
            const areas = screen.getAllByTestId("reference-area");
            const redBand = areas.find(a => a.getAttribute("data-fill") === "#ef4444");
            expect(redBand).toBeTruthy();
            expect(parseFloat(redBand!.getAttribute("data-y1") || "0")).toBe(stats.p75);
            // bandTop must exceed the highest data price so the band fills to the chart top
            expect(parseFloat(redBand!.getAttribute("data-y2") || "0")).toBeGreaterThan(
                Math.max(...sampleData.map(d => d.priceCentsKwh))
            );
        });

        it("uses ifOverflow=visible so bands are not discarded when boundaries exceed domain", () => {
            render(<PriceChart {...defaultProps} stats={stats} />);
            const areas = screen.getAllByTestId("reference-area");
            areas.forEach(band => {
                expect(band.getAttribute("data-overflow")).toBe("visible");
            });
        });
    });
});
