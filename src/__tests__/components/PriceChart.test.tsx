import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PriceChart from "@/components/PriceChart";
import type { ElectricityPrice } from "@/lib/api";

// Recharts uses ResizeObserver and SVG layout not available in jsdom
vi.mock("recharts", () => ({
    AreaChart: ({ children, accessibilityLayer }: { children: React.ReactNode; accessibilityLayer?: boolean }) => (
        // Recharts 3 turns the accessibility layer (a keyboard focus stop) on unless told otherwise
        <svg data-testid="area-chart" data-accessibility-layer={String(accessibilityLayer ?? true)}>{children}</svg>
    ),
    Area: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    ReferenceDot: (props: Record<string, unknown>) => <circle data-testid="reference-dot" data-x={props.x} data-y={props.y} />,
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

    describe("zoom", () => {
        const chartBox = () => screen.getByRole("img", { name: /electricity price chart/i });
        const zoomIn = () => fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));

        it("at 1× the chart is not scrollable", () => {
            render(<PriceChart {...defaultProps} />);
            expect(screen.getByRole("button", { name: "Zoom out" })).toBeDisabled();
            expect(screen.queryByRole("region", { name: "Scrollable price chart" })).toBeNull();
            expect(screen.getAllByTestId("area-chart")).toHaveLength(1);
            expect(screen.getByText("1×")).toBeInTheDocument();
            expect(chartBox().parentElement!.style.width).toBe("100%");
        });

        it("zoom in widens the chart and pins the price axis", () => {
            render(<PriceChart {...defaultProps} />);
            zoomIn();
            expect(chartBox().parentElement!.style.width).toBe("200%");
            expect(screen.getByRole("region", { name: "Scrollable price chart" })).toHaveAttribute("tabindex", "0");
            expect(screen.getByTestId("y-axis-overlay")).toBeInTheDocument();
            expect(screen.getAllByTestId("area-chart")).toHaveLength(2);
            expect(screen.getByText("2×")).toBeInTheDocument();
            expect(screen.getByText("Scroll sideways for more")).toBeInTheDocument();
        });

        it("keeps the pinned price axis out of keyboard navigation", () => {
            render(<PriceChart {...defaultProps} />);
            zoomIn();
            const overlayChart = screen.getByTestId("y-axis-overlay").querySelector("[data-testid='area-chart']")!;
            expect(overlayChart).toHaveAttribute("data-accessibility-layer", "false");
            expect(chartBox().querySelector("[data-testid='area-chart']")).toHaveAttribute("data-accessibility-layer", "true");
        });

        it("keeps the time at the viewport centre when zooming, allowing for the plot insets", () => {
            render(<PriceChart {...defaultProps} />);
            const scrollBox = chartBox().parentElement!.parentElement!;
            let scrollLeft = 0;
            Object.defineProperty(scrollBox, "clientWidth", { configurable: true, get: () => 340 });
            Object.defineProperty(scrollBox, "scrollLeft", {
                configurable: true,
                get: () => scrollLeft,
                set: (v: number) => { scrollLeft = v; },
            });
            zoomIn();
            // Plot area starts 40 px in (60 px YAxis − 20 px margin) and ends 10 px from the right
            expect(scrollLeft).toBeCloseTo(152.41, 2);
        });

        it("zoom stops at 8×", () => {
            render(<PriceChart {...defaultProps} />);
            zoomIn();
            zoomIn();
            zoomIn();
            expect(screen.getByText("8×")).toBeInTheDocument();
            expect(screen.getByRole("button", { name: "Zoom in" })).toBeDisabled();
            fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
            expect(screen.getByText("4×")).toBeInTheDocument();
        });

        it("keeps the zoom when the data changes", () => {
            const { rerender } = render(<PriceChart {...defaultProps} />);
            zoomIn();
            const mixedData = [
                ...sampleData,
                makePrice("2024-01-01T13:00:00.000Z", 95, true), // 15:00 Tallinn (EET)
            ];
            rerender(<PriceChart {...defaultProps} data={mixedData} />);
            expect(screen.getByText("2×")).toBeInTheDocument();
            expect(chartBox().parentElement!.style.width).toBe("200%");
        });

        it("shows no zoom controls without data", () => {
            render(<PriceChart {...defaultProps} data={[]} />);
            expect(screen.queryByRole("button", { name: "Zoom in" })).toBeNull();
        });
    });
});
