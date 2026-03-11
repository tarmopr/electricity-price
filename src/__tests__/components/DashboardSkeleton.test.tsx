import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardSkeleton from "@/components/DashboardSkeleton";

describe("DashboardSkeleton", () => {
    it("renders without crashing", () => {
        const { container } = render(<DashboardSkeleton />);
        expect(container.firstChild).toBeTruthy();
    });

    it("has aria-busy=true and accessible loading label for screen readers", () => {
        render(<DashboardSkeleton />);
        const root = screen.getByLabelText(/loading market data/i);
        expect(root).toBeInTheDocument();
        expect(root).toHaveAttribute("aria-busy", "true");
    });

    it("applies animate-pulse class for shimmer effect", () => {
        const { container } = render(<DashboardSkeleton />);
        expect(container.firstChild).toHaveClass("animate-pulse");
    });

    it("renders price card placeholder with glassmorphism styling", () => {
        const { container } = render(<DashboardSkeleton />);
        // Price card area: rounded-2xl with backdrop-blur-sm (distinct from controls)
        const priceCard = container.querySelector(".backdrop-blur-sm");
        expect(priceCard).toBeTruthy();
    });

    it("renders controls placeholder inside the lg:col-span-2 column", () => {
        const { container } = render(<DashboardSkeleton />);
        // Controls are in the lg:col-span-2 column
        const controlsCol = container.querySelector(".lg\\:col-span-2");
        expect(controlsCol).toBeTruthy();
        // The inner panel has backdrop-blur-2xl
        expect(controlsCol!.querySelector(".backdrop-blur-2xl")).toBeTruthy();
    });

    it("renders chart area placeholder with faux bars", () => {
        const { container } = render(<DashboardSkeleton />);
        // Chart placeholder has h-[300px]
        const chartArea = container.querySelector(".h-\\[300px\\]");
        expect(chartArea).toBeTruthy();
    });

    it("renders the top grid layout (price card + controls)", () => {
        const { container } = render(<DashboardSkeleton />);
        const grid = container.querySelector(".grid.grid-cols-1.lg\\:grid-cols-3");
        expect(grid).toBeTruthy();
    });

    it("renders period and stat overlay pill placeholders", () => {
        const { container } = render(<DashboardSkeleton />);
        // At least 5 period pills + 4 stat pills + 2 VAT/alert pills = 11+ pill divs
        const pills = container.querySelectorAll(".rounded-full.bg-zinc-800");
        expect(pills.length).toBeGreaterThanOrEqual(11);
    });
});
