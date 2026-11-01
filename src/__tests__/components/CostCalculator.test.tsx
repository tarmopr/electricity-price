import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import CostCalculator from "@/components/CostCalculator";
import { CheapestWindow } from "@/lib/cheapestWindow";

describe("CostCalculator", () => {
  const noopNum = vi.fn();
  const noopStr = vi.fn();
  const noopBool = vi.fn();
  const noopReadyBy = vi.fn();

  // 01:00–09:00 Tallinn (EEST, UTC+3) on 2024-06-05
  const mockCheapestWindow: CheapestWindow = {
    startTimestamp: "2024-06-04T22:00:00.000Z",
    endTimestamp: "2024-06-05T06:00:00.000Z",
    startHour: 1,
    hours: 8,
    averagePrice: 3,
    startIndex: 2,
    endIndex: 33,
  };

  const defaultProps = {
    isOpen: false,
    setIsOpen: noopBool,
    currentPrice: 10,
    cheapestWindow: mockCheapestWindow as CheapestWindow | null,
    meanPrice: 8,
    maxPrice: 20,
    consumptionKwh: 40,
    setConsumptionKwh: noopNum,
    durationHours: 8,
    setDurationHours: noopNum,
    readyBy: "07:00" as string | null,
    setReadyBy: noopReadyBy,
    activePreset: "EV Charge",
    setActivePreset: noopStr,
    allowPredicted: true,
    setAllowPredicted: vi.fn(),
    // 2024-06-04 20:00 Tallinn
    nowMs: new Date("2024-06-04T17:00:00.000Z").getTime(),
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

  it("selecting the Plug-in Hybrid preset sets 14 kWh, 8 h and 07:00", () => {
    const setActivePreset = vi.fn(), setConsumptionKwh = vi.fn(), setDurationHours = vi.fn(), setReadyBy = vi.fn();
    render(<CostCalculator {...openProps} setActivePreset={setActivePreset} setConsumptionKwh={setConsumptionKwh}
      setDurationHours={setDurationHours} setReadyBy={setReadyBy} />);
    const pill = screen.getByText("Plug-in Hybrid").closest("button")!;
    expect(within(pill).getByText("14 kWh · 8 h")).toBeInTheDocument();
    fireEvent.click(pill);
    expect(setActivePreset).toHaveBeenCalledWith("Plug-in Hybrid");
    expect(setConsumptionKwh).toHaveBeenCalledWith(14);
    expect(setDurationHours).toHaveBeenCalledWith(8);
    expect(setReadyBy).toHaveBeenCalledWith("07:00");
  });

  it("shows collapsed summary with current cost", () => {
    render(<CostCalculator {...defaultProps} />);
    // 40 kWh · 8 h at 10 ¢/kWh = €4.00
    expect(screen.getByText(/40 kWh · 8 h/)).toBeInTheDocument();
    expect(screen.getByText(/≈ €4\.00 now/)).toBeInTheDocument();
  });

  it("renders a compact collapsed summary visible on mobile (not hidden below sm)", () => {
    render(<CostCalculator {...defaultProps} />);
    const compact = screen.getByText(/^€4\.00 now/);
    expect(compact.className).toContain("sm:hidden");
    expect(compact.className).not.toMatch(/(^|\s)hidden(\s|$)/);
    expect(compact).toHaveTextContent("€1.20 best");
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

  it("shows duration and ready-by fields when open", () => {
    render(<CostCalculator {...openProps} />);
    expect(screen.getByText("Duration")).toBeInTheDocument();
    expect(screen.getByText("Ready by")).toBeInTheDocument();
    expect(screen.queryByText("Until")).not.toBeInTheDocument();
  });

  it("uses text inputs with decimal keyboard for kWh and duration", () => {
    render(<CostCalculator {...openProps} />);
    const kwh = screen.getByLabelText("Consumption in kWh");
    const duration = screen.getByLabelText("Duration in hours");
    for (const input of [kwh, duration]) {
      expect(input).toHaveAttribute("type", "text");
      expect(input).toHaveAttribute("inputmode", "decimal");
    }
    expect(duration).toHaveValue("8");
  });

  it("shows all 4 estimate cards when open with full data", () => {
    render(<CostCalculator {...openProps} />);

    expect(screen.getByText("Starting Now")).toBeInTheDocument();
    expect(screen.getByText("Best Window")).toBeInTheDocument();
    expect(screen.getByText("Next-hours average")).toBeInTheDocument();
    expect(screen.getByText("Peak")).toBeInTheDocument();
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

  it("hides Average/Peak on mobile behind a Show more toggle", () => {
    render(<CostCalculator {...openProps} />);
    const avgCard = screen.getByText("Next-hours average").parentElement!;
    const nowCard = screen.getByText("Starting Now").parentElement!;
    expect(avgCard.className).toContain("hidden sm:flex");
    expect(nowCard.className).not.toContain("hidden");

    const toggle = screen.getByRole("button", { name: /show more/i });
    expect(toggle.className).toContain("sm:hidden");
    fireEvent.click(toggle);
    expect(avgCard.className).not.toContain("hidden");
    expect(screen.getByRole("button", { name: /show less/i })).toHaveAttribute("aria-expanded", "true");
  });

  it("shows savings message when cheapest < current", () => {
    render(<CostCalculator {...openProps} />);

    // Savings = 4.00 - 1.20 = €2.80
    expect(screen.getByText(/Save €2\.80/)).toBeInTheDocument();
  });

  it("selecting a preset sets kWh, duration and readyBy", () => {
    const setConsumptionKwh = vi.fn();
    const setDurationHours = vi.fn();
    const setActivePreset = vi.fn();
    const setReadyBy = vi.fn();
    render(
      <CostCalculator
        {...openProps}
        setConsumptionKwh={setConsumptionKwh}
        setDurationHours={setDurationHours}
        setActivePreset={setActivePreset}
        setReadyBy={setReadyBy}
      />
    );

    // Click "Washing Machine" preset (2 kWh, 2 h, no deadline)
    fireEvent.click(screen.getByText("Washing Machine"));

    expect(setActivePreset).toHaveBeenCalledWith("Washing Machine");
    expect(setConsumptionKwh).toHaveBeenCalledWith(2);
    expect(setDurationHours).toHaveBeenCalledWith(2);
    expect(setReadyBy).toHaveBeenCalledWith(null);

    fireEvent.click(screen.getByText("Dishwasher"));
    expect(setReadyBy).toHaveBeenLastCalledWith("07:00");
  });

  it("handles null prices gracefully", () => {
    render(
      <CostCalculator
        {...openProps}
        currentPrice={null}
        cheapestWindow={null}
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
    expect(screen.getByText("40 kWh · 8 h")).toBeInTheDocument();
    expect(screen.getByText("15 kWh · 3 h")).toBeInTheDocument();
  });

  it("renders a native time input with 15-minute step for ready-by", () => {
    render(<CostCalculator {...openProps} readyBy="07:00" />);
    const input = screen.getByLabelText("Ready by");
    expect(input).toHaveAttribute("type", "time");
    expect(input).toHaveAttribute("step", "900");
    expect(input).toHaveValue("07:00");
  });

  it("commits a valid ready-by time and ignores partial input", () => {
    const setReadyBy = vi.fn();
    render(<CostCalculator {...openProps} setReadyBy={setReadyBy} />);
    const input = screen.getByLabelText("Ready by");
    fireEvent.change(input, { target: { value: "06:30" } });
    expect(setReadyBy).toHaveBeenCalledWith("06:30");
    setReadyBy.mockClear();
    fireEvent.change(input, { target: { value: "" } });
    expect(setReadyBy).not.toHaveBeenCalled();
  });

  it("clear button removes the ready-by limit", () => {
    const setReadyBy = vi.fn();
    render(<CostCalculator {...openProps} setReadyBy={setReadyBy} />);
    fireEvent.click(screen.getByRole("button", { name: /clear ready-by time/i }));
    expect(setReadyBy).toHaveBeenCalledWith(null);
  });

  it("shows 'No limit' when ready-by is null", () => {
    render(<CostCalculator {...openProps} readyBy={null} />);
    expect(screen.getByText("No limit")).toBeInTheDocument();
    expect(screen.getByLabelText("Ready by")).toHaveValue("");
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

  it("shows Tallinn time range with day context in best window card", () => {
    render(<CostCalculator {...openProps} />);
    // now = 20:00 Tallinn on Jun 4; window 01:00–09:00 Tallinn on Jun 5 → "Tonight"
    expect(screen.getByText("Tonight 01:00–09:00")).toBeInTheDocument();
  });

  it("shows Predicted badge when the best window uses predictions", () => {
    render(<CostCalculator {...openProps} isPredicted />);
    expect(screen.getByText("Predicted")).toBeInTheDocument();
  });

  it("explains when no window fits even with a ready-by time set", () => {
    render(<CostCalculator {...openProps} cheapestWindow={null} readyBy="07:00" />);
    expect(screen.getByText("No 8 h window fits in the available prices.")).toBeInTheDocument();
  });

  it("shows the resolved ready-by deadline, with a day label when rolled over", () => {
    const { rerender } = render(
      <CostCalculator
        {...openProps}
        readyByLimitMs={new Date("2024-06-05T04:00:00.000Z").getTime()}
      />
    );
    // 20:00 → 07:00 next morning is within 24 h → bare time
    expect(screen.getByText("Ready by 07:00")).toBeInTheDocument();
    // 06:30 → rolled to tomorrow 07:00 (24.5 h away)
    rerender(
      <CostCalculator
        {...openProps}
        nowMs={new Date("2024-06-04T03:30:00.000Z").getTime()}
        readyByLimitMs={new Date("2024-06-05T04:00:00.000Z").getTime()}
      />
    );
    expect(screen.getByText("Ready by tomorrow 07:00")).toBeInTheDocument();
  });

  it("no-window message names neither the deadline nor a finish time when no full window exists", () => {
    render(
      <CostCalculator
        {...openProps}
        cheapestWindow={null}
        nowMs={new Date("2024-06-04T20:30:00.000Z").getTime()} // 23:30 Tallinn
        readyByLimitMs={new Date("2024-06-05T04:00:00.000Z").getTime()} // 07:00
        startingNowEndMs={new Date("2024-06-05T04:30:00.000Z").getTime()} // 07:30
      />
    );
    // A null window means no full-length window exists at all (the 23:30 case falls back past the deadline)
    expect(screen.getByText("No 8 h window fits in the available prices.")).toBeInTheDocument();
    expect(screen.queryByText(/starting now finishes 07:30\./)).not.toBeInTheDocument();
  });

  it("flags a fallback best window that finishes after ready-by (amber warning + card caveat)", () => {
    render(
      <CostCalculator
        {...openProps}
        bestIgnoresDeadline
        nowMs={new Date("2024-06-04T21:16:00.000Z").getTime()} // 00:16 Tallinn
        readyByLimitMs={new Date("2024-06-05T04:00:00.000Z").getTime()} // 07:00
        startingNowEndMs={new Date("2024-06-05T05:15:00.000Z").getTime()} // 08:15
      />
    );
    const warning = screen.getByRole("status");
    expect(warning).toHaveTextContent("Finishes after 07:00 — no 8 h window fits before your ready-by time");
    expect(warning).toHaveTextContent("Starting now finishes 08:15");
    expect(screen.getByText("Finishes after 07:00")).toBeInTheDocument(); // Best Window card caveat
    expect(screen.getByText(/Save €2\.80/)).toBeInTheDocument();
  });

  it("collapsed header shows an amber 'after 07:00' hint in fallback mode (mobile + desktop)", () => {
    render(
      <CostCalculator
        {...defaultProps}
        bestIgnoresDeadline
        nowMs={new Date("2024-06-04T21:16:00.000Z").getTime()}
        readyByLimitMs={new Date("2024-06-05T04:00:00.000Z").getTime()}
      />
    );
    const hints = screen.getAllByText("· after 07:00");
    expect(hints).toHaveLength(2);
    for (const h of hints) expect(h.className).toContain("text-amber-400");
    expect(hints[0].closest(".sm\\:hidden")).not.toBeNull();
    expect(hints[1].closest(".sm\\:inline")).not.toBeNull();
  });

  it("collapsed header has no 'after' hint when the window fits", () => {
    render(<CostCalculator {...defaultProps} />);
    expect(screen.queryByText(/after 07:00/)).not.toBeInTheDocument();
  });

  it("shows no deadline warning when the best window fits", () => {
    render(<CostCalculator {...openProps} bestIgnoresDeadline={false} />);
    expect(screen.queryByText(/Finishes after/)).not.toBeInTheDocument();
  });

  it("uses the searched (snapped) duration in the no-window message", () => {
    render(<CostCalculator {...openProps} cheapestWindow={null} durationHours={2.3} />);
    expect(screen.getByText("No 2.25 h window fits in the available prices.")).toBeInTheDocument();
  });

  it("shows a load error instead of 'no price data' when the fetch failed", () => {
    render(
      <CostCalculator
        {...openProps}
        currentPrice={null}
        cheapestWindow={null}
        meanPrice={null}
        maxPrice={null}
        error="boom"
      />
    );
    expect(screen.getByText(/Couldn't load prices/)).toBeInTheDocument();
    expect(screen.queryByText("No price data available for estimation.")).not.toBeInTheDocument();
  });

  it("warns that data is stale when a refresh failed but estimates exist", () => {
    render(<CostCalculator {...openProps} error="boom" />);
    // Amber status, same severity as the best-window card's stale notice
    expect(screen.getByRole("status")).toHaveTextContent(/Couldn't refresh prices/);
    expect(screen.getByText("Starting Now")).toBeInTheDocument();
  });

  it("hides savings below half a cent (shared threshold)", () => {
    const tiny: CheapestWindow = { ...mockCheapestWindow, averagePrice: 9.99 };
    render(<CostCalculator {...openProps} cheapestWindow={tiny} />);
    // (10 - 9.99) ¢ × 40 kWh = €0.004
    expect(screen.queryByText(/Save €/)).not.toBeInTheDocument();
  });

  it("collapsed summary formats kWh and shows the searched duration", () => {
    render(<CostCalculator {...defaultProps} consumptionKwh={12.345} />);
    expect(screen.getByText(/12.35 kWh · 8 h/)).toBeInTheDocument();
  });

  it("typing a valid kWh commits live and switches to Custom", () => {
    const setConsumptionKwh = vi.fn();
    const setActivePreset = vi.fn();
    render(
      <CostCalculator
        {...openProps}
        setConsumptionKwh={setConsumptionKwh}
        setActivePreset={setActivePreset}
      />
    );
    const input = screen.getByLabelText("Consumption in kWh");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "12,5" } });
    expect(setConsumptionKwh).toHaveBeenCalledWith(12.5);
    expect(setActivePreset).toHaveBeenCalledWith("Custom");
  });

  // ─── Predicted prices option ───────────────────────────────────────────────
  // Official prices end 01:00 Tallinn on 2024-06-05
  const predictedFromMs = new Date("2024-06-04T22:00:00.000Z").getTime();

  it("the prices toggle flips the predicted-price option without changing the preset", () => {
    const setAllowPredicted = vi.fn(), setActivePreset = vi.fn();
    render(<CostCalculator {...openProps} setAllowPredicted={setAllowPredicted} setActivePreset={setActivePreset} />);
    const toggle = screen.getByRole("button", { name: "Use predicted prices" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(toggle);
    expect(setAllowPredicted).toHaveBeenCalledWith(false);
    expect(setActivePreset).not.toHaveBeenCalled();
  });

  it("names where official prices end when predictions are excluded", () => {
    render(
      <CostCalculator
        {...openProps}
        allowPredicted={false}
        predictedFromMs={predictedFromMs}
        readyByLimitMs={new Date("2024-06-05T04:00:00.000Z").getTime()} // 07:00 Tallinn
      />
    );
    expect(screen.getByText("Official prices end 01:00 — the search stops there")).toBeInTheDocument();
  });

  it("no-window line blames predicted prices when they are excluded", () => {
    render(
      <CostCalculator
        {...openProps}
        allowPredicted={false}
        predictedFromMs={predictedFromMs}
        readyByLimitMs={new Date("2024-06-05T04:00:00.000Z").getTime()} // 07:00 Tallinn
        cheapestWindow={null}
      />
    );
    expect(screen.getByText("No 8 h window fits before predicted prices start (01:00).")).toBeInTheDocument();
  });

  it("notes that the stats still include predicted prices", () => {
    const { rerender } = render(
      <CostCalculator {...openProps} allowPredicted={false} predictedFromMs={predictedFromMs} />
    );
    expect(
      screen.getByText("Starting now, average and peak include predicted prices from 01:00.")
    ).toBeInTheDocument();
    rerender(<CostCalculator {...openProps} allowPredicted predictedFromMs={predictedFromMs} />);
    expect(screen.queryByText(/include predicted prices from/)).not.toBeInTheDocument();
  });

  it("hides the official-end hint when ready-by comes first", () => {
    render(
      <CostCalculator
        {...openProps}
        allowPredicted={false}
        predictedFromMs={predictedFromMs}
        readyByLimitMs={new Date("2024-06-04T21:00:00.000Z").getTime()} // 00:00 Tallinn, before 01:00
      />
    );
    expect(screen.queryByText(/Official prices end/)).not.toBeInTheDocument();
  });

  it("dims the estimates while a field draft is empty", () => {
    const { container } = render(<CostCalculator {...openProps} />);
    const input = screen.getByLabelText("Duration in hours");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "" } });
    expect(container.querySelector(".opacity-50")).not.toBeNull();
    fireEvent.blur(input);
    expect(container.querySelector(".opacity-50")).toBeNull();
  });
});

describe("CostCalculator loading and state sync", () => {
  const base = {
    isOpen: true,
    setIsOpen: vi.fn(),
    currentPrice: null as number | null,
    cheapestWindow: null as CheapestWindow | null,
    meanPrice: null as number | null,
    maxPrice: null as number | null,
    consumptionKwh: 40,
    setConsumptionKwh: vi.fn(),
    durationHours: 8,
    setDurationHours: vi.fn(),
    readyBy: "07:00" as string | null,
    setReadyBy: vi.fn(),
    activePreset: "EV Charge",
    setActivePreset: vi.fn(),
    allowPredicted: true,
    setAllowPredicted: vi.fn(),
    nowMs: new Date("2024-06-04T17:00:00.000Z").getTime(),
  };

  it("shows a loading state, not 'no price data', while the first load is pending", () => {
    render(<CostCalculator {...base} loading />);
    expect(screen.getByText(/Loading prices/)).toBeInTheDocument();
    expect(screen.queryByText(/No price data available/)).not.toBeInTheDocument();
  });

  it("switches the preset to Custom when the ready-by time is edited", () => {
    const setActivePreset = vi.fn();
    const setReadyBy = vi.fn();
    const { container } = render(
      <CostCalculator {...base} setActivePreset={setActivePreset} setReadyBy={setReadyBy} />
    );
    const time = container.querySelector('input[type="time"]')!;
    fireEvent.change(time, { target: { value: "06:30" } });
    expect(setReadyBy).toHaveBeenCalledWith("06:30");
    expect(setActivePreset).toHaveBeenCalledWith("Custom");
  });

  it("does not blame the ready-by time when no full-length window exists at all", () => {
    render(<CostCalculator {...base} currentPrice={10} meanPrice={8} maxPrice={20} />);
    expect(screen.getByText("No 8 h window fits in the available prices.")).toBeInTheDocument();
  });

  it("does not say 'no window fits' while prices reload over stale partial data", () => {
    render(<CostCalculator {...base} currentPrice={10} meanPrice={8} maxPrice={20} loading />);
    expect(screen.queryByText(/window fits/)).not.toBeInTheDocument();
  });

  it("switches the preset to Custom when the ready-by time is cleared", () => {
    const setActivePreset = vi.fn();
    const setReadyBy = vi.fn();
    render(<CostCalculator {...base} setActivePreset={setActivePreset} setReadyBy={setReadyBy} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear ready-by time" }));
    expect(setReadyBy).toHaveBeenCalledWith(null);
    expect(setActivePreset).toHaveBeenCalledWith("Custom");
  });

  it("keeps the load error (not 'Loading prices…') while a retry is in flight", () => {
    render(<CostCalculator {...base} error="boom" loading />);
    expect(screen.getByText(/Couldn't load prices/)).toBeInTheDocument();
    expect(screen.queryByText(/Loading prices/)).not.toBeInTheDocument();
  });

  it("switches the preset to Custom when the duration is edited", () => {
    const setActivePreset = vi.fn();
    render(<CostCalculator {...base} setActivePreset={setActivePreset} />);
    const input = screen.getByRole("textbox", { name: "Duration in hours" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "3" } });
    expect(setActivePreset).toHaveBeenCalledWith("Custom");
  });
});
