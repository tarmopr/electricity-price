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

    // ─── Mobile transposed layout ───────────────────────────────────────────

    it("renders a desktop grid (sm+) and a transposed mobile grid (<sm)", () => {
        render(<PriceHeatmap data={sampleData} includeVat={false} />);
        const desktop = screen.getByRole("grid", { name: /by day and hour/i });
        const mobile = screen.getByRole("grid", { name: /by hour and day/i });
        expect(desktop.parentElement!.className).toContain("hidden sm:block");
        expect(mobile.className).toContain("sm:hidden");
    });

    it("mobile grid has 24 hour rows plus a header, with one column per day", () => {
        render(<PriceHeatmap data={sampleData} includeVat={false} />);
        const mobile = screen.getByRole("grid", { name: /by hour and day/i });
        const rows = mobile.querySelectorAll(':scope > [role="row"]');
        expect(rows).toHaveLength(25);
        // Each hour row: rowheader + one cell per day column (8 Tallinn dates for 7 UTC days)
        const dayColumns = rows[0].querySelectorAll('[role="columnheader"]').length - 1;
        expect(dayColumns).toBe(8);
        expect(rows[1].querySelectorAll('[role="gridcell"]')).toHaveLength(dayColumns);
        expect(rows[1].querySelector('[role="rowheader"]')).toHaveTextContent("00");
    });

    it("mobile grid does not force horizontal scrolling", () => {
        render(<PriceHeatmap data={sampleData} includeVat={false} />);
        const mobile = screen.getByRole("grid", { name: /by hour and day/i });
        expect(mobile.className).not.toContain("min-w-");
        expect(mobile.parentElement!.className).not.toContain("overflow-x-auto");
    });

    it("falls back to the scrollable day-rows grid on mobile for many days (30-day view)", () => {
        // 30 days of hourly data
        const month: ElectricityPrice[] = [];
        for (let day = 0; day < 30; day++) {
            for (let hour = 0; hour < 24; hour++) {
                month.push(makePrice(new Date(Date.UTC(2024, 0, 1 + day, hour)).toISOString(), 50 + hour));
            }
        }
        const { container } = render(<PriceHeatmap data={month} includeVat={false} />);
        const grids = screen.getAllByRole("grid");
        // Only one grid is rendered, and it is not hidden on mobile
        expect(grids).toHaveLength(1);
        expect(screen.queryByRole("grid", { name: /by hour and day/i })).not.toBeInTheDocument();
        let node: HTMLElement | null = grids[0];
        while (node && node !== container) {
            expect(node.classList.contains("hidden")).toBe(false);
            node = node.parentElement;
        }
        // Day rows are kept (one row per Tallinn date) inside a horizontal scroller
        expect(grids[0].querySelectorAll('[role="rowheader"]').length).toBeGreaterThanOrEqual(30);
        expect(grids[0].parentElement!.className).toContain("overflow-x-auto");
    });

    it("dims non-highlighted day headers without conflicting text colours", () => {
        render(<PriceHeatmap data={sampleData} includeVat={false} highlightedDates={["2024-01-03"]} />);
        const mobile = screen.getByRole("grid", { name: /by hour and day/i });
        const headers = Array.from(mobile.querySelectorAll('[role="columnheader"]')).slice(1);
        const dimmed = headers.filter((h) => h.className.includes("opacity-40"));
        const active = headers.filter((h) => !h.className.includes("opacity-40"));
        expect(active).toHaveLength(1);
        expect(dimmed.every((h) => h.className.includes("text-zinc-500") && !h.className.includes("text-zinc-300"))).toBe(true);
        expect(active[0].className).toContain("text-zinc-300");
        expect(active[0].className).not.toContain("text-zinc-500");
    });

    it("tapping a cell shows its details", () => {
        render(<PriceHeatmap data={sampleData} includeVat={false} />);
        const mobile = screen.getByRole("grid", { name: /by hour and day/i });
        // Row for 12:00, second day column (Tue 2 Jan 12:00 Tallinn = 10:00 UTC → 50 + 5 + 10 = 65 €/MWh)
        const noonRow = mobile.querySelectorAll(':scope > [role="row"]')[13];
        const cell = noonRow.querySelectorAll('[role="gridcell"]')[1] as HTMLElement;
        fireEvent.click(cell);
        expect(screen.getByText("6.50 ¢/kWh")).toBeInTheDocument();
        expect(screen.getByText("12:00")).toBeInTheDocument();
    });

    it("highlights every hour overlapping a 15-minute-aligned window", () => {
        // 10:15–12:15 Tallinn (EET, UTC+2) on 2024-01-01 → hours 10, 11, 12
        const cheapestWindow = {
            startTimestamp: "2024-01-01T08:15:00.000Z",
            endTimestamp: "2024-01-01T10:15:00.000Z",
            startHour: 10,
            hours: 2,
            averagePrice: 5.5,
            startIndex: 0,
            endIndex: 7,
        };
        render(<PriceHeatmap data={sampleData} includeVat={false} cheapestWindow={cheapestWindow} />);
        const desktop = screen.getByRole("grid", { name: /by day and hour/i });
        expect(desktop.querySelectorAll(".ring-2")).toHaveLength(3);
    });
});
