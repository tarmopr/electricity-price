"use client";

import { ChevronDown, ChevronUp, Calculator, Zap } from "lucide-react";
import {
  PRESETS,
  buildEstimates,
  CostEstimate,
} from "@/lib/costCalculator";
import { CheapestWindow } from "@/lib/cheapestWindow";
import { format } from "date-fns";

interface CostCalculatorProps {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  currentPrice: number | null;
  cheapestWindow: CheapestWindow | null;
  meanPrice: number | null;
  maxPrice: number | null;
  consumptionKwh: number;
  setConsumptionKwh: (val: number) => void;
  durationHours: number;
  setDurationHours: (val: number) => void;
  untilHour: number | null;
  setUntilHour: (val: number | null) => void;
  activePreset: string;
  setActivePreset: (val: string) => void;
}

/** Format cheapest window time range as "HH:mm–HH:mm" */
function formatWindowRange(w: CheapestWindow): string {
  const start = format(new Date(w.startTimestamp), "HH:mm");
  const end = format(new Date(w.endTimestamp), "HH:mm");
  return `${start}–${end}`;
}

export default function CostCalculator({
  isOpen,
  setIsOpen,
  currentPrice,
  cheapestWindow,
  meanPrice,
  maxPrice,
  consumptionKwh,
  setConsumptionKwh,
  durationHours,
  setDurationHours,
  untilHour,
  setUntilHour,
  activePreset,
  setActivePreset,
}: CostCalculatorProps) {
  const cheapestWindowPrice = cheapestWindow?.averagePrice ?? null;
  const windowRange = cheapestWindow ? formatWindowRange(cheapestWindow) : null;

  const estimates = buildEstimates(
    consumptionKwh,
    currentPrice,
    cheapestWindowPrice,
    meanPrice,
    maxPrice
  );

  // Find cheapest and most expensive for highlighting
  const cheapest =
    estimates.length > 0
      ? estimates.reduce((min, e) => (e.costEur < min.costEur ? e : min))
      : null;
  const expensive =
    estimates.length > 0
      ? estimates.reduce((max, e) => (e.costEur > max.costEur ? e : max))
      : null;

  // Calculate savings between current and cheapest
  const currentEstimate = estimates.find((e) => e.label === "Current Price");
  const cheapestEstimate = estimates.find((e) => e.label === "Cheapest Window");
  const savings =
    currentEstimate && cheapestEstimate
      ? currentEstimate.costEur - cheapestEstimate.costEur
      : null;

  function selectPreset(label: string, kWh: number, duration: number) {
    setActivePreset(label);
    setConsumptionKwh(kWh);
    setDurationHours(duration);
  }

  function handleCustomKwhInput(value: string) {
    const num = parseFloat(value);
    setActivePreset("Custom");
    setConsumptionKwh(isNaN(num) || num < 0 ? 0 : num);
  }

  function handleDurationInput(value: string) {
    const num = parseInt(value, 10);
    setActivePreset("Custom");
    setDurationHours(isNaN(num) || num < 1 ? 1 : Math.min(num, 24));
  }

  function handleUntilInput(value: string) {
    if (value === "" || value === undefined) {
      setUntilHour(null);
      return;
    }
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      setUntilHour(null);
    } else {
      setUntilHour(Math.max(0, Math.min(23, num)));
    }
  }

  return (
    <div className="bg-zinc-900/40 rounded-2xl border border-zinc-800/50 hover:border-zinc-700/80 backdrop-blur-2xl transition-all duration-500 hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] overflow-hidden">
      {/* Header / Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 md:p-5 text-zinc-300 hover:text-zinc-100 transition-colors"
      >
        <div className="flex items-center space-x-2.5">
          <Calculator className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold tracking-wide uppercase">
            Cost Calculator
          </span>
          {!isOpen && consumptionKwh > 0 && currentEstimate && (
            <span className="text-xs text-zinc-500 ml-2 hidden sm:inline">
              {consumptionKwh} kWh · {durationHours}h ≈ €{currentEstimate.costEur.toFixed(2)} now
              {windowRange && (
                <span className="text-emerald-400/70"> · cheapest {windowRange}</span>
              )}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-zinc-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-zinc-500" />
        )}
      </button>

      {/* Expandable Content */}
      {isOpen && (
        <div className="px-4 md:px-5 pb-5 space-y-5 border-t border-zinc-800/50 pt-4">
          {/* Preset Buttons */}
          <div className="space-y-2">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
              Appliance
            </p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => selectPreset(p.label, p.kWh, p.durationHours)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-all border ${
                    activePreset === p.label
                      ? "bg-emerald-400/20 text-emerald-300 border-emerald-400/50"
                      : "bg-zinc-800/50 text-zinc-400 border-zinc-700 hover:bg-zinc-800"
                  }`}
                >
                  {p.label}
                  <span className="ml-1.5 text-zinc-500 text-xs">
                    {p.kWh} kWh · {p.durationHours}h
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Consumption, Duration & Until inputs */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs text-zinc-500 uppercase tracking-wider font-semibold whitespace-nowrap">
              Consumption
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="0.5"
                value={consumptionKwh}
                onChange={(e) => handleCustomKwhInput(e.target.value)}
                className="w-24 bg-zinc-800/50 border border-zinc-700/80 text-zinc-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 text-center"
              />
              <span className="text-zinc-500 text-sm">kWh</span>
            </div>
            <label className="text-xs text-zinc-500 uppercase tracking-wider font-semibold whitespace-nowrap ml-2">
              Duration
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="24"
                step="1"
                value={durationHours}
                onChange={(e) => handleDurationInput(e.target.value)}
                className="w-20 bg-zinc-800/50 border border-zinc-700/80 text-zinc-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 text-center"
              />
              <span className="text-zinc-500 text-sm">h</span>
            </div>
            <label className="text-xs text-zinc-500 uppercase tracking-wider font-semibold whitespace-nowrap ml-2">
              Until
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="23"
                step="1"
                value={untilHour ?? ""}
                onChange={(e) => handleUntilInput(e.target.value)}
                placeholder="—"
                className="w-20 bg-zinc-800/50 border border-zinc-700/80 text-zinc-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 text-center"
              />
              <span className="text-zinc-500 text-sm">
                {untilHour !== null
                  ? `${untilHour.toString().padStart(2, "0")}:00`
                  : "No limit"}
              </span>
            </div>
          </div>

          {/* Estimates Grid */}
          {estimates.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {estimates.map((est) => (
                <EstimateCard
                  key={est.label}
                  estimate={est}
                  isCheapest={cheapest?.label === est.label}
                  isMostExpensive={expensive?.label === est.label}
                  timeRange={est.label === "Cheapest Window" ? windowRange : null}
                />
              ))}
            </div>
          ) : (
            <p className="text-zinc-500 text-sm text-center py-4">
              No price data available for estimation.
            </p>
          )}

          {/* Savings Highlight */}
          {savings !== null && savings > 0 && (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5">
              <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
              <p className="text-emerald-300 text-sm font-medium">
                Save €{savings.toFixed(2)} by using the cheapest window instead
                of the current price
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EstimateCard({
  estimate,
  isCheapest,
  isMostExpensive,
  timeRange,
}: {
  estimate: CostEstimate;
  isCheapest: boolean;
  isMostExpensive: boolean;
  timeRange: string | null;
}) {
  let borderClass = "border-zinc-800/50";
  let badgeClass = "";
  let costColor = "text-white";

  if (isCheapest) {
    borderClass = "border-emerald-500/30";
    badgeClass = "bg-emerald-500/10";
    costColor = "text-emerald-400";
  } else if (isMostExpensive) {
    borderClass = "border-red-500/20";
    badgeClass = "bg-red-500/5";
    costColor = "text-red-400";
  }

  return (
    <div
      className={`rounded-xl border ${borderClass} ${badgeClass} p-3 flex flex-col gap-1 transition-all`}
    >
      <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">
        {estimate.label}
      </p>
      <p className={`text-xl font-bold ${costColor}`}>
        €{estimate.costEur.toFixed(2)}
      </p>
      <p className="text-xs text-zinc-600">
        {estimate.priceCentsKwh.toFixed(2)} ¢/kWh
      </p>
      {timeRange && (
        <p className="text-xs text-emerald-400/70 font-medium">
          {timeRange}
        </p>
      )}
    </div>
  );
}
