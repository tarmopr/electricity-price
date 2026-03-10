import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Controls from "@/components/Controls";
import type { AlertConfig } from "@/lib/priceAlerts";

const defaultAlertConfig: AlertConfig = {
    enabled: false,
    threshold: 10,
    direction: "below",
};

const defaultProps = {
    includeVat: false,
    setIncludeVat: vi.fn(),
    showNow: false,
    setShowNow: vi.fn(),
    showMean: false,
    setShowMean: vi.fn(),
    showMedian: false,
    setShowMedian: vi.fn(),
    showP75: false,
    setShowP75: vi.fn(),
    showP90: false,
    setShowP90: vi.fn(),
    showP95: false,
    setShowP95: vi.fn(),
    showAvg7d: false,
    setShowAvg7d: vi.fn(),
    showAvg30d: false,
    setShowAvg30d: vi.fn(),
    period: "today" as const,
    setPeriod: vi.fn(),
    customStart: "2024-01-01",
    setCustomStart: vi.fn(),
    customEnd: "2024-01-31",
    setCustomEnd: vi.fn(),
    alertConfig: defaultAlertConfig,
    setAlertConfig: vi.fn(),
};

describe("Controls", () => {
    it("renders the primary period buttons", () => {
        render(<Controls {...defaultProps} />);
        expect(screen.getByRole("button", { name: /yesterday/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /today/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /tomorrow/i })).toBeInTheDocument();
    });

    it("calls setPeriod when a period button is clicked", () => {
        render(<Controls {...defaultProps} />);
        fireEvent.click(screen.getByRole("button", { name: /yesterday/i }));
        expect(defaultProps.setPeriod).toHaveBeenCalledWith("yesterday");
    });

    it("renders VAT toggle", () => {
        render(<Controls {...defaultProps} />);
        expect(screen.getByText(/vat/i)).toBeInTheDocument();
    });

    it("calls setIncludeVat when VAT toggle is clicked", () => {
        render(<Controls {...defaultProps} />);
        // Find the VAT toggle button
        const vatButton = screen.getByText(/vat/i).closest("button");
        if (vatButton) {
            fireEvent.click(vatButton);
            expect(defaultProps.setIncludeVat).toHaveBeenCalled();
        }
    });

    it("highlights the active period pill", () => {
        render(<Controls {...defaultProps} period="today" />);
        const todayBtn = screen.getByRole("button", { name: /today/i });
        // Active button should have pressed state
        expect(todayBtn).toHaveAttribute("aria-pressed", "true");
    });

    it("renders 'More' dropdown trigger", () => {
        render(<Controls {...defaultProps} />);
        // Two "More" buttons: one for period dropdown (aria-haspopup="menu") and one for stat overlays
        const moreBtns = screen.getAllByRole("button", { name: /^more/i });
        expect(moreBtns.length).toBeGreaterThanOrEqual(1);
    });

    it("shows more periods when 'More' dropdown is opened", () => {
        const { container } = render(<Controls {...defaultProps} />);
        // Click the period "More" button (aria-haspopup="menu"), not the stat overlay one
        const periodMoreBtn = container.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]');
        expect(periodMoreBtn).toBeInTheDocument();
        if (periodMoreBtn) {
            fireEvent.click(periodMoreBtn);
            expect(screen.getByRole("menuitem", { name: /last 7 days/i })).toBeInTheDocument();
        }
    });

    it("shows the active period button with aria-pressed=true", () => {
        render(<Controls {...defaultProps} period="tomorrow" />);
        const tomorrowBtn = screen.getByRole("button", { name: /tomorrow/i });
        expect(tomorrowBtn).toHaveAttribute("aria-pressed", "true");
        const todayBtn = screen.getByRole("button", { name: /today/i });
        expect(todayBtn).toHaveAttribute("aria-pressed", "false");
    });
});
