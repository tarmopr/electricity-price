import { describe, it, expect, vi } from "vitest";
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
        // starts at 0 (matching component initialisation)
        useMotionValue: (_initial: number) => ({
            get: () => 0,
            set: vi.fn(),
            on: vi.fn(),
        }),
        // calls the transform fn with 0 to produce the displayed string
        useTransform: (_mv: unknown, fn: (v: number) => string) => ({
            get: () => fn(0),
        }),
        animate: vi.fn(() => ({ stop: vi.fn() })),
    };
});

describe("AnimatedPrice", () => {
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

    it("formats with 2 decimal places by default", () => {
        // mock renders the transform output of fn(0) = "0.00" with decimals=2
        render(<AnimatedPrice value={3.5} />);
        expect(screen.getByText("0.00")).toBeInTheDocument();
    });

    it("respects custom decimals prop", () => {
        // mock renders fn(0) = "0.0" with decimals=1
        render(<AnimatedPrice value={3.5} decimals={1} />);
        expect(screen.getByText("0.0")).toBeInTheDocument();
    });

    it("animates toward the target value on mount", async () => {
        const { animate } = await import("framer-motion");
        render(<AnimatedPrice value={5.23} />);
        expect(animate).toHaveBeenCalledWith(
            expect.anything(),
            5.23,
            expect.objectContaining({ duration: 0.6, ease: "easeOut" })
        );
    });

    it("returns a cleanup function that stops animation", async () => {
        const stopFn = vi.fn();
        const { animate } = await import("framer-motion");
        vi.mocked(animate).mockReturnValueOnce({ stop: stopFn } as ReturnType<typeof animate>);

        const { unmount } = render(<AnimatedPrice value={5.23} />);
        unmount();
        expect(stopFn).toHaveBeenCalled();
    });
});
