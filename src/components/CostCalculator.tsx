"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Calculator, Zap, X, AlertTriangle } from "lucide-react";
import {
  PRESETS,
  DURATION_LIMITS,
  KWH_LIMITS,
  buildEstimates,
  CostEstimate,
  ESTIMATE_LABELS,
  MIN_SAVINGS_EUR,
} from "@/lib/costCalculator";
import { CheapestWindow } from "@/lib/cheapestWindow";
import { formatDuration, formatNumber, snapDurationHours } from "@/lib/numericInput";
import { formatTallinnDeadline, formatTallinnRange, isValidHHMM } from "@/lib/timezone";
import { PILL_BASE, PILL_INACTIVE, PILL_ACTIVE_INDIGO, pillClass } from "@/lib/styles";
import NumericField from "@/components/ui/NumericField";

interface CostCalculatorProps {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  /** Average price (¢/kWh) of a same-length window starting now */
  currentPrice: number | null;
  cheapestWindow: CheapestWindow | null;
  /** Mean price across the rolling horizon */
  meanPrice: number | null;
  /** Max price across the rolling horizon */
  maxPrice: number | null;
  consumptionKwh: number;
  setConsumptionKwh: (val: number) => void;
  durationHours: number;
  setDurationHours: (val: number) => void;
  readyBy: string | null;
  setReadyBy: (val: string | null) => void;
  activePreset: string;
  setActivePreset: (val: string) => void;
  allowPredicted: boolean;
  setAllowPredicted: (val: boolean) => void;
  /** Where official prices end (start of the trailing predicted slots), or null */
  predictedFromMs?: number | null;
  /** True if any slot of the best window is a prediction */
  isPredicted?: boolean;
  /** Reference "now" for day labels (Today / Tomorrow) */
  nowMs?: number | null;
  /** Resolved ready-by deadline (may be the following day's occurrence) */
  readyByLimitMs?: number | null;
  /** Price fetch error, if the latest load failed */
  error?: string | null;
  /** True while prices are being (re)loaded */
  loading?: boolean;
  /** When a same-length window starting now would finish (for the "starting now finishes …" line in the finishes-after-deadline warning) */
  startingNowEndMs?: number | null;
  /** True when `cheapestWindow` finishes after the ready-by time because nothing fits before it */
  bestIgnoresDeadline?: boolean;
}

const LABEL_CLASS =
  "text-xs text-zinc-500 uppercase tracking-wider font-semibold whitespace-nowrap";

const TIME_INPUT =
  "bg-zinc-800/50 border border-zinc-700/80 text-zinc-200 text-base sm:text-sm rounded-lg px-3 h-11 sm:h-8 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 [color-scheme:dark]";

const SECONDARY_BUTTON =
  "flex items-center gap-1 px-3 h-11 sm:h-8 rounded-lg border text-sm transition-all";

/** Format cheapest window time range with Tallinn day context */
function formatWindowRange(w: CheapestWindow, nowMs: number | null | undefined): string {
  const start = new Date(w.startTimestamp);
  return formatTallinnRange(start, new Date(w.endTimestamp), new Date(nowMs ?? start.getTime()));
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
  readyBy,
  setReadyBy,
  activePreset,
  setActivePreset,
  allowPredicted,
  setAllowPredicted,
  predictedFromMs = null,
  isPredicted = false,
  nowMs,
  readyByLimitMs = null,
  error = null,
  loading = false,
  startingNowEndMs = null,
  bestIgnoresDeadline = false,
}: CostCalculatorProps) {
  const [invalidFields, setInvalidFields] = useState<Record<string, boolean>>({});
  const [showMore, setShowMore] = useState(false);
  const hasInvalidDraft = Object.values(invalidFields).some(Boolean);

  const cheapestWindowPrice = cheapestWindow?.averagePrice ?? null;
  const windowRange = cheapestWindow ? formatWindowRange(cheapestWindow, nowMs) : null;
  // Show what was actually searched (15-minute slots), not the raw typed value
  const searchedHours = cheapestWindow?.hours ?? snapDurationHours(durationHours);
  const deadlineLabel =
    readyBy && readyByLimitMs !== null && nowMs != null
      ? formatTallinnDeadline(new Date(readyByLimitMs), new Date(nowMs))
      : readyBy;
  const finishLabel =
    deadlineLabel && startingNowEndMs !== null && nowMs != null
      ? formatTallinnDeadline(new Date(startingNowEndMs), new Date(nowMs))
      : null;
  const showDeadlineWarning = bestIgnoresDeadline && cheapestWindow !== null && !!deadlineLabel;
  const officialEndLabel =
    predictedFromMs !== null && nowMs != null
      ? formatTallinnDeadline(new Date(predictedFromMs), new Date(nowMs))
      : null;
  // Predictions excluded and the horizon has them: the search stops where official prices end
  const excludesKnownPredictions = !allowPredicted && predictedFromMs !== null && nowMs != null;
  // Only worth naming when official prices end before the ready-by deadline
  const officialEndHint =
    excludesKnownPredictions && (readyByLimitMs === null || predictedFromMs < readyByLimitMs);

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
  const currentEstimate = estimates.find((e) => e.label === ESTIMATE_LABELS.now);
  const cheapestEstimate = estimates.find((e) => e.label === ESTIMATE_LABELS.best);
  const savings =
    currentEstimate && cheapestEstimate
      ? currentEstimate.costEur - cheapestEstimate.costEur
      : null;

  const hasSecondary = estimates.some(
    (e) => e.label === ESTIMATE_LABELS.average || e.label === ESTIMATE_LABELS.peak
  );

  function markValidity(field: string) {
    return (valid: boolean) =>
      setInvalidFields((prev) => (prev[field] === !valid ? prev : { ...prev, [field]: !valid }));
  }

  function selectPreset(preset: (typeof PRESETS)[number]) {
    setActivePreset(preset.label);
    setConsumptionKwh(preset.kWh);
    setDurationHours(preset.durationHours);
    setReadyBy(preset.readyBy);
  }

  function handleKwhCommit(value: number) {
    setActivePreset("Custom");
    setConsumptionKwh(value);
  }

  function handleDurationCommit(value: number) {
    setActivePreset("Custom");
    setDurationHours(value);
  }

  function handleReadyByInput(value: string) {
    // Native time inputs report "" while partially filled — keep the last valid value
    if (!isValidHHMM(value)) return;
    // Same as kWh/duration edits: the values no longer match the named preset
    setActivePreset("Custom");
    setReadyBy(value);
  }

  function handleClearReadyBy() {
    setActivePreset("Custom");
    setReadyBy(null);
  }

  return (
    <div
      id="cost-calculator"
      className="scroll-mt-4 bg-zinc-900/40 rounded-2xl border border-zinc-800/50 hover:border-zinc-700/80 backdrop-blur-2xl transition-all duration-500 hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] overflow-hidden"
    >
      {/* Header / Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label="Toggle cost calculator"
        className="w-full flex items-center justify-between gap-2 p-4 md:p-5 text-zinc-300 hover:text-zinc-100 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Calculator className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-sm font-semibold tracking-wide uppercase whitespace-nowrap">
            Cost Calculator
          </span>
          {!isOpen && consumptionKwh > 0 && currentEstimate && (
            <>
              {/* Compact summary on mobile */}
              <span className="text-xs text-zinc-500 truncate sm:hidden">
                €{currentEstimate.costEur.toFixed(2)} now
                {cheapestEstimate && (
                  <span className="text-emerald-400/80"> · €{cheapestEstimate.costEur.toFixed(2)} best</span>
                )}
                {showDeadlineWarning && (
                  <span className="text-amber-400"> · after {deadlineLabel}</span>
                )}
              </span>
              <span className="text-xs text-zinc-500 ml-2 hidden sm:inline truncate">
                {formatNumber(consumptionKwh)} kWh · {formatDuration(searchedHours)} ≈ €{currentEstimate.costEur.toFixed(2)} now
                {windowRange && (
                  <span className="text-emerald-400/70"> · best {windowRange}</span>
                )}
                {showDeadlineWarning && (
                  <span className="text-amber-400"> · after {deadlineLabel}</span>
                )}
              </span>
            </>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-zinc-500 shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-zinc-500 shrink-0" />
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
                  onClick={() => selectPreset(p)}
                  aria-pressed={activePreset === p.label}
                  className={`${PILL_BASE} ${pillClass(activePreset === p.label)}`}
                >
                  {p.label}
                  <span className="ml-1.5 text-zinc-500 text-xs">
                    {p.kWh} kWh · {formatDuration(p.durationHours)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Consumption, Duration & Ready-by inputs */}
          <div className="grid grid-cols-1 sm:flex sm:flex-wrap sm:items-start gap-4 sm:gap-6">
            <div className="flex flex-col gap-1.5">
              <span className={LABEL_CLASS}>Consumption</span>
              <NumericField
                value={consumptionKwh}
                onCommit={handleKwhCommit}
                min={KWH_LIMITS.min}
                max={KWH_LIMITS.max}
                step={0.5}
                label="Consumption in kWh"
                unit="kWh"
                onValidityChange={markValidity("kwh")}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className={LABEL_CLASS}>Duration</span>
              <NumericField
                value={durationHours}
                onCommit={handleDurationCommit}
                min={DURATION_LIMITS.min}
                max={DURATION_LIMITS.max}
                step={0.25}
                snapStep={0.25}
                label="Duration in hours"
                unit="h"
                onValidityChange={markValidity("duration")}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cost-ready-by" className={LABEL_CLASS}>
                Ready by
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="cost-ready-by"
                  type="time"
                  step={900}
                  value={readyBy ?? ""}
                  onChange={(e) => handleReadyByInput(e.target.value)}
                  className={`${TIME_INPUT} w-32`}
                />
                {readyBy !== null ? (
                  <button
                    type="button"
                    onClick={handleClearReadyBy}
                    aria-label="Clear ready-by time"
                    className={`${SECONDARY_BUTTON} border-zinc-700/80 bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/60`}
                  >
                    <X className="w-3.5 h-3.5" />
                    Clear
                  </button>
                ) : (
                  <span className="text-zinc-500 text-sm">No limit</span>
                )}
              </div>
              {readyBy !== null && readyByLimitMs !== null && deadlineLabel && (
                <p className="text-xs text-zinc-500">Ready by {deadlineLabel}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <span className={LABEL_CLASS}>Prices</span>
              <button type="button" onClick={() => setAllowPredicted(!allowPredicted)} aria-pressed={allowPredicted}
                className={`${PILL_BASE} self-start ${allowPredicted ? PILL_ACTIVE_INDIGO : PILL_INACTIVE}`}>
                Use predicted prices
              </button>
              {officialEndHint && <p className="text-xs text-zinc-500">Official prices end {officialEndLabel} — the search stops there</p>}
            </div>
          </div>

          {isPredicted && cheapestWindow && (
            <p className="text-xs text-indigo-300/90 flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-300 bg-indigo-500/15 border border-indigo-400/30 rounded-full px-2 py-0.5">
                Predicted
              </span>
              Best window uses predicted prices — official prices are published around 14:00 CET.
            </p>
          )}

          {showDeadlineWarning && (
            <div role="status" className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <div>
                <p className="font-medium">
                  Finishes after {deadlineLabel} — no {formatDuration(searchedHours)} window fits before your ready-by time
                </p>
                {finishLabel && <p className="text-xs text-amber-200/70">Starting now finishes {finishLabel}</p>}
              </div>
            </div>
          )}

          {/* Estimates Grid */}
          {estimates.length > 0 ? (
            <div className={`space-y-2 transition-opacity duration-200 ${hasInvalidDraft ? "opacity-50" : ""}`}>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {estimates.map((est) => {
                  const secondary =
                    est.label === ESTIMATE_LABELS.average || est.label === ESTIMATE_LABELS.peak;
                  return (
                    <EstimateCard
                      key={est.label}
                      estimate={est}
                      isCheapest={cheapest?.label === est.label}
                      isMostExpensive={expensive?.label === est.label}
                      timeRange={est.label === ESTIMATE_LABELS.best ? windowRange : null}
                      warning={est.label === ESTIMATE_LABELS.best && showDeadlineWarning ? `Finishes after ${deadlineLabel}` : null}
                      visibilityClass={secondary && !showMore ? "hidden sm:flex" : "flex"}
                    />
                  );
                })}
              </div>
              {hasSecondary && (
                <button
                  type="button"
                  onClick={() => setShowMore((v) => !v)}
                  aria-expanded={showMore}
                  className="sm:hidden flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 min-h-11 px-1"
                >
                  {showMore ? "Show less" : "Show more"}
                  {showMore ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              )}
              {/* The stats keep the whole horizon, so predicted prices are not shown as official */}
              {excludesKnownPredictions && (
                <p className="text-xs text-zinc-500">
                  Starting now, average and peak include predicted prices from {officialEndLabel}.
                </p>
              )}
            </div>
          ) : (
            <p className="text-zinc-500 text-sm text-center py-4">
              {error
                ? "Couldn't load prices — retrying automatically."
                : loading
                  ? "Loading prices…"
                  : "No price data available for estimation."}
            </p>
          )}

          {/* Null despite the deadline fallback: no full-length window exists in the loaded prices */}
          {/* Not while reloading: after a long sleep the cached prices may no longer cover "now" */}
          {cheapestWindow === null && currentPrice !== null && !loading && (
            <p className="text-zinc-500 text-sm">
              {excludesKnownPredictions
                ? `No ${formatDuration(searchedHours)} window fits before predicted prices start (${officialEndLabel}).`
                : `No ${formatDuration(searchedHours)} window fits in the available prices.`}
            </p>
          )}

          {/* Stale-data notice (same amber status as the best-window card) */}
          {error && estimates.length > 0 && (
            <p role="status" className="flex items-center gap-2 text-xs text-amber-200">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              Couldn&apos;t refresh prices — showing the last loaded data.
            </p>
          )}

          {/* Savings Highlight */}
          {savings !== null && savings > MIN_SAVINGS_EUR && (
            <div className={`flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5 transition-opacity duration-200 ${hasInvalidDraft ? "opacity-50" : ""}`}>
              <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
              <p className="text-emerald-300 text-sm font-medium">
                Save €{savings.toFixed(2)} by using the best window instead
                of starting now
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
  visibilityClass,
  warning = null,
}: {
  estimate: CostEstimate;
  isCheapest: boolean;
  isMostExpensive: boolean;
  timeRange: string | null;
  /** Static display classes, e.g. "flex" or "hidden sm:flex" */
  visibilityClass: string;
  /** Amber caveat, e.g. "Finishes after 07:00" */
  warning?: string | null;
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
      className={`rounded-xl border ${borderClass} ${badgeClass} p-3 ${visibilityClass} flex-col gap-1 transition-all`}
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
      {warning && (
        <p className="text-xs text-amber-300 font-medium flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          {warning}
        </p>
      )}
    </div>
  );
}
