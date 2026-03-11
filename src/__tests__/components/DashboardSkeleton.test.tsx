import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardSkeleton from "@/components/DashboardSkeleton";

describe("DashboardSkeleton", () => {
    it("renders without crashing", () => {
        const { container } = render(<DashboardSkeleton />);
        expect(container.firstChild).toBeTruthy();
    });

    it("has aria-busy=true for screen readers", () => {
        render(<DashboardSkeleton />);
        expect(screen.getByRole("generic", { busy: true })).toBeInTheDocument();
    });

    it("has accessible loading label", () => {
        render(<DashboardSkeleton />);
        expect(screen.getByLabelText(/loading market data/i)).toBeInTheDocument();
    });

    it("applies animate-pulse class for shimmer effect", () => {
        const { container } = render(<DashboardSkeleton />);
        expect(container.firstChild).toHaveClass("animate-pulse");
    });

    it("renders price card placeholder with glassmorphism styling", () => {
        const { container } = render(<DashboardSkeleton />);
        // Price card area: rounded-2xl with backdrop-blur
        const priceCard = container.querySelector(".backdrop-blur-sm");
        expect(priceCard).toBeTruthy();
    });

    it("renders controls placeholder area", () => {
        const { container } = render(<DashboardSkeleton />);
        // Controls area has backdrop-blur-2xl
        const controlsArea = container.querySelector(".backdrop-blur-2xl");
        expect(controlsArea).toBeTruthy();
    });

    it("renders chart area placeholder with faux bars", () => {
        const { container } = render(<DashboardSkeleton />);
        // Chart placeholder has h-[300px] or h-[360px]
        const chartArea = container.querySelector(".h-\\[300px\\]");
        expect(chartArea).toBeTruthy();
    });

    it("renders the top grid layout (price card + controls)", () => {
        const { container } = render(<DashboardSkeleton />);
        // top row grid
        const grid = container.querySelector(".grid.grid-cols-1.lg\\:grid-cols-3");
        expect(grid).toBeTruthy();
    });
});
