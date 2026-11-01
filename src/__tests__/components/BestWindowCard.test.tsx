import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

/** Matches an element whose own full text content equals `text` (text split across spans). */
function byText(text: string) {
  return (_: string, el: Element | null) =>
    !!el && el.textContent === text && Array.from(el.children).every((c) => c.textContent !== text);
}
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
    expect(screen.getByText(byText("Best time · EV Charge"))).toBeInTheDocument();
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
    expect(screen.getByText(byText("Ready by 07:00"))).toBeInTheDocument();
    rerender(<BestWindowCard {...baseProps} readyBy={null} />);
    expect(screen.getByText("No deadline")).toBeInTheDocument();
  });

  it("shows a Predicted badge only when applicable", () => {
    const { rerender } = render(<BestWindowCard {...baseProps} />);
    expect(screen.queryByText("Predicted")).not.toBeInTheDocument();
    rerender(<BestWindowCard {...baseProps} isPredicted />);
    // Header badge (sm+) and a mobile copy on the meta line (<sm)
    const badges = screen.getAllByText("Predicted");
    expect(badges).toHaveLength(2);
    expect(badges[0].className).toContain("hidden sm:inline-flex");
    expect(badges[1].className).toContain("sm:hidden");
    expect(badges[1].parentElement).toHaveTextContent(/8 h · 40 kWh/);
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
    expect(screen.getByText(byText("Ready by tomorrow 07:00"))).toBeInTheDocument();
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

  it("no-window message names neither the deadline nor a finish time when no full window exists", () => {
    render(
      <BestWindowCard
        {...baseProps}
        window={null}
        nowMs={new Date("2024-06-14T20:30:00.000Z").getTime()} // 23:30 Tallinn
        readyByLimitMs={new Date("2024-06-15T04:00:00.000Z").getTime()} // 07:00
        startingNowEndMs={new Date("2024-06-15T04:30:00.000Z").getTime()} // 07:30
      />
    );
    // A null window means no full-length window exists at all (the 23:30 case falls back past the deadline)
    expect(screen.getByText("No 8 h window fits in the available prices. Tap to adjust.")).toBeInTheDocument();
    expect(screen.queryByText(/starting now finishes/)).not.toBeInTheDocument();
    expect(screen.getByText(byText("Ready by 07:00"))).toBeInTheDocument();
  });

  it("shows the fallback window with an amber warning when nothing fits before ready-by", () => {
    // 00:16 Tallinn, EV 8 h, ready by 07:00 → best full window 09:00–17:00 (finishes late)
    const fallback: CheapestWindow = {
      ...window,
      startTimestamp: "2024-06-15T06:00:00.000Z",
      endTimestamp: "2024-06-15T14:00:00.000Z",
      averagePrice: 2,
      isPredicted: true,
    };
    render(
      <BestWindowCard
        {...baseProps}
        window={fallback}
        isPredicted
        ignoresDeadline
        nowMs={new Date("2024-06-14T21:16:00.000Z").getTime()}
        readyByLimitMs={new Date("2024-06-15T04:00:00.000Z").getTime()}
        startingNowEndMs={new Date("2024-06-15T05:15:00.000Z").getTime()}
      />
    );
    expect(screen.getByText("Today 09:00–17:00")).toBeInTheDocument();
    // Plain text, no live region inside the button (the calculator owns the status region)
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    const warning = screen.getByText("Finishes after 07:00 — no 8 h window fits before your ready-by time")
      .closest(".border-amber-500\\/30") as HTMLElement;
    expect(warning).not.toBeNull();
    expect(warning).toHaveTextContent("Starting now finishes 08:15");
    // Savings badge and predicted badge still apply in fallback mode (now 10 ¢ vs 2 ¢ × 40 kWh → €3.20)
    expect(screen.getByText("Save €3.20 vs now")).toBeInTheDocument();
    expect(screen.getAllByText("Predicted").length).toBeGreaterThan(0);
  });

  it("mobile header leads with the preset name, not truncated, with badge + deadline present", () => {
    render(<BestWindowCard {...baseProps} presetLabel="Washing Machine" isPredicted />);
    const label = screen.getByText(byText("Best time · Washing Machine"));
    // "Best time ·" is desktop-only; the preset name itself is not in a hidden or truncating element
    expect(screen.getByText("Best time ·").className).toContain("hidden sm:inline");
    let node: HTMLElement | null = label;
    while (node && node.tagName !== "BUTTON") {
      expect(node.classList.contains("truncate")).toBe(false);
      expect(node.classList.contains("hidden")).toBe(false);
      node = node.parentElement;
    }
    // Ready-by: "Ready by" is screen-reader-only on phones, the time stays visible
    expect(screen.getByText("Ready by").className).toContain("sr-only sm:not-sr-only");
    expect(screen.getByRole("button")).toHaveAccessibleName(/Ready by 07:00/);
  });

  it("shows no deadline warning when the window fits", () => {
    render(<BestWindowCard {...baseProps} ignoresDeadline={false} />);
    expect(screen.queryByText(/Finishes after/)).not.toBeInTheDocument();
  });

  it("explains when no window fits even with a deadline set", () => {
    render(<BestWindowCard {...baseProps} window={null} />);
    expect(screen.getByText(/No 8 h window fits in the available prices/)).toBeInTheDocument();
  });

  it("explains when no window fits without a deadline", () => {
    render(<BestWindowCard {...baseProps} window={null} readyBy={null} durationHours={2.5} />);
    expect(screen.getByText(/No 2.5 h window fits in the available prices/)).toBeInTheDocument();
  });

  it("says no window fits before predicted prices start when they are excluded", () => {
    render(
      <BestWindowCard
        {...baseProps}
        window={null}
        excludesPredicted
        predictedFromMs={new Date("2024-06-14T22:00:00.000Z").getTime()} // 01:00 Tallinn
      />
    );
    expect(
      screen.getByText("No 8 h window fits before predicted prices start (01:00). Tap to adjust.")
    ).toBeInTheDocument();
  });

  it("falls back to the generic no-window text when predictions are excluded but none are loaded", () => {
    render(<BestWindowCard {...baseProps} window={null} excludesPredicted predictedFromMs={null} />);
    expect(
      screen.getByText("No 8 h window fits in the available prices. Tap to adjust.")
    ).toBeInTheDocument();
    expect(screen.queryByText(/before predicted prices start/)).not.toBeInTheDocument();
  });
});

describe("BestWindowCard failure states", () => {
  it("flags stale data when a refresh failed but an earlier window is still shown", () => {
    render(<BestWindowCard {...baseProps} error="Failed to fetch prices: 500" />);
    expect(screen.getByText("Tonight 01:15–09:15")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/Couldn.t refresh prices — showing the last loaded data/);
  });

  it("says it retries automatically when the first load failed (no retry control exists)", () => {
    render(<BestWindowCard {...baseProps} window={null} error="boom" />);
    expect(screen.getByRole("alert")).toHaveTextContent(/retrying automatically/);
    expect(screen.queryByText(/try again/i)).not.toBeInTheDocument();
  });

  it("shows a no-data state instead of blaming the settings when the load returned no prices", () => {
    render(<BestWindowCard {...baseProps} window={null} noData />);
    expect(screen.getByText(/No price data available yet/)).toBeInTheDocument();
    expect(screen.queryByText(/window fits/)).not.toBeInTheDocument();
  });

  it("does not blame the ready-by time when no full-length window exists at all", () => {
    // The hook falls back to a window ignoring the deadline, so null means no full window anywhere
    render(<BestWindowCard {...baseProps} window={null} readyBy="07:00" />);
    expect(screen.getByText("No 8 h window fits in the available prices. Tap to adjust.")).toBeInTheDocument();
  });

  it("keeps the error (no skeleton flicker) while a retry is in flight", () => {
    render(<BestWindowCard {...baseProps} window={null} error="boom" loading />);
    expect(screen.getByRole("alert")).toHaveTextContent(/Couldn.t load prices/);
    expect(screen.queryByLabelText("Finding the best window")).not.toBeInTheDocument();
  });

  it("keeps live regions outside the button so screen readers announce them", () => {
    const { rerender } = render(<BestWindowCard {...baseProps} window={null} error="boom" />);
    expect(screen.getByRole("alert").closest("button")).toBeNull();
    rerender(<BestWindowCard {...baseProps} error="boom" />);
    expect(screen.getByRole("status").closest("button")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(/Couldn.t refresh prices/);
  });
});
