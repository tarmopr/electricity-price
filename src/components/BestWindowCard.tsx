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
    /** When a same-length window starting now would finish (for the "starting now finishes …" line in the finishes-after-deadline warning) */
    startingNowEndMs?: number | null;
    /** True when `window` finishes after the ready-by time because nothing fits before it */
    ignoresDeadline?: boolean;
    isPredicted: boolean;
    loading: boolean;
    /** Price fetch error, if the latest load failed */
    error?: string | null;
    /** True when the price load succeeded but returned no prices for the horizon */
    noData?: boolean;
    /** Reference "now" used for day labels (Today / Tomorrow) */
    nowMs: number | null;
    onOpen: () => void;
}

const PREDICTED_BADGE =
    'items-center text-[10px] font-semibold uppercase tracking-wider text-indigo-300 bg-indigo-500/15 border border-indigo-400/30 rounded-full px-2 py-0.5';

const LOAD_FAILED = "Couldn't load prices — retrying automatically.";
const STALE_DATA = "Couldn't refresh prices — showing the last loaded data.";

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
    ignoresDeadline = false,
    isPredicted,
    loading,
    error = null,
    noData = false,
    nowMs,
    onOpen,
}: BestWindowCardProps) {
    // nowMs is null until the hook's first slot tick; the window-start fallback is defensive
    // (the hook never yields a window without nowMs)
    const now = new Date(nowMs ?? (window ? new Date(window.startTimestamp).getTime() : 0));
    const deadlineLabel =
        readyBy && readyByLimitMs !== null && nowMs !== null
            ? formatTallinnDeadline(new Date(readyByLimitMs), now)
            : readyBy;
    const searchedDuration = formatDuration(window?.hours ?? snapDurationHours(durationHours));
    const finishLabel =
        deadlineLabel && startingNowEndMs !== null && nowMs !== null
            ? formatTallinnDeadline(new Date(startingNowEndMs), now)
            : null;

    let body: React.ReactNode;
    // Announced from a live region outside the button: content inside a button is
    // flattened into its accessible name and not announced on change.
    let liveAlert: string | null = null;
    let liveStatus: string | null = null;
    // While a retry is in flight keep showing the error (no error → skeleton → error flicker)
    if (loading && !window && !error) {
        body = (
            <span className="flex items-center gap-3" aria-label="Finding the best window">
                <span className="block h-5 w-40 bg-zinc-800/80 rounded animate-pulse" />
                <span className="block h-5 w-16 bg-zinc-800/80 rounded animate-pulse" />
            </span>
        );
    } else if (!window && error) {
        body = (
            <span className="flex items-center gap-2 text-sm text-red-300">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {LOAD_FAILED}
            </span>
        );
        liveAlert = LOAD_FAILED;
    } else if (!window && noData) {
        body = (
            <span className="block text-sm text-zinc-400">
                No price data available yet — retrying automatically.
            </span>
        );
    } else if (!window) {
        // The hook already falls back to a window ignoring the deadline, so a null window
        // means no full-length window exists in the loaded prices at all (e.g. a data gap).
        body = (
            <span className="block text-sm text-zinc-400">
                No {searchedDuration} window fits in the available prices. Tap to adjust.
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
                        {isPredicted && (
                            // Mobile copy of the header badge (header is too narrow on phones)
                            <span className={`${PREDICTED_BADGE} ml-2 inline-flex sm:hidden`}>Predicted</span>
                        )}
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
        if (error) {
            // A refresh failed after an earlier load: the window above is from stale prices
            body = (
                <>
                    {body}
                    <span className="mt-2 flex items-center gap-2 text-xs text-amber-200">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                        {STALE_DATA}
                    </span>
                </>
            );
            liveStatus = STALE_DATA;
        }
        if (ignoresDeadline && deadlineLabel) {
            body = (
                <>
                    {body}
                    <span className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                        <span className="block">
                            <span className="block font-medium">
                                Finishes after {deadlineLabel} — no {searchedDuration} window fits before your ready-by time
                            </span>
                            {finishLabel && (
                                <span className="block text-amber-200/70">Starting now finishes {finishLabel}</span>
                            )}
                        </span>
                    </span>
                </>
            );
        }
    }

    return (
        <>
        {liveAlert && <span role="alert" className="sr-only">{liveAlert}</span>}
        {liveStatus && <span role="status" className="sr-only">{liveStatus}</span>}
        <button type="button" onClick={onOpen} className={CARD}>
            <span className="flex items-center justify-between gap-2 mb-2">
                <span className="flex items-center gap-2 min-w-0">
                    <BatteryCharging className="w-4 h-4 text-emerald-400 shrink-0" />
                    {/* On phones the preset name comes first; "Best time ·" only from sm up */}
                    <span className="text-xs lg:text-sm font-medium tracking-wide uppercase text-zinc-400 min-w-0 sm:truncate">
                        <span className="hidden sm:inline">Best time ·</span>{' '}{presetLabel}
                    </span>
                    {window && isPredicted && (
                        <span className={`${PREDICTED_BADGE} shrink-0 hidden sm:inline-flex`}>Predicted</span>
                    )}
                </span>
                <span className="flex items-center gap-1 text-xs text-zinc-500 shrink-0">
                    <Clock className="w-3.5 h-3.5" />
                    {deadlineLabel ? (
                        <span>
                            {/* Visible from sm up; screen-reader-only on phones */}
                            <span className="sr-only sm:not-sr-only">Ready by</span>{' '}{deadlineLabel}
                        </span>
                    ) : (
                        <span>No deadline</span>
                    )}
                    <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-emerald-400 transition-colors" />
                </span>
            </span>
            {body}
            <span className="sr-only">. Open cost calculator</span>
        </button>
        </>
    );
}

export default React.memo(BestWindowCard);
