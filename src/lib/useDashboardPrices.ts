'use client';

import { useState, useEffect } from 'react';
import {
    getPricesWithPrediction,
    getHeatmapPricesWithPredictions,
    getCurrentPrice,
    aggregatePrices,
    ElectricityPrice,
} from '@/lib/api';
import {
    startOfYesterday, endOfYesterday,
    startOfToday, endOfToday,
    startOfTomorrow, endOfTomorrow,
    startOfWeek, endOfWeek,
    subDays, subMonths, addDays,
} from 'date-fns';
import { getHeatmapWeekRange } from '@/lib/heatmapData';
import { Period } from '@/lib/types';

interface UseDashboardPricesResult {
    prices: ElectricityPrice[];
    currentPrice: ElectricityPrice | null;
    previousPrice: ElectricityPrice | null;
    nextPrice: ElectricityPrice | null;
    heatmapPrices: ElectricityPrice[];
    highlightedDates: string[] | undefined;
    loading: boolean;
    error: string | null;
}

/**
 * Maps a period + optional custom date strings to concrete start/end Date objects.
 * For 'custom', if start > end they are swapped.
 */
export function getDateRangeForPeriod(
    period: Period,
    customStart: string,
    customEnd: string,
): { start: Date; end: Date } {
    switch (period) {
        case 'yesterday':
            return { start: startOfYesterday(), end: endOfYesterday() };
        case 'today':
            return { start: startOfToday(), end: endOfToday() };
        case 'tomorrow':
            return { start: startOfTomorrow(), end: endOfTomorrow() };
        case 'this_week':
            return {
                start: startOfWeek(new Date(), { weekStartsOn: 1 }),
                end: endOfWeek(new Date(), { weekStartsOn: 1 }),
            };
        case 'last_7_days':
            return { start: subDays(startOfToday(), 7), end: endOfToday() };
        case 'next_7_days':
            return { start: startOfTomorrow(), end: addDays(endOfTomorrow(), 6) };
        case 'last_30_days':
            return { start: subMonths(startOfToday(), 1), end: endOfToday() };
        case 'custom': {
            let start = customStart ? new Date(customStart) : startOfToday();
            let end = customEnd ? new Date(customEnd) : endOfToday();
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            if (start > end) {
                [start, end] = [end, start];
            }
            return { start, end };
        }
        default: {
            const _exhaustive: never = period;
            throw new Error(`Unhandled period: ${_exhaustive}`);
        }
    }
}

/**
 * Returns the aggregation interval in hours for a given period and date range.
 * Returns 0 to indicate no aggregation (keep original resolution).
 */
export function getAggregationHours(period: Period, start: Date, end: Date): number {
    if (period === 'last_7_days' || period === 'this_week' || period === 'next_7_days') {
        return 1;
    }
    if (period === 'last_30_days') {
        return 6;
    }
    if (period === 'custom') {
        const daysDifference = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        if (daysDifference > 90) return 24;
        if (daysDifference > 30) return 12;
        if (daysDifference > 7) return 6;
        if (daysDifference > 3) return 1;
    }
    return 0;
}

/**
 * Finds the previous and next price relative to the current price in the given data.
 * If the current price isn't found in the chart data, fetches a ±2h context window.
 */
async function fetchCurrentPriceContext(
    current: ElectricityPrice,
    data: ElectricityPrice[],
): Promise<{ previous: ElectricityPrice | null; next: ElectricityPrice | null }> {
    const currentIdx = data.findIndex(p => p.timestamp === current.timestamp);
    if (currentIdx > 0 && currentIdx < data.length - 1) {
        return { previous: data[currentIdx - 1], next: data[currentIdx + 1] };
    }

    const now = new Date();
    const ctxStart = new Date(now);
    ctxStart.setHours(now.getHours() - 2);
    const ctxEnd = new Date(now);
    ctxEnd.setHours(now.getHours() + 2);

    const contextData = await getPricesWithPrediction(ctxStart, ctxEnd);
    const ctxIdx = contextData.findIndex(p => p.timestamp === current.timestamp);

    return {
        previous: ctxIdx > 0 ? contextData[ctxIdx - 1] : null,
        next: ctxIdx !== -1 && ctxIdx < contextData.length - 1
            ? contextData[ctxIdx + 1]
            : null,
    };
}

export function useDashboardPrices(
    period: Period,
    customStart: string,
    customEnd: string,
): UseDashboardPricesResult {
    const [prices, setPrices] = useState<ElectricityPrice[]>([]);
    const [currentPrice, setCurrentPrice] = useState<ElectricityPrice | null>(null);
    const [previousPrice, setPreviousPrice] = useState<ElectricityPrice | null>(null);
    const [nextPrice, setNextPrice] = useState<ElectricityPrice | null>(null);
    const [heatmapPrices, setHeatmapPrices] = useState<ElectricityPrice[]>([]);
    const [highlightedDates, setHighlightedDates] = useState<string[] | undefined>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchData() {
            try {
                setLoading(true);
                setError(null);

                const { start, end } = getDateRangeForPeriod(period, customStart, customEnd);

                const rawData = await getPricesWithPrediction(start, end);

                // Heatmap week data
                const weekRange = getHeatmapWeekRange(period, start, end);
                if (weekRange) {
                    const heatmapData = await getHeatmapPricesWithPredictions(
                        weekRange.weekStart,
                        weekRange.weekEnd
                    );
                    setHeatmapPrices(heatmapData);
                    setHighlightedDates(weekRange.highlightedDates);
                } else {
                    setHeatmapPrices(rawData);
                    setHighlightedDates(undefined);
                }

                // Data aggregation
                const aggHours = getAggregationHours(period, start, end);
                const data = aggHours > 0 ? aggregatePrices(rawData, aggHours) : rawData;

                setPrices(data);

                // Current price and neighbors
                const current = await getCurrentPrice();
                setCurrentPrice(current);

                if (current) {
                    const { previous, next } = await fetchCurrentPriceContext(current, data);
                    setPreviousPrice(previous);
                    setNextPrice(next);
                }
            } catch (err: unknown) {
                if (err instanceof Error) {
                    setError(err.message);
                } else {
                    setError('Failed to load electricity prices');
                }
            } finally {
                setLoading(false);
            }
        }

        fetchData();

        // Refresh every 15 minutes
        const interval = setInterval(fetchData, 15 * 60 * 1000);
        return () => clearInterval(interval);
    }, [period, customStart, customEnd]);

    return {
        prices,
        currentPrice,
        previousPrice,
        nextPrice,
        heatmapPrices,
        highlightedDates,
        loading,
        error,
    };
}
