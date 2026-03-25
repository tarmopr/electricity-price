import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PriceHeatmap from "@/components/PriceHeatmap";
import type { ElectricityPrice } from "@/lib/api";

function makePrice(tsIso: string, eurMwh: number): ElectricityPrice {
    const date = new Date(tsIso);
    return { timestamp: tsIso, date, priceEurMwh: eurMwh, priceCentsKwh: eurMwh / 10 };
}

// Generate 7 days × 24 hours of data
function makeWeekData(): ElectricityPrice[] {
    const data: ElectricityPrice[] = [];
    for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
            const ts = new Date(Date.UTC(2024, 0, 1 + day, hour)).toISOString();
            data.push(makePrice(ts, 50 + day * 5 + hour));
        }
    }
    return data;
}

describe("PriceHeatmap", () => {
    const sampleData = makeWeekData();

    it("renders 'No data available' when data is empty", () => {
        render(<PriceHeatmap data={[]} includeVat={false} />);
        expect(screen.getByText(/no data available/i)).toBeInTheDocument();
    });

    it("renders the heatmap grid when data is provided", () => {
        render(<PriceHeatmap data={sampleData} includeVat={false} />);
        expect(screen.getByRole("group", { name: /heatmap mode/i })).toBeInTheDocument();
    });

    it("shows Calendar and Weekly Pattern mode buttons", () => {
        render(<PriceHeatmap data={sampleData} includeVat={false} />);
        expect(screen.getByRole("button", { name: /calendar/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /weekly pattern/i })).toBeInTheDocument();
    });

    it("has Calendar mode active by default", () => {
        render(<PriceHeatmap data={sampleData} includeVat={false} />);
        const calBtn = screen.getByRole("button", { name: /calendar/i });
        expect(calBtn).toHaveAttribute("aria-pressed", "true");
        const patBtn = screen.getByRole("button", { name: /weekly pattern/i });
        expect(patBtn).toHaveAttribute("aria-pressed", "false");
    });

    it("switches to Pattern mode when Pattern button is clicked", () => {
        render(<PriceHeatmap data={sampleData} includeVat={false} />);
        fireEvent.click(screen.getByRole("button", { name: /weekly pattern/i }));
        const patBtn = screen.getByRole("button", { name: /weekly pattern/i });
        expect(patBtn).toHaveAttribute("aria-pressed", "true");
        const calBtn = screen.getByRole("button", { name: /calendar/i });
        expect(calBtn).toHaveAttribute("aria-pressed", "false");
    });

    it("renders cells with title attributes (hover tooltip content)", () => {
        const { container } = render(<PriceHeatmap data={sampleData} includeVat={false} />);
        // Cells have title attributes for accessibility
        const cells = container.querySelectorAll("[title]");
        expect(cells.length).toBeGreaterThan(0);
    });

    it("shows cheapest window ring when cheapestWindow is provided", () => {
        const cheapestWindow = {
            startTimestamp: "2024-01-01T08:00:00.000Z",
            endTimestamp: "2024-01-01T10:00:00.000Z",
            startHour: 8,
            hours: 2,
            averagePrice: 5.5,
            startIndex: 8,
            endIndex: 9,
        };
        const { container } = render(
            <PriceHeatmap data={sampleData} includeVat={false} cheapestWindow={cheapestWindow} />
        );
        // The cheapest window cells get ring-2 ring-emerald-400/70
        const ringCells = container.querySelectorAll(".ring-2");
        expect(ringCells.length).toBeGreaterThan(0);
    });
});
