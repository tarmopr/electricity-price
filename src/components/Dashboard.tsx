'use client';

import { useState, useEffect } from 'react';
import {
    getDashboardPrices,
    getCurrentPrice,
    calculateStatistics,
    ElectricityPrice
} from '@/lib/api';
import PriceChart from './PriceChart';
import CurrentPriceCard from './CurrentPriceCard';
import Controls from './Controls';
import { RefreshCw } from 'lucide-react';

export default function Dashboard() {
    const [prices, setPrices] = useState<ElectricityPrice[]>([]);
    const [currentPrice, setCurrentPrice] = useState<ElectricityPrice | null>(null);
    const [previousPrice, setPreviousPrice] = useState<ElectricityPrice | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // User Settings
    const [includeVat, setIncludeVat] = useState(true);
    const [showMean, setShowMean] = useState(false);
    const [showMedian, setShowMedian] = useState(false);
    const [showP75, setShowP75] = useState(false);
    const [showP90, setShowP90] = useState(false);
    const [showP95, setShowP95] = useState(false);

    useEffect(() => {
        async function fetchData() {
            try {
                setLoading(true);
                setError(null);

                // Fetch data array
                const data = await getDashboardPrices();
                setPrices(data);

                // Extract precise current price and previous
                const current = await getCurrentPrice();
                setCurrentPrice(current);

                if (current && data.length > 0) {
                    // Find the hour just before the current one to show trend
                    const currentIdx = data.findIndex(p => p.timestamp === current.timestamp);
                    if (currentIdx > 0) {
                        setPreviousPrice(data[currentIdx - 1]);
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
    }, []);

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
                <div className="lg:col-span-1 border-b border-zinc-800 pb-6 lg:border-none lg:pb-0">
                    <CurrentPriceCard
                        currentPrice={currentPrice}
                        previousPrice={previousPrice}
                        includeVat={includeVat}
                    />
                </div>
                <div className="lg:col-span-2 flex flex-col justify-end">
                    <Controls
                        includeVat={includeVat}
                        setIncludeVat={setIncludeVat}
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
                    />
                </div>
            </div>

            {/* Main Chart Area */}
            <div className="bg-zinc-900/30 p-2 sm:p-6 rounded-3xl border border-zinc-800/80 shadow-2xl backdrop-blur-xl">
                <PriceChart
                    data={prices}
                    includeVat={includeVat}
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
