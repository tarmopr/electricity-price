'use client';

import { useState, useEffect, useMemo } from 'react';
import {
    Area,
    AreaChart,
    CartesianGrid,
    Line,
    ReferenceDot,
    ReferenceLine,
    ReferenceArea,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';
import { format, isSameHour } from 'date-fns';
import { ElectricityPrice, HourlyAveragePattern } from '@/lib/api';
import { applyVat } from '@/lib/price';
import { CheapestWindow } from '@/lib/cheapestWindow';
import { getTallinnHour } from '@/lib/timezone';

// ─── Sub-component interfaces ────────────────────────────────────────────────

interface TooltipPayloadItem {
    value: number;
    payload: {
        displayPrice: number;
        isPredicted?: boolean;
        timestamp: string;
    };
}

interface ReferenceLabelProps {
    viewBox?: { x: number; y: number };
    value?: string;
    fill?: string;
    orientation?: 'horizontal' | 'vertical';
    isHovering?: boolean;
}

interface MinMaxLabelProps {
    viewBox?: { x: number; y: number };
    value?: string;
    type: 'min' | 'max';
    isHovering?: boolean;
}

interface CustomTooltipProps {
    active?: boolean;
    payload?: readonly TooltipPayloadItem[];
    label?: string | number;
    stats: { mean: number; median: number; p75: number; p90: number; p95: number } | null;
}

// ─── Sub-components (defined outside PriceChart to prevent recreation on render) ─

const CustomTooltip = ({ active, payload, label, stats }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
        const date = new Date(label as string | number);
        const d = payload[0].payload;
        const isPredicted = d.isPredicted;

        // Compute median comparison badge
        let medianBadge: React.ReactNode = null;
        if (stats && stats.median > 0 && d.displayPrice != null) {
            const pctDiff = ((d.displayPrice - stats.median) / stats.median) * 100;
            const absPct = Math.abs(pctDiff).toFixed(0);
            if (pctDiff < 0) {
                medianBadge = (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300">
                        {absPct}% below median
                    </span>
                );
            } else if (pctDiff > 0) {
                medianBadge = (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300">
                        {absPct}% above median
                    </span>
                );
            }
        }

        return (
            <div className={`bg-zinc-900/90 border ${isPredicted ? 'border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.3)]' : 'border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.3)]'} p-3 rounded-xl backdrop-blur-xl transition-all duration-200`}>
                <p className="text-zinc-400 text-sm mb-1">
                    {format(date, 'MMM d, HH:mm')}
                    {isPredicted && <span className="ml-2 text-indigo-400 italic">(Predicted)</span>}
                </p>
                <p className={`font-bold text-lg ${isPredicted ? 'text-indigo-400' : 'text-emerald-400'}`}>
                    {d.displayPrice} <span className="text-xs font-normal text-zinc-500">¢/kWh</span>
                </p>
                {medianBadge && <div className="mt-1">{medianBadge}</div>}
            </div>
        );
    }
    return null;
};

// Custom pill-shaped label for reference lines (horizontal and vertical)
const ChartReferenceLabel = ({ viewBox, value, fill, orientation = 'horizontal', isHovering = false }: ReferenceLabelProps) => {
    if (!viewBox || !value || !fill) return null;

    const x = viewBox.x + (orientation === 'horizontal' ? 10 : 8);
    const y = orientation === 'horizontal'
        ? viewBox.y - 12  // slightly above the line
        : viewBox.y + 25; // below the line (avoids top edge cutoff)

    const opacity = isHovering ? 0.3 : 1;

    return (
        <g style={{ transition: 'opacity 0.3s ease-in-out', opacity }}>
            <rect
                x={x - 6}
                y={y - 14}
                width={value.length * 6.5 + 10}
                height={20}
                fill="#18181b"
                fillOpacity={0.8}
                stroke={fill}
                strokeOpacity={0.4}
                rx={10}
            />
            <text
                x={x}
                y={y}
                fill={fill}
                fontSize={10}
                fontWeight={600}
                opacity={0.9}
            >
                {value}
            </text>
        </g>
    );
};

// Custom inline label for min/max price annotations on the data line
const MinMaxLabel = ({ viewBox, value, type, isHovering = false }: MinMaxLabelProps) => {
    if (!viewBox || !value) return null;
    const isMax = type === 'max';
    const color = isMax ? '#f59e0b' : '#22d3ee';
    const bgColor = isMax ? '#451a03' : '#083344';
    const label = `${isMax ? '▲' : '▼'} ${value}`;
    // Position above for max, below for min
    const yOffset = isMax ? -20 : 18;
    const x = viewBox.x;
    const y = viewBox.y + yOffset;
    const textWidth = label.length * 6 + 14;

    const opacity = isHovering ? 0.2 : 1;

    return (
        <g style={{ transition: 'opacity 0.3s ease-in-out', opacity }}>
            <rect
                x={x - textWidth / 2}
                y={y - 11}
                width={textWidth}
                height={18}
                fill={bgColor}
                fillOpacity={0.9}
                stroke={color}
                strokeOpacity={0.5}
                rx={9}
            />
            <text
                x={x}
                y={y + 3}
                fill={color}
                fontSize={10}
                fontWeight={700}
                textAnchor="middle"
            >
                {label}
            </text>
        </g>
    );
};

// Custom Cursor for Tooltip (Glowing Band)
const CustomCursor = (props: { points?: Array<{ x: number }>; height?: number }) => {
    const { points, height } = props;
    if (!points || !points.length) return null;

    const { x } = points[0];
    const bandWidth = 40;

    return (
        <rect
            x={x - bandWidth / 2}
            y={0}
            width={bandWidth}
            height={height || 400}
            fill="url(#cursorGradient)"
            opacity={0.5}
        />
    );
};

// ─── Main component ──────────────────────────────────────────────────────────

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
    cheapestWindow: CheapestWindow | null;
    avg7dPattern: HourlyAveragePattern | null;
    avg30dPattern: HourlyAveragePattern | null;
    showAvg7d: boolean;
    showAvg30d: boolean;
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
    cheapestWindow,
    avg7dPattern,
    avg30dPattern,
    showAvg7d,
    showAvg30d
}: PriceChartProps) {
    const [mounted, setMounted] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    useEffect(() => setMounted(true), []);

    // Map cheapest window timestamps to actual chart data timestamps.
    // The cheapest window is computed from hourly-aggregated data, but the chart
    // may display higher-resolution data (e.g. 15-min intervals). Recharts'
    // categorical X axis requires exact string matches for ReferenceArea x1/x2.
    // This hook must be before early returns to satisfy Rules of Hooks.
    const cheapestRef = useMemo(() => {
        if (!cheapestWindow || !data || data.length === 0) return null;

        const startMs = new Date(cheapestWindow.startTimestamp).getTime();
        const endMs = new Date(cheapestWindow.endTimestamp).getTime();

        let x1: string | null = null;
        let x2: string | null = null;

        for (const d of data) {
            const t = new Date(d.timestamp).getTime();
            if (!x1 && t >= startMs) x1 = d.timestamp;
            if (!x2 && t >= endMs) x2 = d.timestamp;
            if (x1 && x2) break;
        }

        // If end timestamp is past chart data, use the last data point
        if (!x2 && data.length > 0) {
            x2 = data[data.length - 1].timestamp;
        }

        return x1 && x2 ? { x1, x2 } : null;
    }, [cheapestWindow, data]);

    if (!mounted) {
        return <div className="w-full h-[300px] sm:h-[400px] mt-4 relative bg-zinc-900/10 animate-pulse rounded-xl flex items-center justify-center text-zinc-600 border border-zinc-800/50">Loading chart...</div>;
    }

    if (!data || data.length === 0) return <div className="h-64 flex items-center justify-center text-zinc-500">No data available</div>;

    const now = new Date();

    // Use the explicit current price timestamp from API if available, otherwise fallback to local hour
    const activeCurrentTimestamp = currentPrice?.timestamp || data.find(item => isSameHour(item.date, now))?.timestamp;

    // Process data for the chart, including color coding for past vs future
    const chartData = data.map(item => {
        const price = includeVat ? applyVat(item.priceCentsKwh) : item.priceCentsKwh;
        const hour = getTallinnHour(item.date);

        // Look up hourly average patterns for overlay lines
        const raw7d = showAvg7d && avg7dPattern ? avg7dPattern.get(hour) ?? null : null;
        const raw30d = showAvg30d && avg30dPattern ? avg30dPattern.get(hour) ?? null : null;

        return {
            ...item,
            displayPrice: parseFloat(price.toFixed(2)),
            // For visual distinction
            knownPrice: !item.isPredicted ? parseFloat(price.toFixed(2)) : null,
            predictedPrice: item.isPredicted ? parseFloat(price.toFixed(2)) : null,
            avg7d: raw7d !== null ? parseFloat((includeVat ? applyVat(raw7d) : raw7d).toFixed(2)) : null,
            avg30d: raw30d !== null ? parseFloat((includeVat ? applyVat(raw30d) : raw30d).toFixed(2)) : null,
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

    const nowDisplayPrice = activeCurrentTimestamp
        ? chartData.find(d => d.timestamp === activeCurrentTimestamp)?.displayPrice ?? null
        : null;

    const gridOpacity = isHovering ? 0.1 : 0.4;
    const lineOpacity = isHovering ? 0.3 : 0.5;

    // Calculate a hard minimum instead of relying on Recharts 'dataMin'
    // to enforce re-rendering when VAT toggles but the underlying array length hasn't changed.
    const calculatedMin = chartData.length > 0
        ? Math.min(...chartData.map(d => d.displayPrice))
        : 0;

    // Find min and max price points for inline annotations.
    // Only consider known (non-predicted) prices to avoid annotating speculative values.
    // When multiple points share the same extreme value, pick the first occurrence.
    const knownChartData = chartData.filter(d => d.knownPrice !== null);
    const minPoint = knownChartData.length > 0
        ? knownChartData.reduce((min, d) => d.displayPrice < min.displayPrice ? d : min, knownChartData[0])
        : null;
    const maxPoint = knownChartData.length > 0
        ? knownChartData.reduce((max, d) => d.displayPrice > max.displayPrice ? d : max, knownChartData[0])
        : null;
    // Only show annotations when there is a meaningful price range
    const showMinMax = minPoint && maxPoint && minPoint.displayPrice !== maxPoint.displayPrice;

    return (
        <div
            className="w-full h-[300px] sm:h-[400px] mt-4 relative overflow-hidden"
            aria-label={
                minPoint && maxPoint
                    ? `Electricity price chart: prices range from ${minPoint.displayPrice} to ${maxPoint.displayPrice} cents per kWh`
                    : 'Electricity price chart'
            }
            role="img"
            style={{ WebkitTapHighlightColor: 'transparent' }}
        >
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} style={{ outline: 'none' }}>
                <AreaChart
                    data={chartData}
                    margin={{ top: 20, right: 10, left: -20, bottom: 0 }}
                    style={{ outline: 'none' }}
                    onMouseEnter={() => setIsHovering(true)}
                    onMouseLeave={() => setIsHovering(false)}
                    onTouchStart={() => setIsHovering(true)}
                    onTouchEnd={() => setIsHovering(false)}
                >
                    <defs>
                        {/* Glow Filter for the main Area stroke */}
                        <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="4" result="blur" />
                            <feMerge>
                                <feMergeNode in="blur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>

                        <linearGradient id="cursorGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.0} />
                            <stop offset="50%" stopColor="#ffffff" stopOpacity={0.05} />
                            <stop offset="100%" stopColor="#ffffff" stopOpacity={0.0} />
                        </linearGradient>

                        <linearGradient id="colorPast" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#0284c7" stopOpacity={0.4} /> {/* Sky Blue */}
                            <stop offset={`${Math.max(0, medianOffset - 0.15) * 100}%`} stopColor="#0d9488" stopOpacity={0.25} /> {/* Teal */}
                            <stop offset={`${medianOffset * 100}%`} stopColor="#10b981" stopOpacity={0.25} /> {/* Emerald */}
                            <stop offset={`${Math.min(1, medianOffset + 0.15) * 100}%`} stopColor="#059669" stopOpacity={0.25} />
                            <stop offset="100%" stopColor="#064e3b" stopOpacity={0.4} />
                        </linearGradient>
                        <linearGradient id="colorFuture" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} /> {/* Indigo */}
                            <stop offset="95%" stopColor="#4338ca" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#71717a" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#71717a" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" opacity={gridOpacity} style={{ transition: 'opacity 0.3s' }} />
                    <XAxis
                        dataKey="timestamp"
                        tickFormatter={(tick) => format(new Date(tick), xAxisFormat)}
                        stroke="#71717a"
                        tick={{ fill: '#71717a', fontSize: 12 }}
                        tickMargin={10}
                        minTickGap={minTickGap}
                        style={{ opacity: isHovering ? 0.6 : 1, transition: 'opacity 0.3s' }}
                    />
                    <YAxis
                        stroke="#71717a"
                        tick={{ fill: '#71717a', fontSize: 12 }}
                        tickFormatter={(val) => `${val}¢`}
                        domain={[calculatedMin, 'auto']}
                        allowDataOverflow={true}
                        style={{ opacity: isHovering ? 0.6 : 1, transition: 'opacity 0.3s' }}
                    />
                    <Tooltip
                        content={(props) => <CustomTooltip {...props} stats={stats} />}
                        cursor={<CustomCursor />}
                        isAnimationActive={true}
                        animationDuration={200}
                    />

                    {/* Cheapest Window Reference Area */}
                    {cheapestWindow && cheapestRef && (
                        <ReferenceArea
                            x1={cheapestRef.x1}
                            x2={cheapestRef.x2}
                            fill="#86efac" // subtle green fill
                            fillOpacity={0.15}
                            strokeOpacity={0}
                            label={{
                                value: `Cheapest ${cheapestWindow.hours}h: ${cheapestWindow.averagePrice.toFixed(2)} ¢/kWh`,
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
                            stroke="#38bdf8" // bright blue
                            strokeDasharray="3 3"
                            strokeOpacity={lineOpacity}
                            style={{ transition: 'opacity 0.3s' }}
                            label={<ChartReferenceLabel orientation="vertical" value={nowDisplayPrice !== null ? `Now ${nowDisplayPrice} ¢` : 'Now'} fill="#38bdf8" isHovering={isHovering} />}
                        />
                    )}

                    {/* Statistical Reference Lines */}
                    {stats && showMean && <ReferenceLine y={stats.mean} stroke="#fde047" strokeDasharray="4 4" strokeOpacity={lineOpacity} style={{ transition: 'opacity 0.3s' }} label={<ChartReferenceLabel value={`Mean ${stats.mean.toFixed(2)} ¢`} fill="#fde047" isHovering={isHovering} />} />}
                    {stats && showMedian && <ReferenceLine y={stats.median} stroke="#f43f5e" strokeDasharray="4 4" strokeOpacity={lineOpacity} style={{ transition: 'opacity 0.3s' }} label={<ChartReferenceLabel value={`Median ${stats.median.toFixed(2)} ¢`} fill="#f43f5e" isHovering={isHovering} />} />}
                    {stats && showP75 && <ReferenceLine y={stats.p75} stroke="#a78bfa" strokeDasharray="4 4" strokeOpacity={lineOpacity} style={{ transition: 'opacity 0.3s' }} label={<ChartReferenceLabel value={`75th ${stats.p75.toFixed(2)} ¢`} fill="#a78bfa" isHovering={isHovering} />} />}
                    {stats && showP90 && <ReferenceLine y={stats.p90} stroke="#f472b6" strokeDasharray="4 4" strokeOpacity={lineOpacity} style={{ transition: 'opacity 0.3s' }} label={<ChartReferenceLabel value={`90th ${stats.p90.toFixed(2)} ¢`} fill="#f472b6" isHovering={isHovering} />} />}
                    {stats && showP95 && <ReferenceLine y={stats.p95} stroke="#fb923c" strokeDasharray="4 4" strokeOpacity={lineOpacity} style={{ transition: 'opacity 0.3s' }} label={<ChartReferenceLabel value={`95th ${stats.p95.toFixed(2)} ¢`} fill="#fb923c" isHovering={isHovering} />} />}

                    <Area
                        type="monotone"
                        dataKey="knownPrice"
                        stroke="url(#colorPast)"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorPast)"
                        isAnimationActive={true}
                        filter="url(#neonGlow)"
                        activeDot={{ r: 6, fill: '#10b981', stroke: '#fff', strokeWidth: 2, className: 'animate-pulse drop-shadow-[0_0_12px_rgba(16,185,129,1)]' }}
                    />
                    <Area
                        type="monotone"
                        dataKey="predictedPrice"
                        stroke="#6366f1"
                        strokeWidth={3}
                        strokeDasharray="4 4"
                        fillOpacity={1}
                        fill="url(#colorFuture)"
                        isAnimationActive={true}
                        filter="url(#neonGlow)"
                        activeDot={{ r: 6, fill: '#6366f1', stroke: '#fff', strokeWidth: 2, className: 'animate-pulse drop-shadow-[0_0_12px_rgba(99,102,241,1)]' }}
                    />

                    {/* Historical Average Overlay Lines */}
                    {showAvg7d && avg7dPattern && (
                        <Line
                            type="monotone"
                            dataKey="avg7d"
                            stroke="#2dd4bf"
                            strokeWidth={2}
                            strokeDasharray="6 3"
                            dot={false}
                            strokeOpacity={0.6}
                            isAnimationActive={true}
                            name="7-Day Avg"
                            connectNulls={false}
                        />
                    )}
                    {showAvg30d && avg30dPattern && (
                        <Line
                            type="monotone"
                            dataKey="avg30d"
                            stroke="#22d3ee"
                            strokeWidth={2}
                            strokeDasharray="6 3"
                            dot={false}
                            strokeOpacity={0.6}
                            isAnimationActive={true}
                            name="30-Day Avg"
                            connectNulls={false}
                        />
                    )}

                    {/* Min/Max Price Annotations */}
                    {showMinMax && minPoint && (
                        <ReferenceDot
                            x={minPoint.timestamp}
                            y={minPoint.displayPrice}
                            r={4}
                            fill="#22d3ee"
                            stroke="#083344"
                            strokeWidth={2}
                            label={<MinMaxLabel type="min" value={`${minPoint.displayPrice} ¢`} isHovering={isHovering} />}
                        />
                    )}
                    {showMinMax && maxPoint && (
                        <ReferenceDot
                            x={maxPoint.timestamp}
                            y={maxPoint.displayPrice}
                            r={4}
                            fill="#f59e0b"
                            stroke="#451a03"
                            strokeWidth={2}
                            label={<MinMaxLabel type="max" value={`${maxPoint.displayPrice} ¢`} isHovering={isHovering} />}
                        />
                    )}
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
