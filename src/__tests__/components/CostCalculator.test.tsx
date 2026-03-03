import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CostCalculator from "@/components/CostCalculator";

describe("CostCalculator", () => {
  const defaultProps = {
    currentPrice: 10,
    cheapestPrice: 3,
    meanPrice: 8,
    maxPrice: 20,
  };

  it("renders the header with calculator label", () => {
    render(<CostCalculator {...defaultProps} />);
    expect(screen.getByText("Cost Calculator")).toBeInTheDocument();
  });

  it("is collapsed by default", () => {
    render(<CostCalculator {...defaultProps} />);
    // Preset buttons should not be visible when collapsed
    expect(screen.queryByText("Appliance")).not.toBeInTheDocument();
  });

  it("shows collapsed summary with current cost", () => {
    render(<CostCalculator {...defaultProps} />);
    // Default is EV Charge 40 kWh at 10 ¢/kWh = €4.00
    expect(screen.getByText(/40 kWh/)).toBeInTheDocument();
    expect(screen.getByText(/€4\.00 now/)).toBeInTheDocument();
  });

  it("expands when clicked", () => {
    render(<CostCalculator {...defaultProps} />);
    fireEvent.click(screen.getByText("Cost Calculator"));
    expect(screen.getByText("Appliance")).toBeInTheDocument();
    expect(screen.getByText("Consumption")).toBeInTheDocument();
  });

  it("shows all 4 estimate cards when expanded with full data", () => {
    render(<CostCalculator {...defaultProps} />);
    fireEvent.click(screen.getByText("Cost Calculator"));

    expect(screen.getByText("Current Price")).toBeInTheDocument();
    expect(screen.getByText("Cheapest Window")).toBeInTheDocument();
    expect(screen.getByText("Day Average")).toBeInTheDocument();
    expect(screen.getByText("Peak Price")).toBeInTheDocument();
  });

  it("shows correct euro values in estimate cards", () => {
    render(<CostCalculator {...defaultProps} />);
    fireEvent.click(screen.getByText("Cost Calculator"));

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
    render(<CostCalculator {...defaultProps} />);
    fireEvent.click(screen.getByText("Cost Calculator"));

    // Savings = 4.00 - 1.20 = €2.80
    expect(screen.getByText(/Save €2\.80/)).toBeInTheDocument();
  });

  it("switches preset when clicking a different appliance", () => {
    render(<CostCalculator {...defaultProps} />);
    fireEvent.click(screen.getByText("Cost Calculator"));

    // Click "Washing Machine" preset (2 kWh)
    fireEvent.click(screen.getByText("Washing Machine"));

    // 10 ¢/kWh * 2 kWh = €0.20
    expect(screen.getByText("€0.20")).toBeInTheDocument();
  });

  it("handles null prices gracefully", () => {
    render(
      <CostCalculator
        currentPrice={null}
        cheapestPrice={null}
        meanPrice={null}
        maxPrice={null}
      />
    );
    fireEvent.click(screen.getByText("Cost Calculator"));
    expect(screen.getByText("No price data available for estimation.")).toBeInTheDocument();
  });

  it("renders preset buttons", () => {
    render(<CostCalculator {...defaultProps} />);
    fireEvent.click(screen.getByText("Cost Calculator"));

    expect(screen.getByText("EV Charge")).toBeInTheDocument();
    expect(screen.getByText("Washing Machine")).toBeInTheDocument();
    expect(screen.getByText("Dryer")).toBeInTheDocument();
    expect(screen.getByText("Dishwasher")).toBeInTheDocument();
    expect(screen.getByText("Sauna")).toBeInTheDocument();
  });
});
