'use client';

import { useState, useEffect, useMemo } from 'react';
import {
    calculateStatistics,
    aggregatePrices,
} from '@/lib/api';
import { applyVat } from '@/lib/price';
import { usePersistedState } from '@/lib/usePersistedState';
import { useDashboardPrices } from '@/lib/useDashboardPrices';
import { usePriceAlerts } from '@/lib/usePriceAlerts';
import { usePatternOverlays } from '@/lib/usePatternOverlays';
import {
    startOfToday, endOfToday,
    startOfTomorrow,
    format,
} from 'date-fns';
import { PILL_BASE, pillClass } from '@/lib/styles';
import PriceChart from './PriceChart';
import CurrentPriceCard from './CurrentPriceCard';
import Controls from './Controls';
import PriceAlertBanner from './PriceAlertBanner';
import CostCalculator from './CostCalculator';
import PriceHeatmap from './PriceHeatmap';
import ShareButton from './ShareButton';
import { decodeParamsToState } from '@/lib/shareState';
import { findCheapestWindow, computeWindowAverage } from '@/lib/cheapestWindow';
import { RefreshCw, BarChart3, Grid3X3, Info } from 'lucide-react';
import type { Period, ViewMode } from '@/lib/types';

export default function Dashboard() {
    // User Settings (persisted to localStorage across sessions)
    const [includeVat, setIncludeVat] = usePersistedState<boolean>('includeVat', true);
    const [showNow, setShowNow] = usePersistedState<boolean>('showNow', true);
    const [showMean, setShowMean] = usePersistedState<boolean>('showMean', false);
    const [showMedian, setShowMedian] = usePersistedState<boolean>('showMedian', false);
    const [showP75, setShowP75] = usePersistedState<boolean>('showP75', false);
    const [showP90, setShowP90] = usePersistedState<boolean>('showP90', false);
    const [showP95, setShowP95] = usePersistedState<boolean>('showP95', false);

    // Period Settings (persisted, except custom dates which reset daily)
    const [period, setPeriod] = usePersistedState<Period>('period', 'today');
    const [customStart, setCustomStart] = useState<string>(format(startOfToday(), 'yyyy-MM-dd'));
    const [customEnd, setCustomEnd] = useState<string>(format(endOfToday(), 'yyyy-MM-dd'));

    // View Mode (persisted)
    const [viewMode, setViewMode] = usePersistedState<ViewMode>('viewMode', 'chart');

    // Cost Calculator Settings (persisted)
    const [costConsumptionKwh, setCostConsumptionKwh] = usePersistedState<number>('costKwh', 40);
    const [costDurationHours, setCostDurationHours] = usePersistedState<number>('costDuration', 8);
    const [costUntilHour, setCostUntilHour] = usePersistedState<number | null>('costUntil', 22);
    const [costActivePreset, setCostActivePreset] = usePersistedState<string>('costPreset', 'EV Charge');
    const [costCalcOpen, setCostCalcOpen] = usePersistedState<boolean>('costCalcOpen', false);

    // --- Custom Hooks ---
    const {
        prices,
        currentPrice,
        previousPrice,
        nextPrice,
        heatmapPrices,
        highlightedDates,
        loading,
        error,
    } = useDashboardPrices(period, customStart, customEnd);

    const {
        alertConfig,
        setAlertConfig,
        activeAlert,
        alertDismissed,
        dismissAlert,
    } = usePriceAlerts(currentPrice, includeVat);

    const {
        showAvg7d,
        setShowAvg7d,
        showAvg30d,
        setShowAvg30d,
        avg7dPattern,
        avg30dPattern,
    } = usePatternOverlays();

    // Restore state from URL params on mount (for shared links)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const shared = decodeParamsToState(params);
        if (!shared) return;

        if (shared.period) setPeriod(shared.period);
        if (shared.includeVat !== undefined) setIncludeVat(shared.includeVat);
        if (shared.viewMode) setViewMode(shared.viewMode);
        if (shared.customStart) setCustomStart(shared.customStart);
        if (shared.customEnd) setCustomEnd(shared.customEnd);

        // Clean the URL params after restoring (don't pollute browser history)
        window.history.replaceState({}, '', window.location.pathname);
    }, []);

    // Calculate statistics only once when prices or VAT settings change
    const stats = calculateStatistics(prices, includeVat);

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

    // Show info banner when tomorrow is selected but official prices aren't published yet
    const allPredicted = useMemo(() => {
        return period === 'tomorrow' && prices.length > 0 && prices.every(p => p.isPredicted);
    }, [period, prices]);

    if (loading && prices.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-zinc-400 space-y-4">
                <RefreshCw className="w-8 h-8 animate-spin text-green-500" />
                <p className="animate-pulse tracking-wide uppercase text-sm font-semibold">Loading Market Data...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-500/10 border border-red-500/50 p-6 rounded-2xl text-center max-w-lg mx-auto mt-20">
                <p className="text-red-400 font-medium">{error}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors border border-red-500/30"
                >
                    Try Again
                </button>
            </div>
        );
    }

    return (
        <div className="w-full max-w-6xl mx-auto space-y-6">

            {/* Price Alert Banner */}
            {activeAlert && !alertDismissed && (
                <PriceAlertBanner
                    alert={activeAlert}
                    onDismiss={dismissAlert}
                />
            )}

            {/* Top Row: Current Price & Controls */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 border-b border-zinc-800 pb-4 lg:border-none lg:pb-0 h-full">
                    <CurrentPriceCard
                        currentPrice={currentPrice}
                        previousPrice={previousPrice}
                        nextPrice={nextPrice}
                        medianPrice={stats?.median}
                        includeVat={includeVat}
                    />
                </div>
                <div className="lg:col-span-2 h-full">
                    <Controls
                        includeVat={includeVat}
                        setIncludeVat={setIncludeVat}
                        showNow={showNow}
                        setShowNow={setShowNow}
                        showMean={showMean}
                        setShowMean={setShowMean}
                        showMedian={showMedian}
                        setShowMedian={setShowMedian}
                        showP75={showP75}
                        setShowP75={setShowP75}
                        showP90={showP90}
                        setShowP90={setShowP90}
                        showP95={showP95}
                        setShowP95={setShowP95}
                        showAvg7d={showAvg7d}
                        setShowAvg7d={setShowAvg7d}
                        showAvg30d={showAvg30d}
                        setShowAvg30d={setShowAvg30d}
                        period={period}
                        setPeriod={setPeriod}
                        customStart={customStart}
                        setCustomStart={setCustomStart}
                        customEnd={customEnd}
                        setCustomEnd={setCustomEnd}
                        alertConfig={alertConfig}
                        setAlertConfig={setAlertConfig}
                    />
                </div>
            </div>

            {/* Tomorrow prediction banner */}
            {allPredicted && (
                <div className="flex items-start gap-3 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl p-4">
                    <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-indigo-200/80">
                        Official prices typically published around 14:00 CET. Showing predictions based on recent patterns.
                    </p>
                </div>
            )}

            {/* View Mode Toggle + Main Visualization */}
            <div className="bg-zinc-900/40 p-2 sm:p-6 rounded-3xl border border-zinc-800/80 hover:border-zinc-700/60 transition-all duration-500 shadow-[0_8px_30px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_40px_rgba(0,0,0,0.4)] hover:-translate-y-1 backdrop-blur-2xl">
                {/* View Toggle + Share */}
                <div className="flex items-center justify-between px-2 sm:px-0 mb-2">
                    <div className="flex items-center gap-2" role="group" aria-label="View mode">
                        <button
                            onClick={() => setViewMode('chart')}
                            aria-pressed={viewMode === 'chart'}
                            className={`flex items-center gap-1.5 ${PILL_BASE} ${pillClass(viewMode === 'chart')}`}
                        >
                            <BarChart3 className="w-3.5 h-3.5" />
                            Chart
                        </button>
                        <button
                            onClick={() => setViewMode('heatmap')}
                            aria-pressed={viewMode === 'heatmap'}
                            className={`flex items-center gap-1.5 ${PILL_BASE} ${pillClass(viewMode === 'heatmap')}`}
                        >
                            <Grid3X3 className="w-3.5 h-3.5" />
                            Heatmap
                        </button>
                    </div>
                    <ShareButton
                        state={{
                            period,
                            includeVat,
                            viewMode,
                            customStart: period === 'custom' ? customStart : undefined,
                            customEnd: period === 'custom' ? customEnd : undefined,
                        }}
                    />
                </div>

                {viewMode === 'chart' ? (
                    <PriceChart
                        data={prices}
                        currentPrice={currentPrice}
                        includeVat={includeVat}
                        showNow={showNow}
                        showMean={showMean}
                        showMedian={showMedian}
                        showP75={showP75}
                        showP90={showP90}
                        showP95={showP95}
                        stats={stats}
                        cheapestWindow={costCalcOpen ? cheapestWindow : null}
                        avg7dPattern={avg7dPattern}
                        avg30dPattern={avg30dPattern}
                        showAvg7d={showAvg7d}
                        showAvg30d={showAvg30d}
                    />
                ) : (
                    <PriceHeatmap
                        data={heatmapPrices}
                        includeVat={includeVat}
                        highlightedDates={highlightedDates}
                        cheapestWindow={costCalcOpen ? cheapestWindow : null}
                    />
                )}
            </div>

            {/* Cost Calculator */}
            <CostCalculator
                isOpen={costCalcOpen}
                setIsOpen={setCostCalcOpen}
                currentPrice={currentWindowAvgPrice}
                cheapestWindow={cheapestWindow}
                meanPrice={stats?.mean ?? null}
                maxPrice={stats?.max ?? null}
                consumptionKwh={costConsumptionKwh}
                setConsumptionKwh={setCostConsumptionKwh}
                durationHours={costDurationHours}
                setDurationHours={setCostDurationHours}
                untilHour={costUntilHour}
                setUntilHour={setCostUntilHour}
                activePreset={costActivePreset}
                setActivePreset={setCostActivePreset}
            />

        </div>
    );
}
