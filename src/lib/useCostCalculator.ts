"use client";

import { useMemo } from 'react';
import { startOfTomorrow } from 'date-fns';
import { usePersistedState } from '@/lib/usePersistedState';
import { aggregatePrices } from '@/lib/api';
import { applyVat } from '@/lib/price';
import { findCheapestWindow, computeWindowAverage } from '@/lib/cheapestWindow';
import type { ElectricityPrice } from '@/lib/api';
import type { Period } from '@/lib/types';

export function useCostCalculator(
  prices: ElectricityPrice[],
  includeVat: boolean,
  period: Period
) {
  const [costConsumptionKwh, setCostConsumptionKwh] = usePersistedState<number>('costKwh', 40);
  const [costDurationHours, setCostDurationHours] = usePersistedState<number>('costDuration', 8);
  const [costUntilHour, setCostUntilHour] = usePersistedState<number | null>('costUntil', 22);
  const [costActivePreset, setCostActivePreset] = usePersistedState<string>('costPreset', 'EV Charge');
  const [costCalcOpen, setCostCalcOpen] = usePersistedState<boolean>('costCalcOpen', false);

  // Shared: prepare hourly chart data and scan start for cost calculator
  const { costChartData, costScanFrom } = useMemo(() => {
    if (prices.length === 0) return { costChartData: [] as { timestamp: string; displayPrice: number }[], costScanFrom: new Date() };
    const hourlyPrices = aggregatePrices(prices, 1);
    const data = hourlyPrices.map(p => ({
      timestamp: p.timestamp,
      displayPrice: includeVat ? applyVat(p.priceCentsKwh) : p.priceCentsKwh,
    }));
    let scanFrom: Date;
    if (period === 'tomorrow') {
      scanFrom = startOfTomorrow();
    } else {
      scanFrom = new Date();
      scanFrom.setMinutes(0, 0, 0);
    }
    return { costChartData: data, costScanFrom: scanFrom };
  }, [prices, includeVat, period]);

  const cheapestWindow = useMemo(() => {
    if (costDurationHours <= 0 || costChartData.length === 0) return null;
    return findCheapestWindow(costChartData, costDurationHours, costUntilHour, costScanFrom);
  }, [costChartData, costDurationHours, costUntilHour, costScanFrom]);

  const currentWindowAvgPrice = useMemo(() => {
    if (costDurationHours <= 0 || costChartData.length === 0) return null;
    return computeWindowAverage(costChartData, costDurationHours, costScanFrom);
  }, [costChartData, costDurationHours, costScanFrom]);

  return {
    costConsumptionKwh, setCostConsumptionKwh,
    costDurationHours, setCostDurationHours,
    costUntilHour, setCostUntilHour,
    costActivePreset, setCostActivePreset,
    costCalcOpen, setCostCalcOpen,
    costChartData,
    costScanFrom,
    cheapestWindow,
    currentWindowAvgPrice,
  };
}
