'use client';

import { useState, useEffect } from 'react';
import {
    Area,
    AreaChart,
    CartesianGrid,
    ReferenceLine,
    ReferenceArea,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';
import { format, isSameHour } from 'date-fns';
import { ElectricityPrice } from '@/lib/api';

interface PriceChartProps {
    data: ElectricityPrice[];
    currentPrice: ElectricityPrice | null;
    includeVat: boolean;
    showNow: boolean;
    showMean: boolean;
    showMedian: boolean;
    showP75: boolean;
    showP90: boolean;
    showP95: boolean;
    stats: {
        mean: number;
        median: number;
        p75: number;
        p90: number;
        p95: number;
    } | null;
    showCheapestPeriod: boolean;
    cheapestPeriodHours: number;
    cheapestPeriodUntil: string;
}

export default function PriceChart({
    data,
    currentPrice,
    includeVat,
    showNow,
    showMean,
    showMedian,
    showP75,
    showP90,
    showP95,
    stats,
    showCheapestPeriod,
    cheapestPeriodHours,
    cheapestPeriodUntil
}: PriceChartProps) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    if (!mounted) {
        return <div className="w-full h-[400px] mt-4 relative bg-zinc-900/10 animate-pulse rounded-xl flex items-center justify-center text-zinc-600 border border-zinc-800/50">Loading chart...</div>;
    }

    if (!data || data.length === 0) return <div className="h-64 flex items-center justify-center text-zinc-500">No data available</div>;

    const now = new Date();

    // Use the explicit current price timestamp from API if available, otherwise fallback to local hour
    const activeCurrentTimestamp = currentPrice?.timestamp || data.find(item => isSameHour(item.date, now))?.timestamp;

    // Process data for the chart, including color coding for past vs future
    const chartData = data.map(item => {
        const price = includeVat ? item.priceCentsKwh * 1.22 : item.priceCentsKwh;

        // Find if this item is the current hour (unused variables removed to pass lint)

        // An item is "past" if its date is before the current active hour's date
        // We find the current hour's date to compare correctly

        return {
            ...item,
            displayPrice: parseFloat(price.toFixed(2)),
            // For visual distinction
            knownPrice: !item.isPredicted ? parseFloat(price.toFixed(2)) : null,
            predictedPrice: item.isPredicted ? parseFloat(price.toFixed(2)) : null,
        };
    });

    // Fix Recharts Area visual gaps by connecting the end of one segment to the start of the next.
    // Recharts requires both dataKeys to be present on the boundary coordinate to draw a continuous line.
    chartData.forEach((item, i) => {
        if (i > 0) {
            const prev = chartData[i - 1];

            // Connect Known to Predicted: Extend the predicted path backwards
            if (item.predictedPrice !== null && prev.predictedPrice === null) {
                if (prev.knownPrice !== null) {
                    prev.predictedPrice = prev.knownPrice;
                }
            }
        }
    });

    const currentTimestamp = activeCurrentTimestamp;


    // Dynamically determine X-axis format based on the time span
    let xAxisFormat = 'HH:mm';
    let minTickGap = 30; // default for hours
    if (data.length > 0) {
        const start = new Date(data[0].timestamp);
        const end = new Date(data[data.length - 1].timestamp);
        const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);

        if (diffDays > 180) {
            xAxisFormat = 'MMM yyyy';
            minTickGap = 50;
        } else if (diffDays > 3) {
            xAxisFormat = 'MMM d';
            minTickGap = 40;
        }
    }

    // Calculate gradient offsets for knownPrice based on Median
    let medianOffset = 0.5;
    if (chartData.length > 0 && stats) {
        const knownPrices = chartData.map(d => d.knownPrice).filter((p): p is number => p !== null);
        if (knownPrices.length > 0) {
            const dataMax = Math.max(...knownPrices);
            const dataMin = Math.min(...knownPrices);

            if (dataMax > dataMin) {
                // Median position relative to min and max. 0 is bottom (min), 1 is top (max).
                // Gradients go top-to-bottom, so y=0 is top (max), y=1 is bottom (min).
                medianOffset = (dataMax - stats.median) / (dataMax - dataMin);
                medianOffset = Math.max(0, Math.min(1, medianOffset)); // Clamp
            }
        }
    }

    // --- CHEAPEST PERIOD CALCULATION ---
    let cheapestWindowStart: string | null = null;
    let cheapestWindowEnd: string | null = null;
    let cheapestAverage: number | null = null;

    if (showCheapestPeriod && chartData.length > 0 && cheapestPeriodHours > 0) {
        let startIndex = 0;
        const currentHourStart = new Date(now);
        currentHourStart.setMinutes(0, 0, 0);

        const foundIndex = chartData.findIndex(item => new Date(item.timestamp).getTime() >= currentHourStart.getTime());
        if (foundIndex !== -1) {
            startIndex = foundIndex;
        } else {
            // The whole chart is in the past, nothing to highlight
            startIndex = chartData.length;
        }

        // Determine the absolute end limit timestamp
        let endLimitTimestamp = new Date(currentHourStart);
        if (cheapestPeriodUntil) {
            const [untilH, untilM] = cheapestPeriodUntil.split(':').map(Number);
            endLimitTimestamp.setHours(untilH, untilM, 0, 0);

            // If the selected time is earlier in the day than "now", they mean tomorrow's time
            if (endLimitTimestamp <= currentHourStart) {
                endLimitTimestamp.setDate(endLimitTimestamp.getDate() + 1);
            }
        } else {
            // Fallback if empty, just use far future
            endLimitTimestamp = new Date(currentHourStart.getTime() + 100 * 24 * 60 * 60 * 1000);
        }

        const endLimitMs = endLimitTimestamp.getTime();

        // Ensure we don't look past the length of the data array
        // Each data point is 1 hour (except when aggregated, but 'hours' logic holds relatively)
        const windowSize = Math.min(cheapestPeriodHours, chartData.length - startIndex);

        if (windowSize > 0) {
            let minSum = Infinity;
            let minIndex = -1;

            for (let i = startIndex; i <= chartData.length - windowSize; i++) {
                // Determine the end time of this window.
                // Assuming 1 index is roughly 1 hour in the display (or its aggregated size).
                // The actual mathematically correct end time is the timestamp of the LAST item in the window + 1 hour.
                const lastItemInWindow = chartData[i + windowSize - 1];
                const windowEndMs = new Date(lastItemInWindow.timestamp).getTime() + (60 * 60 * 1000); // add 1 hour to the start of the last bucket

                if (windowEndMs > endLimitMs) {
                    // This window finishes AFTER the user's "Until" time limit, so skip it (and all subsequent).
                    break;
                }

                let currentSum = 0;
                // Calculate sum for this window
                for (let j = 0; j < windowSize; j++) {
                    currentSum += chartData[i + j].displayPrice;
                }

                if (currentSum < minSum) {
                    minSum = currentSum;
                    minIndex = i;
                }
            }

            if (minIndex !== -1) {
                cheapestWindowStart = chartData[minIndex].timestamp;
                // Ensure the end visually covers the last hour fully
                const endIndex = minIndex + windowSize - 1;
                // The timestamp is the start of the final hour in the block.
                // If we have subsequent data, we highlight UP TO the next hour to make the box fill fully.
                // If it's the very last data point, we highlight to its start.
                cheapestWindowEnd = endIndex + 1 < chartData.length
                    ? chartData[endIndex + 1].timestamp
                    : chartData[endIndex].timestamp;

                cheapestAverage = minSum / windowSize;
            }
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; payload: any }>; label?: string | number }) => {
        if (active && payload && payload.length) {
            const date = new Date(label as string | number);
            const data = payload[0].payload;
            const isPredicted = data.isPredicted;

            return (
                <div className={`bg-zinc-900/90 border ${isPredicted ? 'border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.2)]' : 'border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.2)]'} p-3 rounded-xl backdrop-blur-xl transition-all duration-200`}>
                    <p className="text-zinc-400 text-sm mb-1">
                        {format(date, 'MMM d, HH:mm')}
                        {isPredicted && <span className="ml-2 text-purple-400 italic">(Predicted)</span>}
                    </p>
                    <p className={`font-bold text-lg ${isPredicted ? 'text-purple-400' : 'text-green-400'}`}>
                        {data.displayPrice} <span className="text-xs font-normal text-zinc-500">¢/kWh</span>
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="w-full h-[400px] mt-4 relative overflow-hidden" style={{ WebkitTapHighlightColor: 'transparent' }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} style={{ outline: 'none' }}>
                <AreaChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    style={{ outline: 'none' }}
                >
                    <defs>
                        <linearGradient id="colorPast" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#7f1d1d" stopOpacity={0.8} />
                            <stop offset={`${Math.max(0, medianOffset - 0.15) * 100}%`} stopColor="#ef4444" stopOpacity={0.6} />
                            <stop offset={`${medianOffset * 100}%`} stopColor="#3b82f6" stopOpacity={0.6} />
                            <stop offset={`${Math.min(1, medianOffset + 0.15) * 100}%`} stopColor="#22c55e" stopOpacity={0.6} />
                            <stop offset="100%" stopColor="#14532d" stopOpacity={0.8} />
                        </linearGradient>
                        <linearGradient id="colorFuture" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#71717a" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#71717a" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" opacity={0.4} />
                    <XAxis
                        dataKey="timestamp"
                        tickFormatter={(tick) => format(new Date(tick), xAxisFormat)}
                        stroke="#71717a"
                        tick={{ fill: '#71717a', fontSize: 12 }}
                        tickMargin={10}
                        minTickGap={minTickGap}
                    />
                    <YAxis
                        stroke="#71717a"
                        tick={{ fill: '#71717a', fontSize: 12 }}
                        tickFormatter={(val) => `${val}¢`}
                    />
                    <Tooltip
                        content={<CustomTooltip />}
                        cursor={{ stroke: 'rgba(255,255,255,0.15)', strokeWidth: 2, strokeDasharray: '4 4' }}
                        isAnimationActive={true}
                        animationDuration={200}
                    />

                    {/* Cheapest Period Reference Area */}
                    {showCheapestPeriod && cheapestWindowStart && cheapestWindowEnd && (
                        <ReferenceArea
                            x1={cheapestWindowStart}
                            x2={cheapestWindowEnd}
                            fill="#86efac" // subtle green fill
                            fillOpacity={0.15}
                            strokeOpacity={0}
                            label={{
                                value: `Cheapest ${cheapestPeriodHours}h: ${cheapestAverage?.toFixed(2)} ¢/kWh`,
                                position: 'insideTop',
                                fill: '#4ade80',
                                fontSize: 12,
                                fontWeight: 'bold'
                            }}
                        />
                    )}

                    {/* Current Time Line */}
                    {showNow && currentTimestamp && (
                        <ReferenceLine
                            x={currentTimestamp}
                            stroke="#3b82f6"
                            strokeDasharray="3 3"
                            strokeOpacity={0.5}
                            label={{ position: 'insideTop', value: 'Now', fill: '#3b82f6', fontSize: 12 }}
                        />
                    )}

                    {/* Statistical Reference Lines */}
                    {stats && showMean && <ReferenceLine y={stats.mean} stroke="#fcd34d" strokeDasharray="4 4" strokeOpacity={0.5} label={{ position: 'insideTopLeft', value: `Mean ${stats.mean.toFixed(2)} ¢/kWh`, fill: '#fcd34d', fontSize: 10 }} />}
                    {stats && showMedian && <ReferenceLine y={stats.median} stroke="#f87171" strokeDasharray="4 4" strokeOpacity={0.5} label={{ position: 'insideTopLeft', value: `Median ${stats.median.toFixed(2)} ¢/kWh`, fill: '#f87171', fontSize: 10 }} />}
                    {stats && showP75 && <ReferenceLine y={stats.p75} stroke="#c084fc" strokeDasharray="4 4" strokeOpacity={0.5} label={{ position: 'insideTopLeft', value: `75th Pctl ${stats.p75.toFixed(2)} ¢/kWh`, fill: '#c084fc', fontSize: 10 }} />}
                    {stats && showP90 && <ReferenceLine y={stats.p90} stroke="#f472b6" strokeDasharray="4 4" strokeOpacity={0.5} label={{ position: 'insideTopLeft', value: `90th Pctl ${stats.p90.toFixed(2)} ¢/kWh`, fill: '#f472b6', fontSize: 10 }} />}
                    {stats && showP95 && <ReferenceLine y={stats.p95} stroke="#fb923c" strokeDasharray="4 4" strokeOpacity={0.5} label={{ position: 'insideTopLeft', value: `95th Pctl ${stats.p95.toFixed(2)} ¢/kWh`, fill: '#fb923c', fontSize: 10 }} />}

                    <Area
                        type="monotone"
                        dataKey="knownPrice"
                        stroke="url(#colorPast)"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorPast)"
                        isAnimationActive={true}
                        activeDot={{ r: 6, fill: '#22c55e', stroke: '#fff', strokeWidth: 2, className: 'animate-pulse drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]' }}
                    />
                    <Area
                        type="monotone"
                        dataKey="predictedPrice"
                        stroke="#a855f7"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        fillOpacity={1}
                        fill="url(#colorFuture)"
                        isAnimationActive={true}
                        activeDot={{ r: 6, fill: '#a855f7', stroke: '#fff', strokeWidth: 2, className: 'animate-pulse drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]' }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
