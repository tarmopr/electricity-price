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
                            <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorFuture" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" opacity={0.4} />
                    <XAxis
                        dataKey="timestamp"
                        tickFormatter={(tick) => format(new Date(tick), 'HH:mm')}
                        stroke="#71717a"
                        tick={{ fill: '#71717a', fontSize: 12 }}
                        tickMargin={10}
                        minTickGap={30}
                    />
                    <YAxis
                        stroke="#71717a"
                        tick={{ fill: '#71717a', fontSize: 12 }}
                        tickFormatter={(val) => `${val}¢`}
                    />
                    <Tooltip content={<CustomTooltip />} />

                    {/* Statistical Reference Lines */}
                    {stats && showMean && <ReferenceLine y={stats.mean} stroke="#fcd34d" strokeDasharray="4 4" label={{ position: 'insideTopLeft', value: 'Mean', fill: '#fcd34d', fontSize: 10 }} />}
                    {stats && showMedian && <ReferenceLine y={stats.median} stroke="#f87171" strokeDasharray="4 4" label={{ position: 'insideTopLeft', value: 'Median', fill: '#f87171', fontSize: 10 }} />}
                    {stats && showP75 && <ReferenceLine y={stats.p75} stroke="#c084fc" strokeDasharray="4 4" label={{ position: 'insideTopLeft', value: '75th Pctl', fill: '#c084fc', fontSize: 10 }} />}
                    {stats && showP90 && <ReferenceLine y={stats.p90} stroke="#f472b6" strokeDasharray="4 4" label={{ position: 'insideTopLeft', value: '90th Pctl', fill: '#f472b6', fontSize: 10 }} />}
                    {stats && showP95 && <ReferenceLine y={stats.p95} stroke="#fb923c" strokeDasharray="4 4" label={{ position: 'insideTopLeft', value: '95th Pctl', fill: '#fb923c', fontSize: 10 }} />}

                    <Area
                        type="monotone"
                        dataKey="pastPrice"
                        stroke="#4ade80"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorPast)"
                        isAnimationActive={true}
                    />
                    <Area
                        type="monotone"
                        dataKey="futurePrice"
                        stroke="#818cf8"
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
