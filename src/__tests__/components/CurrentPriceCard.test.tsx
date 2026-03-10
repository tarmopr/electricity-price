import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CurrentPriceCard from "@/components/CurrentPriceCard";
import type { ElectricityPrice } from "@/lib/api";

// AnimatedPrice uses Framer Motion which requires browser animation APIs
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
        useMotionValue: (_initial: number) => ({ get: () => 0, set: vi.fn(), on: vi.fn() }),
        useTransform: (_mv: unknown, fn: (v: number) => string) => ({ get: () => fn(0) }),
        animate: vi.fn(() => ({ stop: vi.fn() })),
    };
});

function makePrice(eurMwh: number, tsIso = "2024-01-01T12:00:00.000Z"): ElectricityPrice {
    return {
        timestamp: tsIso,
        date: new Date(tsIso),
        priceEurMwh: eurMwh,
        priceCentsKwh: eurMwh / 10,
    };
}

describe("CurrentPriceCard", () => {
    it("renders loading skeleton when currentPrice is null", () => {
        const { container } = render(
            <CurrentPriceCard currentPrice={null} includeVat={false} />
        );
        // Skeleton has animate-pulse class
        expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    });

    it("renders the price label", () => {
        render(
            <CurrentPriceCard currentPrice={makePrice(100)} includeVat={false} />
        );
        expect(screen.getByText(/current price/i)).toBeInTheDocument();
    });

    it("renders ¢/kWh unit", () => {
        render(
            <CurrentPriceCard currentPrice={makePrice(100)} includeVat={false} />
        );
        expect(screen.getByText("¢/kWh")).toBeInTheDocument();
    });

    it("shows median comparison when medianPrice is provided", () => {
        render(
            <CurrentPriceCard
                currentPrice={makePrice(100)}
                medianPrice={12}
                includeVat={false}
            />
        );
        expect(screen.getByText(/median/i)).toBeInTheDocument();
    });

    it("does not show median when medianPrice is undefined", () => {
        render(
            <CurrentPriceCard currentPrice={makePrice(100)} includeVat={false} />
        );
        expect(screen.queryByText(/median/i)).not.toBeInTheDocument();
    });

    it("shows previous price comparison row when previousPrice is provided", () => {
        render(
            <CurrentPriceCard
                currentPrice={makePrice(100)}
                previousPrice={makePrice(80)}
                includeVat={false}
            />
        );
        // "prev" is the exact sm:hidden abbreviation (the full "vs previous 15min" is hidden on small screens)
        expect(screen.getByText("prev")).toBeInTheDocument();
    });

    it("shows next price comparison row when nextPrice is provided", () => {
        render(
            <CurrentPriceCard
                currentPrice={makePrice(100)}
                nextPrice={makePrice(120)}
                includeVat={false}
            />
        );
        // "next" is the exact sm:hidden abbreviation (the full "next 15min" is hidden on small screens)
        expect(screen.getByText("next")).toBeInTheDocument();
    });

    it("does not show comparison rows when previous/next are absent", () => {
        render(
            <CurrentPriceCard currentPrice={makePrice(100)} includeVat={false} />
        );
        expect(screen.queryByText("prev")).not.toBeInTheDocument();
        expect(screen.queryByText("next")).not.toBeInTheDocument();
    });
});
