'use client';

import { useState, useEffect } from 'react';
import {
    Area,
    AreaChart,
    CartesianGrid,
    ReferenceLine,
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
    stats
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; payload: any }>; label?: string | number }) => {
        if (active && payload && payload.length) {
            const date = new Date(label as string | number);
            const data = payload[0].payload;
            const isPredicted = data.isPredicted;

            return (
                <div className="bg-zinc-900 border border-zinc-700/50 p-3 rounded-lg shadow-xl backdrop-blur-md">
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
                    <Tooltip content={<CustomTooltip />} />

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
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
