import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BestWindowCard from "@/components/BestWindowCard";
import type { CheapestWindow } from "@/lib/cheapestWindow";

// Window: 01:15–09:15 Tallinn on Sat 15 Jun 2024 (EEST, UTC+3)
const window: CheapestWindow = {
  startTimestamp: "2024-06-14T22:15:00.000Z",
  endTimestamp: "2024-06-15T06:15:00.000Z",
  startHour: 1,
  hours: 8,
  averagePrice: 2.5,
  startIndex: 0,
  endIndex: 31,
};

// Fri 14 Jun 2024, 20:00 Tallinn
const nowMs = new Date("2024-06-14T17:00:00.000Z").getTime();

const baseProps = {
  presetLabel: "EV Charge",
  window: window as CheapestWindow | null,
  consumptionKwh: 40,
  durationHours: 8,
  startingNowPrice: 10 as number | null,
  readyBy: "07:00" as string | null,
  isPredicted: false,
  loading: false,
  nowMs: nowMs as number | null,
  onOpen: vi.fn(),
};

describe("BestWindowCard", () => {
  it("renders preset label, Tallinn range with day context, cost and avg price", () => {
    render(<BestWindowCard {...baseProps} />);
    expect(screen.getByText(/Best time · EV Charge/)).toBeInTheDocument();
    // now is 20:00 Tallinn and the window starts before 06:00 tomorrow → "Tonight"
    expect(screen.getByText("Tonight 01:15–09:15")).toBeInTheDocument();
    // 2.5 ¢/kWh × 40 kWh = €1.00
    expect(screen.getByText("€1.00")).toBeInTheDocument();
    expect(screen.getByText("2.50 ¢/kWh")).toBeInTheDocument();
  });

  it("shows savings vs starting now", () => {
    render(<BestWindowCard {...baseProps} />);
    // now: 10 ¢ × 40 = €4.00 → save €3.00
    expect(screen.getByText("Save €3.00 vs now")).toBeInTheDocument();
  });

  it("hides savings when there are none", () => {
    render(<BestWindowCard {...baseProps} startingNowPrice={2.5} />);
    expect(screen.queryByText(/Save €/)).not.toBeInTheDocument();
  });

  it("shows the ready-by hint or 'No deadline'", () => {
    const { rerender } = render(<BestWindowCard {...baseProps} />);
    expect(screen.getByText("Ready by 07:00")).toBeInTheDocument();
    rerender(<BestWindowCard {...baseProps} readyBy={null} />);
    expect(screen.getByText("No deadline")).toBeInTheDocument();
  });

  it("shows a Predicted badge only when applicable", () => {
    const { rerender } = render(<BestWindowCard {...baseProps} />);
    expect(screen.queryByText("Predicted")).not.toBeInTheDocument();
    rerender(<BestWindowCard {...baseProps} isPredicted />);
    expect(screen.getByText("Predicted")).toBeInTheDocument();
  });

  it("calls onOpen when tapped", () => {
    const onOpen = vi.fn();
    render(<BestWindowCard {...baseProps} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: /open cost calculator/i }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("announces range, cost and savings in the button's accessible name", () => {
    render(<BestWindowCard {...baseProps} />);
    const button = screen.getByRole("button");
    expect(button).not.toHaveAttribute("aria-label");
    expect(button).toHaveAccessibleName(/Tonight 01:15–09:15/);
    expect(button).toHaveAccessibleName(/€1\.00/);
    expect(button).toHaveAccessibleName(/Save €3\.00 vs now/);
    // No block-level div/p inside the button
    expect(button.querySelector("div, p, h2")).toBeNull();
  });

  it("shows the resolved deadline with day context (rolled-over ready-by)", () => {
    // now 06:30 Tallinn; deadline rolled to tomorrow 07:00
    const now = new Date("2024-06-15T03:30:00.000Z").getTime();
    render(
      <BestWindowCard
        {...baseProps}
        nowMs={now}
        readyByLimitMs={new Date("2024-06-16T04:00:00.000Z").getTime()}
      />
    );
    expect(screen.getByText("Ready by tomorrow 07:00")).toBeInTheDocument();
  });

  it("formats kWh compactly", () => {
    render(<BestWindowCard {...baseProps} consumptionKwh={12.345} />);
    expect(screen.getByText(/8 h · 12.35 kWh/)).toBeInTheDocument();
  });

  it("shows the searched (snapped) duration when no window fits", () => {
    render(<BestWindowCard {...baseProps} window={null} durationHours={2.3} />);
    expect(screen.getByText(/No 2.25 h window fits/)).toBeInTheDocument();
  });

  it("shows an error state instead of 'no window fits' when prices failed to load", () => {
    render(<BestWindowCard {...baseProps} window={null} error="boom" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load prices");
    expect(screen.queryByText(/window fits/)).not.toBeInTheDocument();
  });

  it("keeps showing a stale window if a refresh failed", () => {
    render(<BestWindowCard {...baseProps} error="boom" />);
    expect(screen.getByText("Tonight 01:15–09:15")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("hides savings below half a cent (shared threshold)", () => {
    // now 2.51 ¢ vs 2.5 ¢ × 40 kWh → €0.004 savings
    render(<BestWindowCard {...baseProps} startingNowPrice={2.51} />);
    expect(screen.queryByText(/Save €/)).not.toBeInTheDocument();
  });

  it("renders a loading state before the first result", () => {
    render(<BestWindowCard {...baseProps} window={null} loading />);
    expect(screen.getByLabelText("Finding the best window")).toBeInTheDocument();
  });

  it("no-fit at 23:30 (8 h, ready by 07:00) says when starting now finishes", () => {
    render(
      <BestWindowCard
        {...baseProps}
        window={null}
        nowMs={new Date("2024-06-14T20:30:00.000Z").getTime()} // 23:30 Tallinn
        readyByLimitMs={new Date("2024-06-15T04:00:00.000Z").getTime()} // 07:00
        startingNowEndMs={new Date("2024-06-15T04:30:00.000Z").getTime()} // 07:30
      />
    );
    expect(
      screen.getByText("No 8 h window fits before 07:00 — starting now finishes 07:30.")
    ).toBeInTheDocument();
    expect(screen.getByText("Ready by 07:00")).toBeInTheDocument();
  });

  it("explains when no window fits before the deadline", () => {
    render(<BestWindowCard {...baseProps} window={null} />);
    expect(screen.getByText(/No 8 h window fits before 07:00/)).toBeInTheDocument();
  });

  it("explains when no window fits without a deadline", () => {
    render(<BestWindowCard {...baseProps} window={null} readyBy={null} durationHours={2.5} />);
    expect(screen.getByText(/No 2.5 h window fits in the available prices/)).toBeInTheDocument();
  });
});
