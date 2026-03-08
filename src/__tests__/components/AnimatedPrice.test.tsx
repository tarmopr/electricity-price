import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import AnimatedPrice from "@/components/AnimatedPrice";

// framer-motion uses browser animation APIs not available in jsdom
vi.mock("framer-motion", () => {
    const React = require("react");
    return {
        motion: {
            span: React.forwardRef(
                (
                    { children, className }: { children: unknown; className?: string },
                    ref: React.Ref<HTMLSpanElement>
                ) =>
                    React.createElement(
                        "span",
                        { ref, className },
                        typeof children === "object" && children !== null && "get" in (children as object)
                            ? String((children as { get: () => unknown }).get())
                            : children
                    )
            ),
        },
        useMotionValue: (initial: number) => ({
            get: () => initial,
            set: vi.fn(),
            on: vi.fn(),
        }),
        useTransform: (_mv: unknown, fn: (v: number) => string) => ({
            get: () => fn(0),
        }),
        animate: vi.fn(() => ({ stop: vi.fn() })),
    };
});

describe("AnimatedPrice", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders a span element", () => {
        const { container } = render(<AnimatedPrice value={5.23} />);
        expect(container.querySelector("span")).toBeInTheDocument();
    });

    it("applies className to the span", () => {
        const { container } = render(
            <AnimatedPrice value={5.23} className="text-4xl font-bold" />
        );
        expect(container.querySelector("span")).toHaveClass("text-4xl", "font-bold");
    });

    it("defaults to 2 decimal places", () => {
        // The mock useTransform fn is called with the initial value
        // We verify the component renders without crashing with a standard value
        render(<AnimatedPrice value={3.5} />);
        expect(screen.getByText("0.00")).toBeInTheDocument();
    });

    it("respects custom decimals prop", () => {
        render(<AnimatedPrice value={3.5} decimals={1} />);
        expect(screen.getByText("0.0")).toBeInTheDocument();
    });

    it("calls animate when value changes", async () => {
        const { animate } = await import("framer-motion");
        render(<AnimatedPrice value={5.23} />);
        expect(animate).toHaveBeenCalledWith(
            expect.anything(),
            5.23,
            expect.objectContaining({ duration: 0.6, ease: "easeOut" })
        );
    });
});
