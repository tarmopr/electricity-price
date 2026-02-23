'use client';

import { useState, useEffect } from 'react';
import {
    getPricesWithPrediction,
    getCurrentPrice,
    calculateStatistics,
    ElectricityPrice
} from '@/lib/api';
import {
    startOfYesterday, endOfYesterday,
    startOfToday, endOfToday,
    startOfTomorrow, endOfTomorrow,
    startOfWeek, endOfWeek,
    startOfMonth, endOfMonth,
    startOfYear, endOfYear,
    format
} from 'date-fns';
import PriceChart from './PriceChart';
import CurrentPriceCard from './CurrentPriceCard';
import Controls from './Controls';
import { RefreshCw } from 'lucide-react';

export type Timeframe = 'yesterday' | 'today' | 'tomorrow' | 'week' | 'month' | 'year' | 'custom';

export default function Dashboard() {
    const [prices, setPrices] = useState<ElectricityPrice[]>([]);
    const [currentPrice, setCurrentPrice] = useState<ElectricityPrice | null>(null);
    const [previousPrice, setPreviousPrice] = useState<ElectricityPrice | null>(null);
    const [nextPrice, setNextPrice] = useState<ElectricityPrice | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // User Settings
    const [includeVat, setIncludeVat] = useState<boolean>(true);
    const [showNow, setShowNow] = useState<boolean>(true);
    const [showMean, setShowMean] = useState<boolean>(false);
    const [showMedian, setShowMedian] = useState(false);
    const [showP75, setShowP75] = useState(false);
    const [showP90, setShowP90] = useState(false);
    const [showP95, setShowP95] = useState(false);

    // Timeframe Settings
    const [timeframe, setTimeframe] = useState<Timeframe>('today');
    const [customStart, setCustomStart] = useState<string>(format(startOfToday(), 'yyyy-MM-dd'));
    const [customEnd, setCustomEnd] = useState<string>(format(endOfToday(), 'yyyy-MM-dd'));

    useEffect(() => {
        async function fetchData() {
            try {
                setLoading(true);
                setError(null);

                // Fetch data array
                let start: Date, end: Date;
                const now = new Date();
                switch (timeframe) {
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
                    case 'week':
                        start = startOfWeek(now, { weekStartsOn: 1 });
                        end = endOfWeek(now, { weekStartsOn: 1 });
                        break;
                    case 'month':
                        start = startOfMonth(now);
                        end = endOfMonth(now);
                        break;
                    case 'year':
                        start = startOfYear(now);
                        end = endOfYear(now);
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

                const data = await getPricesWithPrediction(start, end);
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
                        // Current time isn't fully enclosed in the selected timeframe, fetch just the surrounding hours
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
    }, [timeframe, customStart, customEnd]);

    // Calculate statistics only once when prices or VAT settings change
    const stats = calculateStatistics(prices, includeVat);

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
                        timeframe={timeframe}
                        setTimeframe={setTimeframe}
                        customStart={customStart}
                        setCustomStart={setCustomStart}
                        customEnd={customEnd}
                        setCustomEnd={setCustomEnd}
                    />
                </div>
            </div>

            {/* Main Chart Area */}
            <div className="bg-zinc-900/30 p-2 sm:p-6 rounded-3xl border border-zinc-800/80 shadow-2xl backdrop-blur-xl">
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
                />
            </div>

        </div>
    );
}
