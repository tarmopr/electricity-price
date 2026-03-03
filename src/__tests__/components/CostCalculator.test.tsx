import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CostCalculator from "@/components/CostCalculator";

describe("CostCalculator", () => {
  const noopNum = vi.fn();
  const noopNullableNum = vi.fn();
  const noopStr = vi.fn();
  const noopBool = vi.fn();

  const defaultProps = {
    isOpen: false,
    setIsOpen: noopBool,
    currentPrice: 10,
    cheapestWindowPrice: 3,
    meanPrice: 8,
    maxPrice: 20,
    consumptionKwh: 40,
    setConsumptionKwh: noopNum,
    durationHours: 8,
    setDurationHours: noopNum,
    untilHour: 22 as number | null,
    setUntilHour: noopNullableNum,
    activePreset: "EV Charge",
    setActivePreset: noopStr,
  };

  /** Shorthand for rendering with the panel expanded */
  const openProps = { ...defaultProps, isOpen: true };

  it("renders the header with calculator label", () => {
    render(<CostCalculator {...defaultProps} />);
    expect(screen.getByText("Cost Calculator")).toBeInTheDocument();
  });

  it("is collapsed when isOpen is false", () => {
    render(<CostCalculator {...defaultProps} />);
    // Preset buttons should not be visible when collapsed
    expect(screen.queryByText("Appliance")).not.toBeInTheDocument();
  });

  it("shows collapsed summary with current cost", () => {
    render(<CostCalculator {...defaultProps} />);
    // 40 kWh · 8h at 10 ¢/kWh = €4.00
    expect(screen.getByText(/40 kWh/)).toBeInTheDocument();
    expect(screen.getByText(/€4\.00 now/)).toBeInTheDocument();
  });

  it("calls setIsOpen when header is clicked", () => {
    const setIsOpen = vi.fn();
    render(<CostCalculator {...defaultProps} setIsOpen={setIsOpen} />);
    fireEvent.click(screen.getByText("Cost Calculator"));
    expect(setIsOpen).toHaveBeenCalledWith(true);
  });

  it("shows content when isOpen is true", () => {
    render(<CostCalculator {...openProps} />);
    expect(screen.getByText("Appliance")).toBeInTheDocument();
    expect(screen.getByText("Consumption")).toBeInTheDocument();
  });

  it("shows duration and until fields when open", () => {
    render(<CostCalculator {...openProps} />);
    expect(screen.getByText("Duration")).toBeInTheDocument();
    expect(screen.getByText("Until")).toBeInTheDocument();
  });

  it("shows all 4 estimate cards when open with full data", () => {
    render(<CostCalculator {...openProps} />);

    expect(screen.getByText("Current Price")).toBeInTheDocument();
    expect(screen.getByText("Cheapest Window")).toBeInTheDocument();
    expect(screen.getByText("Day Average")).toBeInTheDocument();
    expect(screen.getByText("Peak Price")).toBeInTheDocument();
  });

  it("shows correct euro values in estimate cards", () => {
    render(<CostCalculator {...openProps} />);

    // 10 ¢/kWh * 40 kWh = €4.00
    expect(screen.getByText("€4.00")).toBeInTheDocument();
    // 3 ¢/kWh * 40 kWh = €1.20
    expect(screen.getByText("€1.20")).toBeInTheDocument();
    // 8 ¢/kWh * 40 kWh = €3.20
    expect(screen.getByText("€3.20")).toBeInTheDocument();
    // 20 ¢/kWh * 40 kWh = €8.00
    expect(screen.getByText("€8.00")).toBeInTheDocument();
  });

  it("shows savings message when cheapest < current", () => {
    render(<CostCalculator {...openProps} />);

    // Savings = 4.00 - 1.20 = €2.80
    expect(screen.getByText(/Save €2\.80/)).toBeInTheDocument();
  });

  it("switches preset when clicking a different appliance", () => {
    const setConsumptionKwh = vi.fn();
    const setDurationHours = vi.fn();
    const setActivePreset = vi.fn();
    render(
      <CostCalculator
        {...openProps}
        setConsumptionKwh={setConsumptionKwh}
        setDurationHours={setDurationHours}
        setActivePreset={setActivePreset}
      />
    );

    // Click "Washing Machine" preset (2 kWh, 2h)
    fireEvent.click(screen.getByText("Washing Machine"));

    expect(setActivePreset).toHaveBeenCalledWith("Washing Machine");
    expect(setConsumptionKwh).toHaveBeenCalledWith(2);
    expect(setDurationHours).toHaveBeenCalledWith(2);
  });

  it("handles null prices gracefully", () => {
    render(
      <CostCalculator
        {...openProps}
        currentPrice={null}
        cheapestWindowPrice={null}
        meanPrice={null}
        maxPrice={null}
      />
    );
    expect(
      screen.getByText("No price data available for estimation.")
    ).toBeInTheDocument();
  });

  it("renders preset buttons with kWh and duration", () => {
    render(<CostCalculator {...openProps} />);

    expect(screen.getByText("EV Charge")).toBeInTheDocument();
    expect(screen.getByText("Washing Machine")).toBeInTheDocument();
    expect(screen.getByText("Dryer")).toBeInTheDocument();
    expect(screen.getByText("Dishwasher")).toBeInTheDocument();
    expect(screen.getByText("Sauna")).toBeInTheDocument();

    // Check that duration info is visible in preset buttons
    expect(screen.getByText("40 kWh · 8h")).toBeInTheDocument();
    expect(screen.getByText("15 kWh · 3h")).toBeInTheDocument();
  });

  it("shows until hour formatted time when set", () => {
    render(<CostCalculator {...openProps} untilHour={22} />);
    expect(screen.getByText("22:00")).toBeInTheDocument();
  });

  it("shows 'No limit' when until hour is null", () => {
    render(<CostCalculator {...openProps} untilHour={null} />);
    expect(screen.getByText("No limit")).toBeInTheDocument();
  });

  it("does not show collapsed summary when no current estimate", () => {
    render(
      <CostCalculator
        {...defaultProps}
        currentPrice={null}
        consumptionKwh={0}
      />
    );
    // No summary should appear (consumptionKwh is 0 and currentPrice is null)
    expect(screen.queryByText(/€.*now/)).not.toBeInTheDocument();
  });
});
