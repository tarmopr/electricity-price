"use client";

import { useEffect, useMemo, useState } from 'react';
import { usePersistedState } from '@/lib/usePersistedState';
import { getPricesWithPrediction } from '@/lib/api';
import { applyVat } from '@/lib/price';
import { computeRollingWindow, SLOT_MS } from '@/lib/cheapestWindow';
import { DEFAULT_PRESET } from '@/lib/costCalculator';
import { floorToHour, getEndOfTomorrowTallinn, isValidHHMM } from '@/lib/timezone';
import type { ElectricityPrice } from '@/lib/api';

/** Same cadence as the dashboard price refresh. */
const REFRESH_MS = 15 * 60 * 1000;
/** Skip the on-visible refetch if the last successful load is newer than this. */
const VISIBILITY_REFETCH_MIN_MS = 60 * 1000;
/** How often to check whether "now" has entered a new 15-minute slot. */
const NOW_TICK_MS = 60 * 1000;

/** Floor an instant to its 15-minute slot start (the window search resolution). */
function toSlotMs(ms: number): number {
    return Math.floor(ms / SLOT_MS) * SLOT_MS;
}
/**
 * The legacy default "until" hour. usePersistedState wrote the default back on
 * hydrate, so almost every returning user has it stored without ever choosing it.
 */
const LEGACY_DEFAULT_UNTIL = 22;

const STORAGE_PREFIX = 'eprice_';
const READY_BY_KEY = `${STORAGE_PREFIX}costReadyBy`;
const LEGACY_UNTIL_KEY = `${STORAGE_PREFIX}costUntil`;

/**
 * One-time migration from the legacy integer "until hour" setting to the
 * "HH:MM" ready-by string. Only runs when no ready-by value has been stored yet.
 * Legacy null ("no limit") migrates to null; the untouched legacy default (22)
 * is skipped so the new 07:00 default applies.
 */
export function migrateLegacyReadyBy(storage: Pick<Storage, 'getItem' | 'setItem'>): void {
    try {
        if (storage.getItem(READY_BY_KEY) !== null) return;
        const legacy = storage.getItem(LEGACY_UNTIL_KEY);
        if (legacy === null) return;
        const hour = JSON.parse(legacy);
        if (hour === null) {
            storage.setItem(READY_BY_KEY, JSON.stringify(null));
            return;
        }
        if (typeof hour !== 'number' || !Number.isInteger(hour) || hour < 0 || hour > 23) return;
        if (hour === LEGACY_DEFAULT_UNTIL) return;
        storage.setItem(READY_BY_KEY, JSON.stringify(`${String(hour).padStart(2, '0')}:00`));
    } catch {
        // localStorage unavailable or invalid JSON — keep defaults
    }
}

/**
 * Cost calculator state + rolling-horizon cheapest window.
 *
 * Fetches its own prices (now → end of tomorrow, Tallinn) so the search is
 * independent of the chart period and night windows can cross midnight.
 */
export function useCostCalculator(includeVat: boolean) {
    // Must run before usePersistedState('costReadyBy') hydrates (effects run in declaration order)
    useEffect(() => {
        migrateLegacyReadyBy(window.localStorage);
    }, []);

    const [costConsumptionKwh, setCostConsumptionKwh] = usePersistedState<number>('costKwh', DEFAULT_PRESET.kWh);
    const [costDurationHours, setCostDurationHours] = usePersistedState<number>('costDuration', DEFAULT_PRESET.durationHours);
    const [storedReadyBy, setCostReadyBy] = usePersistedState<string | null>('costReadyBy', DEFAULT_PRESET.readyBy);
    const [costActivePreset, setCostActivePreset] = usePersistedState<string>('costPreset', DEFAULT_PRESET.label);
    const [costCalcOpen, setCostCalcOpen] = usePersistedState<boolean>('costCalcOpen', false);

    // Guard against malformed persisted values
    const costReadyBy = storedReadyBy === null || isValidHHMM(storedReadyBy) ? storedReadyBy : DEFAULT_PRESET.readyBy;

    const [horizonPrices, setHorizonPrices] = useState<ElectricityPrice[]>([]);
    // "Now" floored to the 15-min slot: changes at most every 15 minutes, so the
    // dashboard (and the Recharts animation) doesn't re-render on every tick.
    const [nowMs, setNowMs] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        // Only the latest request may update state: an older, slower response
        // must not overwrite newer data or move "now" backwards.
        let latestRequest = 0;

        // Slot last written to state. All nowMs writes go through advanceNow, so this
        // lets a same-slot tick skip setState entirely (not even a bail-out render).
        let currentSlot: number | null = null;
        // When the last successful load finished (throttles on-visible refetches)
        let lastSuccessMs: number | null = null;
        // True while the latest request is pending (on-visible must not stack another fetch)
        let inFlight = false;

        /** Advance "now" to the slot of `ms`; never backwards, no-op within the same slot. */
        function advanceNow(ms: number) {
            const slot = toSlotMs(ms);
            if (currentSlot !== null && slot <= currentSlot) return;
            currentSlot = slot;
            setNowMs(slot);
        }

        async function load() {
            const requestId = ++latestRequest;
            inFlight = true;
            const now = new Date();
            const isCurrent = () => !cancelled && requestId === latestRequest;
            try {
                // Fetch from the start of the current hour so hourly data still covers "now"
                const data = await getPricesWithPrediction(floorToHour(now), getEndOfTomorrowTallinn(now));
                if (!isCurrent()) return;
                lastSuccessMs = Date.now();
                setHorizonPrices(data);
                setError(null);
            } catch (err: unknown) {
                if (!isCurrent()) return;
                setError(err instanceof Error ? err.message : 'Failed to load prices');
            } finally {
                if (requestId === latestRequest) inFlight = false;
                if (isCurrent()) {
                    advanceNow(now.getTime());
                    setLoading(false);
                }
            }
        }

        // Phone tabs resumed hours later: refetch as soon as the tab is visible again.
        // Quick app switches skip the refetch (it pulls 8+ days of history for predictions),
        // but "now" is always advanced — cheap, and correct after a long sleep.
        function handleVisibility() {
            if (document.visibilityState !== 'visible') return;
            advanceNow(Date.now());
            if (inFlight) return;
            if (lastSuccessMs !== null && Date.now() - lastSuccessMs < VISIBILITY_REFETCH_MIN_MS) return;
            load();
        }

        load();
        const interval = setInterval(load, REFRESH_MS);
        const tick = setInterval(() => advanceNow(Date.now()), NOW_TICK_MS);
        document.addEventListener('visibilitychange', handleVisibility);
        return () => {
            cancelled = true;
            clearInterval(interval);
            clearInterval(tick);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, []);

    const points = useMemo(
        () => horizonPrices.map(p => ({
            timestamp: p.timestamp,
            displayPrice: includeVat ? applyVat(p.priceCentsKwh) : p.priceCentsKwh,
            isPredicted: p.isPredicted,
        })),
        [horizonPrices, includeVat]
    );

    const rolling = useMemo(() => {
        // nowMs is already slot-floored, so this only recomputes on a new slot or new inputs
        if (nowMs === null) return null;
        const now = new Date(nowMs);
        return computeRollingWindow(points, {
            now,
            durationHours: costDurationHours,
            readyBy: costReadyBy,
            // Exclusive end: predictions must not expand past the end of tomorrow
            horizonEndMs: getEndOfTomorrowTallinn(now).getTime() + 1,
        });
    }, [points, nowMs, costDurationHours, costReadyBy]);

    return {
        costConsumptionKwh, setCostConsumptionKwh,
        costDurationHours, setCostDurationHours,
        costReadyBy, setCostReadyBy,
        costActivePreset, setCostActivePreset,
        costCalcOpen, setCostCalcOpen,
        /** Recommended window — may finish after the ready-by time, see bestIgnoresDeadline */
        cheapestWindow: rolling?.best ?? null,
        bestIgnoresDeadline: rolling?.bestIgnoresDeadline ?? false,
        startingNowPrice: rolling?.startingNowPrice ?? null,
        horizonAvgPrice: rolling?.horizonAvgPrice ?? null,
        horizonMaxPrice: rolling?.horizonMaxPrice ?? null,
        isPredicted: rolling?.isPredicted ?? false,
        readyByLimitMs: rolling?.readyByLimit?.getTime() ?? null,
        startingNowEndMs: rolling?.startingNowEnd?.getTime() ?? null,
        costNowMs: nowMs,
        costLoading: loading,
        costError: error,
    };
}
