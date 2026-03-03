'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    getPricesWithPrediction,
    getHeatmapPricesWithPredictions,
    getCurrentPrice,
    calculateStatistics,
    aggregatePrices,
    applyVat,
    ElectricityPrice
} from '@/lib/api';
import { usePersistedState } from '@/lib/usePersistedState';
import {
    AlertConfig,
    AlertState,
    DEFAULT_ALERT_CONFIG,
    evaluateAlert,
    requestNotificationPermission,
    showAlertNotification,
} from '@/lib/priceAlerts';
import {
    startOfYesterday, endOfYesterday,
    startOfToday, endOfToday,
    startOfTomorrow, endOfTomorrow,
    startOfWeek, endOfWeek,
    subDays, subMonths, addDays,
    format
} from 'date-fns';
import PriceChart from './PriceChart';
import CurrentPriceCard from './CurrentPriceCard';
import Controls from './Controls';
import PriceAlertBanner from './PriceAlertBanner';
import CostCalculator from './CostCalculator';
import PriceHeatmap from './PriceHeatmap';
import ShareButton from './ShareButton';
import { decodeParamsToState } from '@/lib/shareState';
import { getHeatmapWeekRange } from '@/lib/heatmapData';
import { findCheapestWindow } from '@/lib/cheapestWindow';
import { RefreshCw, BarChart3, Grid3X3, Info } from 'lucide-react';

export type Period = 'yesterday' | 'today' | 'tomorrow' | 'this_week' | 'last_7_days' | 'next_7_days' | 'last_30_days' | 'custom';
export type ViewMode = 'chart' | 'heatmap';

export default function Dashboard() {
    const [prices, setPrices] = useState<ElectricityPrice[]>([]);
    const [_rawPrices, setRawPrices] = useState<ElectricityPrice[]>([]);
    const [currentPrice, setCurrentPrice] = useState<ElectricityPrice | null>(null);
    const [previousPrice, setPreviousPrice] = useState<ElectricityPrice | null>(null);
    const [nextPrice, setNextPrice] = useState<ElectricityPrice | null>(null);
    const [heatmapPrices, setHeatmapPrices] = useState<ElectricityPrice[]>([]);
    const [highlightedDates, setHighlightedDates] = useState<string[] | undefined>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

    // Price Alert Settings (persisted)
    const [alertConfig, setAlertConfig] = usePersistedState<AlertConfig>('alertConfig', DEFAULT_ALERT_CONFIG);
    const [activeAlert, setActiveAlert] = useState<AlertState | null>(null);
    const [alertDismissed, setAlertDismissed] = useState(false);
    // Track last notified price to avoid repeated browser notifications
    const lastNotifiedPriceRef = useRef<number | null>(null);

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
    // eslint-disable-next-line
    }, []);

    // Request notification permission when alerts are first enabled
    const handleSetAlertConfig = useCallback((config: AlertConfig) => {
        setAlertConfig(config);
        if (config.enabled) {
            requestNotificationPermission();
        }
        // Reset dismissed state when config changes so user sees new alerts
        setAlertDismissed(false);
    }, [setAlertConfig]);

    // Evaluate alert whenever current price or alert config changes
    useEffect(() => {
        if (!currentPrice || !alertConfig.enabled) {
            setActiveAlert(null);
            return;
        }

        const price = includeVat
            ? applyVat(currentPrice.priceCentsKwh)
            : currentPrice.priceCentsKwh;

        const alert = evaluateAlert(alertConfig, price);
        setActiveAlert(alert);

        // Send browser notification only once per price change
        if (alert && lastNotifiedPriceRef.current !== currentPrice.priceCentsKwh) {
            showAlertNotification(alert);
            lastNotifiedPriceRef.current = currentPrice.priceCentsKwh;
        }

        if (!alert) {
            // Reset dismissed flag when condition clears so next trigger shows
            setAlertDismissed(false);
            lastNotifiedPriceRef.current = null;
        }
    }, [currentPrice, alertConfig, includeVat]);

    useEffect(() => {
        async function fetchData() {
            try {
                setLoading(true);
                setError(null);

                // Fetch data array
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
                        end = addDays(endOfTomorrow(), 6); // Tomorrow + 6 days = 7 days total
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
                    default:
                        start = startOfToday();
                        end = endOfToday();
                }

                const rawData = await getPricesWithPrediction(start, end);
                setRawPrices(rawData);

                // --- HEATMAP WEEK DATA ---
                // For single-day periods and this_week, expand to full week with predictions
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

                // --- DATA AGGREGATION LOGIC ---
                let data = rawData;
                if (period === 'last_7_days' || period === 'this_week' || period === 'next_7_days') {
                    // 1-hour intervals (average 4 points -> 1)
                    data = aggregatePrices(rawData, 1);
                } else if (period === 'last_30_days') {
                    // 6-hour intervals (average 24 points -> 1)
                    data = aggregatePrices(rawData, 6);
                } else if (period === 'custom') {
                    const daysDifference = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
                    if (daysDifference > 90) {
                        // 24-hour intervals for custom ranges longer than 3 months
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

                // Extract precise current price and previous
                const current = await getCurrentPrice();
                setCurrentPrice(current);

                if (current) {
                    // Try to find it in the already fetched dataset
                    const currentIdx = data.findIndex(p => p.timestamp === current.timestamp);
                    if (currentIdx > 0 && currentIdx < data.length - 1) {
                        setPreviousPrice(data[currentIdx - 1]);
                        setNextPrice(data[currentIdx + 1]);
                    } else {
                        // Current time isn't fully enclosed in the selected period, fetch just the surrounding hours
                        const now = new Date();
                        const ctxStart = new Date(now);
                        ctxStart.setHours(now.getHours() - 2);
                        const ctxEnd = new Date(now);
                        ctxEnd.setHours(now.getHours() + 2);

                        const contextData = await getPricesWithPrediction(ctxStart, ctxEnd);
                        const ctxIdx = contextData.findIndex(p => p.timestamp === current.timestamp);

                        if (ctxIdx > 0) {
                            setPreviousPrice(contextData[ctxIdx - 1]);
                        } else {
                            setPreviousPrice(null);
                        }

                        if (ctxIdx !== -1 && ctxIdx < contextData.length - 1) {
                            setNextPrice(contextData[ctxIdx + 1]);
                        } else {
                            setNextPrice(null);
                        }
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

        // Refresh data every 15 minutes to ensure current hour is accurate
        const interval = setInterval(fetchData, 15 * 60 * 1000);
        return () => clearInterval(interval);
    }, [period, customStart, customEnd]);

    // Calculate statistics only once when prices or VAT settings change
    const stats = calculateStatistics(prices, includeVat);

    // Cost Calculator open state (persisted) — controls cheapest window visibility
    const [costCalcOpen, setCostCalcOpen] = usePersistedState<boolean>('costCalcOpen', false);

    // Compute cheapest window from cost calculator settings
    const cheapestWindow = useMemo(() => {
        if (costDurationHours <= 0 || prices.length === 0) return null;

        // Always aggregate to 1-hour buckets before cheapest window calculation.
        // Raw data may be in 15-minute intervals for today/tomorrow periods.
        const hourlyPrices = aggregatePrices(prices, 1);
        const chartData = hourlyPrices.map(p => ({
            timestamp: p.timestamp,
            displayPrice: includeVat ? applyVat(p.priceCentsKwh) : p.priceCentsKwh,
        }));

        // Determine scan start based on period
        let scanFrom: Date;
        if (period === 'tomorrow') {
            scanFrom = startOfTomorrow();
        } else {
            // For today, this_week, and all other periods: start from now
            scanFrom = new Date();
            scanFrom.setMinutes(0, 0, 0);
        }

        return findCheapestWindow(chartData, costDurationHours, costUntilHour, scanFrom);
    }, [prices, costDurationHours, costUntilHour, includeVat, period]);

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
                    onDismiss={() => setAlertDismissed(true)}
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
                        period={period}
                        setPeriod={setPeriod}
                        customStart={customStart}
                        setCustomStart={setCustomStart}
                        customEnd={customEnd}
                        setCustomEnd={setCustomEnd}
                        alertConfig={alertConfig}
                        setAlertConfig={handleSetAlertConfig}
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
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setViewMode('chart')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all border ${viewMode === 'chart' ? 'bg-emerald-400/20 text-emerald-300 border-emerald-400/50' : 'bg-zinc-800/50 text-zinc-400 border-zinc-700 hover:bg-zinc-800'}`}
                        >
                            <BarChart3 className="w-3.5 h-3.5" />
                            Chart
                        </button>
                        <button
                            onClick={() => setViewMode('heatmap')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all border ${viewMode === 'heatmap' ? 'bg-indigo-400/20 text-indigo-300 border-indigo-400/50' : 'bg-zinc-800/50 text-zinc-400 border-zinc-700 hover:bg-zinc-800'}`}
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
                currentPrice={
                    currentPrice
                        ? includeVat
                            ? applyVat(currentPrice.priceCentsKwh)
                            : currentPrice.priceCentsKwh
                        : null
                }
                cheapestWindowPrice={cheapestWindow?.averagePrice ?? null}
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
