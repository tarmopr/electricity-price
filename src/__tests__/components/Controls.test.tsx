import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
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

    it("lists Next 24h as the first period pill", () => {
        render(<Controls {...defaultProps} />);
        const pills = within(screen.getByRole("group", { name: /period selection/i })).getAllByRole("button");
        expect(pills[0]).toHaveAccessibleName("Next 24h");
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
        expect(vatButton).toBeTruthy();
        fireEvent.click(vatButton!);
        // includeVat starts false → clicking toggles to true
        expect(defaultProps.setIncludeVat).toHaveBeenCalledWith(true);
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

    it("renders a 'Next 24h' primary pill and selects it", () => {
        const setPeriod = vi.fn();
        render(<Controls {...defaultProps} setPeriod={setPeriod} />);
        const btn = screen.getByRole("button", { name: /next 24h/i });
        fireEvent.click(btn);
        expect(setPeriod).toHaveBeenCalledWith("next_24h");
    });

    it("marks 'Next 24h' as active when selected", () => {
        render(<Controls {...defaultProps} period="next_24h" />);
        expect(screen.getByRole("button", { name: /next 24h/i })).toHaveAttribute("aria-pressed", "true");
    });

    // ─── Mobile layout ──────────────────────────────────────────────────────

    /** True if the element or any ancestor has the plain `hidden` class (display:none below md). */
    function isInsideHiddenContainer(el: HTMLElement): boolean {
        let node: HTMLElement | null = el;
        while (node) {
            if (node.classList.contains("hidden")) return true;
            node = node.parentElement;
        }
        return false;
    }

    it("period pills and VAT toggle are visible on mobile without expanding Chart Controls", () => {
        render(<Controls {...defaultProps} />);
        const toggle = screen.getByRole("button", { name: /toggle chart controls/i });
        expect(toggle).toHaveAttribute("aria-expanded", "false");

        const periodGroup = screen.getByRole("group", { name: /period selection/i });
        expect(isInsideHiddenContainer(periodGroup)).toBe(false);
        const vatButton = screen.getByRole("button", { name: /include vat/i });
        expect(isInsideHiddenContainer(vatButton)).toBe(false);
    });

    it("stat overlays and price alert are collapsed on mobile until expanded", () => {
        render(<Controls {...defaultProps} />);
        const nowBtn = screen.getByRole("button", { name: /^now$/i });
        const alertBtn = screen.getByRole("button", { name: /alert/i });
        expect(isInsideHiddenContainer(nowBtn)).toBe(true);
        expect(isInsideHiddenContainer(alertBtn)).toBe(true);

        fireEvent.click(screen.getByRole("button", { name: /toggle chart controls/i }));
        expect(isInsideHiddenContainer(nowBtn)).toBe(false);
        expect(isInsideHiddenContainer(alertBtn)).toBe(false);
    });

    it("period pills have ≥44px touch targets on mobile and compact desktop sizing", () => {
        render(<Controls {...defaultProps} />);
        const todayBtn = screen.getByRole("button", { name: /^today$/i });
        expect(todayBtn.className).toContain("min-h-11");
        expect(todayBtn.className).toContain("sm:min-h-0");
    });

    it("alert threshold uses the numeric field (comma decimal commits)", () => {
        const setAlertConfig = vi.fn();
        render(
            <Controls
                {...defaultProps}
                alertConfig={{ ...defaultAlertConfig, enabled: true }}
                setAlertConfig={setAlertConfig}
            />
        );
        const input = screen.getByLabelText(/^alert threshold/i);
        expect(input).toHaveAttribute("inputmode", "decimal");
        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: "" } });
        expect(setAlertConfig).not.toHaveBeenCalled();
        fireEvent.change(input, { target: { value: "7,5" } });
        expect(setAlertConfig).toHaveBeenLastCalledWith({ enabled: true, threshold: 7.5, direction: "below" });
    });

    it("alert threshold stepper increments by 0.5", () => {
        const setAlertConfig = vi.fn();
        render(
            <Controls
                {...defaultProps}
                alertConfig={{ ...defaultAlertConfig, enabled: true }}
                setAlertConfig={setAlertConfig}
            />
        );
        fireEvent.click(screen.getByRole("button", { name: /increase alert threshold/i }));
        expect(setAlertConfig).toHaveBeenLastCalledWith({ enabled: true, threshold: 10.5, direction: "below" });
    });

    it("alert threshold accepts negative prices (spot prices go below zero)", () => {
        const setAlertConfig = vi.fn();
        render(
            <Controls
                {...defaultProps}
                alertConfig={{ ...defaultAlertConfig, enabled: true }}
                setAlertConfig={setAlertConfig}
            />
        );
        const input = screen.getByLabelText(/^alert threshold/i);
        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: "-1,5" } });
        expect(setAlertConfig).toHaveBeenLastCalledWith({ enabled: true, threshold: -1.5, direction: "below" });
    });
});
