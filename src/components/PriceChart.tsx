'use client';

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
import { format, isBefore, isSameHour } from 'date-fns';
import { ElectricityPrice } from '@/lib/api';

interface PriceChartProps {
    data: ElectricityPrice[];
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
    includeVat,
    showNow,
    showMean,
    showMedian,
    showP75,
    showP90,
    showP95,
    stats
}: PriceChartProps) {
    if (!data || data.length === 0) return <div className="h-64 flex items-center justify-center text-zinc-500">No data available</div>;

    const now = new Date();

    // Process data for the chart, including color coding for past vs future
    const chartData = data.map(item => {
        const price = includeVat ? item.priceCentsKwh * 1.22 : item.priceCentsKwh;
        const isPast = isBefore(item.date, now) && !isSameHour(item.date, now);
        const isCurrent = isSameHour(item.date, now);

        return {
            ...item,
            displayPrice: parseFloat(price.toFixed(2)),
            // For visual distinction
            pastPrice: isPast || isCurrent ? parseFloat(price.toFixed(2)) : null,
            futurePrice: !isPast ? parseFloat(price.toFixed(2)) : null,
        };
    });

    const currentItem = chartData.find(item => isSameHour(item.date, now));
    const currentTimestamp = currentItem?.timestamp;

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

    // Calculate gradient offsets for pastPrice based on Median
    let medianOffset = 0.5;
    if (chartData.length > 0 && stats) {
        const pastPrices = chartData.map(d => d.pastPrice).filter((p): p is number => p !== null);
        if (pastPrices.length > 0) {
            const dataMax = Math.max(...pastPrices);
            const dataMin = Math.min(...pastPrices);

            if (dataMax > dataMin) {
                // Median position relative to min and max. 0 is bottom (min), 1 is top (max).
                // Gradients go top-to-bottom, so y=0 is top (max), y=1 is bottom (min).
                medianOffset = (dataMax - stats.median) / (dataMax - dataMin);
                medianOffset = Math.max(0, Math.min(1, medianOffset)); // Clamp
            }
        }
    }

    const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string | number }) => {
        if (active && payload && payload.length) {
            const date = new Date(label as string | number);
            return (
                <div className="bg-zinc-900 border border-zinc-700/50 p-3 rounded-lg shadow-xl backdrop-blur-md">
                    <p className="text-zinc-400 text-sm mb-1">{format(date, 'MMM d, HH:mm')}</p>
                    <p className="text-green-400 font-bold text-lg">
                        {payload[0].value} <span className="text-xs font-normal text-zinc-500">¢/kWh</span>
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="w-full h-[400px] mt-4 relative">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                    <defs>
                        <linearGradient id="colorPast" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.6} />
                            <stop offset={`${medianOffset * 100}%`} stopColor="#3b82f6" stopOpacity={0.6} />
                            <stop offset="100%" stopColor="#22c55e" stopOpacity={0.6} />
                        </linearGradient>
                        <linearGradient id="colorFuture" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
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
                        dataKey="pastPrice"
                        stroke="url(#colorPast)"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorPast)"
                        isAnimationActive={true}
                    />
                    <Area
                        type="monotone"
                        dataKey="futurePrice"
                        stroke="#a855f7"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        fillOpacity={1}
                        fill="url(#colorFuture)"
                        isAnimationActive={true}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
