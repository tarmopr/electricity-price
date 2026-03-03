import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PriceAlertBanner from "@/components/PriceAlertBanner";
import { AlertState } from "@/lib/priceAlerts";

describe("PriceAlertBanner", () => {
  const cheapAlert: AlertState = {
    triggered: true,
    message: "Price is 3.20 ¢/kWh — below your 5.00 ¢ threshold",
    type: "cheap",
  };

  const expensiveAlert: AlertState = {
    triggered: true,
    message: "Price is 15.00 ¢/kWh — above your 10.00 ¢ threshold",
    type: "expensive",
  };

  it("renders the alert message", () => {
    render(<PriceAlertBanner alert={cheapAlert} onDismiss={() => {}} />);
    expect(screen.getByText(cheapAlert.message)).toBeInTheDocument();
  });

  it("has role=alert for accessibility", () => {
    render(<PriceAlertBanner alert={cheapAlert} onDismiss={() => {}} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("calls onDismiss when dismiss button is clicked", () => {
    const onDismiss = vi.fn();
    render(<PriceAlertBanner alert={cheapAlert} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByLabelText("Dismiss alert"));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("applies green styling for cheap alerts", () => {
    render(<PriceAlertBanner alert={cheapAlert} onDismiss={() => {}} />);
    const alertEl = screen.getByRole("alert");
    expect(alertEl.className).toContain("green");
  });

  it("applies red styling for expensive alerts", () => {
    render(<PriceAlertBanner alert={expensiveAlert} onDismiss={() => {}} />);
    const alertEl = screen.getByRole("alert");
    expect(alertEl.className).toContain("red");
  });

  it("renders dismiss button with accessible label", () => {
    render(<PriceAlertBanner alert={cheapAlert} onDismiss={() => {}} />);
    const btn = screen.getByLabelText("Dismiss alert");
    expect(btn).toBeInTheDocument();
    expect(btn.tagName).toBe("BUTTON");
  });
});
