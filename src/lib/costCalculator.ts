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
}

export const PRESETS: ConsumptionPreset[] = [
  { label: "EV Charge", kWh: 40, durationHours: 8 },
  { label: "Washing Machine", kWh: 2, durationHours: 2 },
  { label: "Dryer", kWh: 3.5, durationHours: 2 },
  { label: "Dishwasher", kWh: 1.8, durationHours: 2 },
  { label: "Sauna", kWh: 15, durationHours: 3 },
];

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
      label: "Starting Now",
      priceCentsKwh: currentPrice,
      costEur: calcCostEur(currentPrice, consumptionKwh),
    });
  }

  if (cheapestPrice !== null) {
    estimates.push({
      label: "Cheapest Window",
      priceCentsKwh: cheapestPrice,
      costEur: calcCostEur(cheapestPrice, consumptionKwh),
    });
  }

  if (meanPrice !== null) {
    estimates.push({
      label: "Day Average",
      priceCentsKwh: meanPrice,
      costEur: calcCostEur(meanPrice, consumptionKwh),
    });
  }

  if (maxPrice !== null) {
    estimates.push({
      label: "Peak Price",
      priceCentsKwh: maxPrice,
      costEur: calcCostEur(maxPrice, consumptionKwh),
    });
  }

  return estimates;
}
