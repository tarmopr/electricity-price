/**
 * Cost calculator utilities.
 *
 * Takes a consumption in kWh and various price points (¢/kWh),
 * and returns estimated costs in euros.
 */

export interface ConsumptionPreset {
  label: string;
  kWh: number;
  durationHours: number;
  /** Default "ready by" deadline ("HH:MM" Tallinn time), or null for no limit */
  readyBy: string | null;
}

// Overnight appliances default to being done by 07:00 (before the morning commute/peak)
export const PRESETS: ConsumptionPreset[] = [
  { label: "EV Charge", kWh: 40, durationHours: 8, readyBy: "07:00" },
  { label: "Washing Machine", kWh: 2, durationHours: 2, readyBy: null },
  { label: "Dryer", kWh: 3.5, durationHours: 2, readyBy: null },
  { label: "Dishwasher", kWh: 1.8, durationHours: 2, readyBy: "07:00" },
  { label: "Sauna", kWh: 15, durationHours: 3, readyBy: null },
];

/** Default calculator state = EV Charge preset. */
export const DEFAULT_PRESET = PRESETS[0];

/**
 * Minimum savings (€) worth showing — below half a cent the "save" message
 * would just display €0.00. Shared by the best-window card and the calculator.
 */
export const MIN_SAVINGS_EUR = 0.005;

/** Estimate labels (shared between estimate builder and UI). */
export const ESTIMATE_LABELS = {
  now: "Starting Now",
  best: "Best Window",
  average: "Next-hours average",
  peak: "Peak",
} as const;

export interface CostEstimate {
  /** Label for the scenario */
  label: string;
  /** Cost in euros */
  costEur: number;
  /** Price used (¢/kWh) */
  priceCentsKwh: number;
}

/**
 * Convert ¢/kWh * kWh to euros.
 * (¢/kWh × kWh) / 100 = €
 */
export function calcCostEur(
  priceCentsKwh: number,
  consumptionKwh: number
): number {
  return (priceCentsKwh * consumptionKwh) / 100;
}

/**
 * Build a list of cost estimates for different scenarios.
 */
export function buildEstimates(
  consumptionKwh: number,
  currentPrice: number | null,
  cheapestPrice: number | null,
  meanPrice: number | null,
  maxPrice: number | null
): CostEstimate[] {
  const estimates: CostEstimate[] = [];

  if (currentPrice !== null) {
    estimates.push({
      label: ESTIMATE_LABELS.now,
      priceCentsKwh: currentPrice,
      costEur: calcCostEur(currentPrice, consumptionKwh),
    });
  }

  if (cheapestPrice !== null) {
    estimates.push({
      label: ESTIMATE_LABELS.best,
      priceCentsKwh: cheapestPrice,
      costEur: calcCostEur(cheapestPrice, consumptionKwh),
    });
  }

  if (meanPrice !== null) {
    estimates.push({
      label: ESTIMATE_LABELS.average,
      priceCentsKwh: meanPrice,
      costEur: calcCostEur(meanPrice, consumptionKwh),
    });
  }

  if (maxPrice !== null) {
    estimates.push({
      label: ESTIMATE_LABELS.peak,
      priceCentsKwh: maxPrice,
      costEur: calcCostEur(maxPrice, consumptionKwh),
    });
  }

  return estimates;
}
