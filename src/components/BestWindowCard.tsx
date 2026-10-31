import React from 'react';
import { AlertTriangle, BatteryCharging, ChevronRight, Clock } from 'lucide-react';
import { CheapestWindow } from '@/lib/cheapestWindow';
import { calcCostEur, MIN_SAVINGS_EUR } from '@/lib/costCalculator';
import { formatDuration, formatNumber, snapDurationHours } from '@/lib/numericInput';
import { formatTallinnDeadline, formatTallinnRange } from '@/lib/timezone';

interface BestWindowCardProps {
    /** Label of the active preset (or "Custom") */
    presetLabel: string;
    window: CheapestWindow | null;
    consumptionKwh: number;
    durationHours: number;
    /** Average price (¢/kWh) of a same-length window starting now */
    startingNowPrice: number | null;
    readyBy: string | null;
    /** Resolved ready-by deadline (may be the following day's occurrence) */
    readyByLimitMs?: number | null;
    /** When a same-length window starting now would finish (for the no-fit hint) */
    startingNowEndMs?: number | null;
    isPredicted: boolean;
    loading: boolean;
    /** Price fetch error, if the latest load failed */
    error?: string | null;
    /** Reference "now" used for day labels (Today / Tomorrow) */
    nowMs: number | null;
    onOpen: () => void;
}

const CARD =
    'group block w-full text-left p-4 lg:px-6 lg:py-4 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-zinc-900/60 to-zinc-950/70 border border-emerald-500/20 hover:border-emerald-400/40 backdrop-blur-2xl shadow-xl hover:shadow-[0_0_30px_rgba(16,185,129,0.15)] transition-all duration-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50';

function BestWindowCard({
    presetLabel,
    window,
    consumptionKwh,
    durationHours,
    startingNowPrice,
    readyBy,
    readyByLimitMs = null,
    startingNowEndMs = null,
    isPredicted,
    loading,
    error = null,
    nowMs,
    onOpen,
}: BestWindowCardProps) {
    // nowMs is set once the first load completes; fall back to the window start for day labels
    const now = new Date(nowMs ?? (window ? new Date(window.startTimestamp).getTime() : 0));
    const deadlineLabel =
        readyBy && readyByLimitMs !== null && nowMs !== null
            ? formatTallinnDeadline(new Date(readyByLimitMs), now)
            : readyBy;
    const readyByHint = deadlineLabel ? `Ready by ${deadlineLabel}` : 'No deadline';
    const heading = `Best time · ${presetLabel}`;
    const searchedDuration = formatDuration(snapDurationHours(durationHours));

    let body: React.ReactNode;
    if (loading && !window) {
        body = (
            <span className="flex items-center gap-3" aria-label="Finding the best window">
                <span className="block h-5 w-40 bg-zinc-800/80 rounded animate-pulse" />
                <span className="block h-5 w-16 bg-zinc-800/80 rounded animate-pulse" />
            </span>
        );
    } else if (!window && error) {
        body = (
            <span className="flex items-center gap-2 text-sm text-red-300" role="alert">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Couldn&apos;t load prices. Please try again in a moment.
            </span>
        );
    } else if (!window) {
        const finishLabel =
            deadlineLabel && startingNowEndMs !== null && nowMs !== null
                ? formatTallinnDeadline(new Date(startingNowEndMs), now)
                : null;
        body = (
            <span className="block text-sm text-zinc-400">
                No {searchedDuration} window fits
                {deadlineLabel ? ` before ${deadlineLabel}` : ' in the available prices'}
                {finishLabel ? ` — starting now finishes ${finishLabel}.` : '. Tap to adjust.'}
            </span>
        );
    } else {
        const range = formatTallinnRange(new Date(window.startTimestamp), new Date(window.endTimestamp), now);
        const cost = calcCostEur(window.averagePrice, consumptionKwh);
        const savings = startingNowPrice !== null
            ? calcCostEur(startingNowPrice, consumptionKwh) - cost
            : null;

        body = (
            <span className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-6">
                <span className="block min-w-0">
                    <span className="block text-lg lg:text-xl font-bold text-white tracking-tight tabular-nums">
                        {range}
                    </span>
                    <span className="block text-xs text-zinc-500 mt-0.5">
                        {formatDuration(window.hours)} · {formatNumber(consumptionKwh)} kWh
                    </span>
                </span>
                <span className="flex items-baseline gap-4 shrink-0">
                    <span className="block">
                        <span className="text-xl font-bold text-emerald-400 tabular-nums">€{cost.toFixed(2)}</span>
                        <span className="ml-1.5 text-xs text-zinc-500 tabular-nums">{window.averagePrice.toFixed(2)} ¢/kWh</span>
                    </span>
                    {savings !== null && savings > MIN_SAVINGS_EUR && (
                        <span className="text-xs font-medium text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5 whitespace-nowrap">
                            Save €{savings.toFixed(2)} vs now
                        </span>
                    )}
                </span>
            </span>
        );
    }

    return (
        <button type="button" onClick={onOpen} className={CARD}>
            <span className="flex items-center justify-between gap-2 mb-2">
                <span className="flex items-center gap-2 min-w-0">
                    <BatteryCharging className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-xs lg:text-sm font-medium tracking-wide uppercase text-zinc-400 truncate">
                        {heading}
                    </span>
                    {window && isPredicted && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-300 bg-indigo-500/15 border border-indigo-400/30 rounded-full px-2 py-0.5 shrink-0">
                            Predicted
                        </span>
                    )}
                </span>
                <span className="flex items-center gap-1 text-xs text-zinc-500 shrink-0">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{readyByHint}</span>
                    <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-emerald-400 transition-colors" />
                </span>
            </span>
            {body}
            <span className="sr-only">. Open cost calculator</span>
        </button>
    );
}

export default React.memo(BestWindowCard);
