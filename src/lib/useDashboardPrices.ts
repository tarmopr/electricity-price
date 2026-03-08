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
    rawPrices: ElectricityPrice[];
    currentPrice: ElectricityPrice | null;
    previousPrice: ElectricityPrice | null;
    nextPrice: ElectricityPrice | null;
    heatmapPrices: ElectricityPrice[];
    highlightedDates: string[] | undefined;
    loading: boolean;
    error: string | null;
}

export function useDashboardPrices(
    period: Period,
    customStart: string,
    customEnd: string,
): UseDashboardPricesResult {
    const [prices, setPrices] = useState<ElectricityPrice[]>([]);
    const [rawPrices, setRawPrices] = useState<ElectricityPrice[]>([]);
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

                let start: Date, end: Date;

                switch (period) {
                    case 'yesterday':
                        start = startOfYesterday();
                        end = endOfYesterday();
                        break;
                    case 'today':
                        start = startOfToday();
                        end = endOfToday();
                        break;
                    case 'tomorrow':
                        start = startOfTomorrow();
                        end = endOfTomorrow();
                        break;
                    case 'this_week':
                        start = startOfWeek(new Date(), { weekStartsOn: 1 });
                        end = endOfWeek(new Date(), { weekStartsOn: 1 });
                        break;
                    case 'last_7_days':
                        start = subDays(startOfToday(), 7);
                        end = endOfToday();
                        break;
                    case 'next_7_days':
                        start = startOfTomorrow();
                        end = addDays(endOfTomorrow(), 6);
                        break;
                    case 'last_30_days':
                        start = subMonths(startOfToday(), 1);
                        end = endOfToday();
                        break;
                    case 'custom':
                        start = customStart ? new Date(customStart) : startOfToday();
                        end = customEnd ? new Date(customEnd) : endOfToday();
                        start.setHours(0, 0, 0, 0);
                        end.setHours(23, 59, 59, 999);
                        if (start > end) {
                            const temp = start;
                            start = end;
                            end = temp;
                        }
                        break;
                    default: {
                        const _exhaustive: never = period;
                        throw new Error(`Unhandled period: ${_exhaustive}`);
                    }
                }

                const rawData = await getPricesWithPrediction(start, end);
                setRawPrices(rawData);

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
                let data = rawData;
                if (period === 'last_7_days' || period === 'this_week' || period === 'next_7_days') {
                    data = aggregatePrices(rawData, 1);
                } else if (period === 'last_30_days') {
                    data = aggregatePrices(rawData, 6);
                } else if (period === 'custom') {
                    const daysDifference = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
                    if (daysDifference > 90) {
                        data = aggregatePrices(rawData, 24);
                    } else if (daysDifference > 30) {
                        data = aggregatePrices(rawData, 12);
                    } else if (daysDifference > 7) {
                        data = aggregatePrices(rawData, 6);
                    } else if (daysDifference > 3) {
                        data = aggregatePrices(rawData, 1);
                    }
                }

                setPrices(data);

                // Current price and neighbors
                const current = await getCurrentPrice();
                setCurrentPrice(current);

                if (current) {
                    const currentIdx = data.findIndex(p => p.timestamp === current.timestamp);
                    if (currentIdx > 0 && currentIdx < data.length - 1) {
                        setPreviousPrice(data[currentIdx - 1]);
                        setNextPrice(data[currentIdx + 1]);
                    } else {
                        const now = new Date();
                        const ctxStart = new Date(now);
                        ctxStart.setHours(now.getHours() - 2);
                        const ctxEnd = new Date(now);
                        ctxEnd.setHours(now.getHours() + 2);

                        const contextData = await getPricesWithPrediction(ctxStart, ctxEnd);
                        const ctxIdx = contextData.findIndex(p => p.timestamp === current.timestamp);

                        setPreviousPrice(ctxIdx > 0 ? contextData[ctxIdx - 1] : null);
                        setNextPrice(
                            ctxIdx !== -1 && ctxIdx < contextData.length - 1
                                ? contextData[ctxIdx + 1]
                                : null
                        );
                    }
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
        rawPrices,
        currentPrice,
        previousPrice,
        nextPrice,
        heatmapPrices,
        highlightedDates,
        loading,
        error,
    };
}
