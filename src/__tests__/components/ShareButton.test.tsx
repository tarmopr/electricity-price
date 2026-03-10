import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ShareButton from "@/components/ShareButton";

vi.mock("@/lib/shareState", () => ({
    buildShareUrl: vi.fn(
        (base: string, _state: unknown) => `${base}?period=today&vat=1`
    ),
    copyToClipboard: vi.fn(),
}));

const { buildShareUrl, copyToClipboard } = vi.mocked(await import("@/lib/shareState"));

describe("ShareButton", () => {
    const defaultState = {
        period: "today" as const,
        includeVat: true,
        viewMode: "chart" as const,
    };

    beforeEach(() => {
        // Reset navigator.share to undefined (no native share API)
        Object.defineProperty(navigator, "share", {
            value: undefined,
            configurable: true,
        });
        copyToClipboard.mockResolvedValue(true);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("renders a share button", () => {
        render(<ShareButton state={defaultState} />);
        const btn = screen.getByRole("button", { name: /share/i });
        expect(btn).toBeInTheDocument();
    });

    it("calls buildShareUrl with correct state on click", async () => {
        render(<ShareButton state={defaultState} />);
        fireEvent.click(screen.getByRole("button", { name: /share/i }));
        expect(buildShareUrl).toHaveBeenCalledWith(
            expect.stringContaining(""),
            defaultState
        );
    });

    it("copies URL to clipboard when native share is unavailable", async () => {
        render(<ShareButton state={defaultState} />);
        fireEvent.click(screen.getByRole("button", { name: /share/i }));

        await waitFor(() => {
            expect(copyToClipboard).toHaveBeenCalled();
        });
    });

    it("shows 'Copied!' feedback after successful copy", async () => {
        render(<ShareButton state={defaultState} />);
        fireEvent.click(screen.getByRole("button", { name: /share/i }));

        await waitFor(() => {
            expect(screen.getByText(/copied/i)).toBeInTheDocument();
        });
    });

    it("uses native share API when available", async () => {
        const mockShare = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, "share", {
            value: mockShare,
            configurable: true,
        });

        render(<ShareButton state={defaultState} />);
        fireEvent.click(screen.getByRole("button", { name: /share/i }));

        await waitFor(() => {
            expect(mockShare).toHaveBeenCalled();
        });
        // Should NOT fall through to clipboard
        expect(copyToClipboard).not.toHaveBeenCalled();
    });
});
