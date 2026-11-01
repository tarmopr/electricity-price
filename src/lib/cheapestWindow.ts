/**
 * Cheapest window utilities.
 *
 * Finds the cheapest consecutive time window of a given duration on a rolling
 * horizon (now → end of tomorrow) at 15-minute resolution, optionally limited by
 * a "ready by" wall-clock deadline in Tallinn time. Also maps a window onto
 * heatmap hour cells and onto a chart's visible data range.
 */

import { getTallinnHour, getNextTallinnOccurrence, isValidHHMM } from '@/lib/timezone';

const HOUR_MS = 60 * 60 * 1000;
/** Length of one search slot (15 minutes). */
export const SLOT_MS = 15 * 60 * 1000;

export interface CheapestWindow {
  /** ISO timestamp of the first slot in the window */
  startTimestamp: string;
  /** ISO timestamp of the end of the last slot (exclusive; for ReferenceArea end) */
  endTimestamp: string;
  /** Hour of day (0-23) the window starts */
  startHour: number;
  /** Duration of the window in hours */
  hours: number;
  /** Average price (cents/kWh) across the window */
  averagePrice: number;
  /** Start index in the searched slot array (for computeRollingWindow: its internal horizon, not the caller's points) */
  startIndex: number;
  /** End index in the searched slot array (inclusive) */
  endIndex: number;
  /** True if any price in the window is a prediction (official prices not yet published) */
  isPredicted?: boolean;
}

/**
 * Get the set of "YYYY-MM-DD:HH" keys covered by a cheapest window.
 * Uses Europe/Tallinn timezone for consistency with heatmap cells.
 *
 * Generates keys directly from the window's start/end timestamps, so it does not
 * depend on the source price array or its indices. Every hour that overlaps the
 * window is included (windows may start/end on 15-minute boundaries).
 *
 * @param window - The cheapest window to extract hours from
 * @returns Set of "YYYY-MM-DD:HH" keys, or empty set if window is null
 */
export function getCheapestWindowHours(
  window: CheapestWindow | null
): Set<string> {
  const keys = new Set<string>();
  if (!window) return keys;

  const startMs = new Date(window.startTimestamp).getTime();
  let endMs = new Date(window.endTimestamp).getTime();
  if (!Number.isFinite(endMs) || endMs <= startMs) {
    endMs = startMs + window.hours * HOUR_MS;
  }

  // Tallinn offsets are whole hours, so flooring in UTC aligns with local hour cells
  for (let t = Math.floor(startMs / HOUR_MS) * HOUR_MS; t < endMs; t += HOUR_MS) {
    const date = new Date(t);
    const dateStr = date.toLocaleDateString("en-CA", {
      timeZone: "Europe/Tallinn",
    }); // YYYY-MM-DD
    const hour = getTallinnHour(date);

    keys.add(`${dateStr}:${hour}`);
  }

  return keys;
}

// ─── Chart range clipping ────────────────────────────────────────────────────

/**
 * Clip a cheapest window to the chart's data range and map it to chart x-categories.
 * Returns null when the window lies entirely outside the data (or collapses to one point),
 * so the ReferenceArea is not rendered. `clipped` is true when only part of the window
 * is visible (the chart hides the window label then, since its stats cover the full window).
 */
export function getVisibleWindowRange(
  window: CheapestWindow | null,
  data: { timestamp: string }[]
): { x1: string; x2: string; clipped: boolean } | null {
  if (!window || !data || data.length === 0) return null;

  const startMs = new Date(window.startTimestamp).getTime();
  const endMs = new Date(window.endTimestamp).getTime();
  const firstMs = new Date(data[0].timestamp).getTime();
  const lastMs = new Date(data[data.length - 1].timestamp).getTime();

  // Fully outside the chart range
  if (endMs <= firstMs || startMs > lastMs) return null;

  // x1: the bucket containing the window start (or the first point if it starts earlier)
  let x1 = data[0].timestamp;
  // x2: the first point at/after the window end (or the last point if it ends later)
  let x2 = data[data.length - 1].timestamp;
  let x2Found = false;
  for (const d of data) {
    const t = new Date(d.timestamp).getTime();
    if (t <= startMs) x1 = d.timestamp;
    if (!x2Found && t >= endMs) {
      x2 = d.timestamp;
      x2Found = true;
    }
  }

  if (x1 === x2) return null;
  // The data covers through the end of the last point's bucket, so a window ending exactly
  // at the data end (e.g. 22:00–24:00 with the last point at 23:45) is not "clipped".
  // Bucket length = smallest of the last (up to) 3 intervals, so a data hole right before
  // the last point doesn't inflate it. Not capped: aggregated 6/12/24 h buckets are valid.
  // A single point defaults to 15 min.
  let lastBucketMs = Infinity;
  for (let i = data.length - 1; i >= Math.max(1, data.length - 3); i--) {
    const gap = new Date(data[i].timestamp).getTime() - new Date(data[i - 1].timestamp).getTime();
    if (gap > 0 && gap < lastBucketMs) lastBucketMs = gap;
  }
  if (!Number.isFinite(lastBucketMs)) lastBucketMs = SLOT_MS;
  const dataEndMs = lastMs + lastBucketMs;
  // Clipped when part of the window lies outside the chart data
  const clipped = startMs < firstMs || (!x2Found && endMs > dataEndMs);
  return { x1, x2, clipped };
}

// ─── 15-minute rolling-horizon search ────────────────────────────────────────


/** Input point for slot normalization (hourly or 15-minute resolution). */
export interface SlotSourcePoint {
  timestamp: string;
  displayPrice: number;
  isPredicted?: boolean;
}

/** One 15-minute price slot. */
export interface PriceSlot {
  startMs: number;
  displayPrice: number;
  isPredicted: boolean;
}

/**
 * Normalize price points to contiguous 15-minute slots.
 *
 * Each point covers the time until the next point (capped at 1 hour, at least
 * 15 minutes), so hourly points expand to 4 equal slots and 15-minute points map
 * 1:1. The last point covers its native span. Gaps larger than an hour (missing
 * data) are left as holes.
 *
 * A point's native span is min(gap to previous, gap to next) — a missing neighbour
 * counts as the other gap (1 hour if the point is alone). Slots filled beyond the
 * native span are flagged as predicted: e.g. when 15-minute official prices are
 * followed by an unaligned hourly prediction, the in-between slots are not
 * official prices and must not be presented as such.
 *
 * @param endMs - Optional exclusive horizon end; slots starting at/after it are dropped
 */
export function normalizeTo15MinSlots(points: SlotSourcePoint[], endMs?: number): PriceSlot[] {
  const sorted = points
    .map((p) => ({
      t: new Date(p.timestamp).getTime(),
      price: p.displayPrice,
      predicted: !!p.isPredicted,
    }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.price))
    .sort((a, b) => a.t - b.t);

  const toSlots = (ms: number) => Math.min(4, Math.max(1, Math.round(ms / SLOT_MS)));
  const slotMap = new Map<number, PriceSlot>();

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const prevGap = i > 0 ? p.t - sorted[i - 1].t : null;
    const nextGap = i + 1 < sorted.length ? sorted[i + 1].t - p.t : null;
    const nativeGap = Math.min(prevGap ?? nextGap ?? HOUR_MS, nextGap ?? prevGap ?? HOUR_MS);
    const nativeSlots = toSlots(nativeGap);
    const coverSlots = nextGap !== null ? toSlots(nextGap) : nativeSlots;
    const firstSlot = Math.floor(p.t / SLOT_MS) * SLOT_MS;

    for (let k = 0; k < coverSlots; k++) {
      const startMs = firstSlot + k * SLOT_MS;
      if (endMs !== undefined && startMs >= endMs) break;
      // A point's own slot always wins over a fill expanded from an earlier point
      if (k === 0 || !slotMap.has(startMs)) {
        slotMap.set(startMs, {
          startMs,
          displayPrice: p.price,
          isPredicted: p.predicted || k >= nativeSlots,
        });
      }
    }
  }

  return Array.from(slotMap.values()).sort((a, b) => a.startMs - b.startMs);
}

/**
 * Find the cheapest run of `slotCount` contiguous 15-minute slots.
 *
 * @param slots - Sorted 15-minute slots (see normalizeTo15MinSlots)
 * @param slotCount - Window length in slots
 * @param scanFromMs - Window must start at or after this instant
 * @param endLimitMs - Window must END at or before this instant (null = no limit)
 */
export function findCheapestSlotWindow(
  slots: PriceSlot[],
  slotCount: number,
  scanFromMs: number,
  endLimitMs: number | null
): CheapestWindow | null {
  if (slots.length === 0 || slotCount <= 0) return null;

  const first = slots.findIndex((s) => s.startMs >= scanFromMs);
  if (first === -1) return null;

  // Prefix sums for O(1) window sums
  const prefix = new Array<number>(slots.length + 1);
  prefix[0] = 0;
  for (let i = 0; i < slots.length; i++) prefix[i + 1] = prefix[i] + slots[i].displayPrice;

  let minSum = Infinity;
  let minIndex = -1;

  for (let i = first; i + slotCount <= slots.length; i++) {
    const last = i + slotCount - 1;
    const windowEndMs = slots[last].startMs + SLOT_MS;
    // Slots are sorted, so every later window ends even later
    if (endLimitMs !== null && windowEndMs > endLimitMs) break;
    // Skip windows spanning a data gap
    if (slots[last].startMs - slots[i].startMs !== (slotCount - 1) * SLOT_MS) continue;

    const sum = prefix[last + 1] - prefix[i];
    // Epsilon guards against float noise from prefix differences; ties keep the earliest window
    if (sum < minSum - 1e-9) {
      minSum = sum;
      minIndex = i;
    }
  }

  if (minIndex === -1) return null;

  const endIndex = minIndex + slotCount - 1;
  const startMs = slots[minIndex].startMs;
  let isPredicted = false;
  for (let i = minIndex; i <= endIndex; i++) {
    if (slots[i].isPredicted) {
      isPredicted = true;
      break;
    }
  }

  return {
    startTimestamp: new Date(startMs).toISOString(),
    endTimestamp: new Date(slots[endIndex].startMs + SLOT_MS).toISOString(),
    startHour: getTallinnHour(new Date(startMs)),
    hours: slotCount / 4,
    averagePrice: minSum / slotCount,
    startIndex: minIndex,
    endIndex,
    isPredicted,
  };
}

export interface RollingWindowOptions {
  /** Current instant; the horizon starts at now floored to 15 minutes */
  now: Date;
  /** Requested window length in hours (rounded to the nearest 15 minutes) */
  durationHours: number;
  /** "HH:MM" Tallinn wall-clock deadline, resolved via resolveReadyByLimit (may roll to the following day), or null for no limit */
  readyBy: string | null;
  /** Exclusive end of the horizon (e.g. end of tomorrow); slots beyond it are ignored */
  horizonEndMs?: number;
  /** Search official prices only: predicted slots are skipped and windows end where official prices end. Horizon stats still use every slot. */
  excludePredicted?: boolean;
}

export interface RollingWindowResult {
  /**
   * Best window to recommend: the cheapest one ending by the ready-by deadline or,
   * if none fits, the cheapest full-length window over the whole horizon
   * (see `bestIgnoresDeadline`). Null when no full-length window exists at all,
   * or when the duration is not positive.
   */
  best: CheapestWindow | null;
  /** True when `best` ignores the ready-by deadline because no window fits before it */
  bestIgnoresDeadline: boolean;
  /** Average price of a same-length window starting now (over the available slots; may be shorter near the horizon end or across data gaps) */
  startingNowPrice: number | null;
  /** Mean price across the whole horizon */
  horizonAvgPrice: number | null;
  /** Max price across the whole horizon */
  horizonMaxPrice: number | null;
  /** True if any slot in the best window is predicted */
  isPredicted: boolean;
  /** Resolved "ready by" deadline instant, or null for no limit */
  readyByLimit: Date | null;
  /** True when the next occurrence was too soon for the duration and the following day's was used */
  readyByRolledOver: boolean;
  /** When a same-length window starting now (floored to 15 min) would finish, or null */
  startingNowEnd: Date | null;
  /** Where official prices end: start of the trailing run of predicted slots, or null when the horizon ends on an official slot */
  predictedFrom: Date | null;
}

/**
 * Resolve the "ready by" deadline: the next Tallinn occurrence of `readyBy` after now.
 *
 * Only when that occurrence is less than HALF the duration away (e.g. 06:30 with
 * "07:00" and 8 h) is the following day's occurrence used — the user can't mean
 * "in 30 minutes". Otherwise the near deadline is kept even if the full duration
 * doesn't fit (e.g. 23:30, 8 h, ready by 07:00): rolling over there would push the
 * deadline past the horizon, silently drop the constraint and present a daytime
 * window as if it met the user's deadline. Keeping it lets computeRollingWindow
 * fall back to the best full-length window with `bestIgnoresDeadline` set, so the
 * UI recommends it with an explicit "finishes after 07:00" warning.
 * DST-safe: each occurrence is resolved from the Tallinn wall clock.
 */
export function resolveReadyByLimit(
  readyBy: string | null,
  now: Date,
  durationHours: number
): { limit: Date | null; rolledOver: boolean } {
  if (readyBy === null || !isValidHHMM(readyBy)) return { limit: null, rolledOver: false };
  const next = getNextTallinnOccurrence(readyBy, now);
  const durationMs = Math.max(1, Math.round(durationHours * 4)) * SLOT_MS;
  if (durationHours > 0 && next.getTime() - now.getTime() < durationMs / 2) {
    return { limit: getNextTallinnOccurrence(readyBy, next), rolledOver: true };
  }
  return { limit: next, rolledOver: false };
}

/**
 * Rolling-horizon cheapest window: scans from now (floored to 15 min) through the
 * supplied data up to `horizonEndMs`, independent of the chart period, so windows can cross midnight.
 * With `excludePredicted`, the window search (not the horizon stats) uses official slots only
 * and windows end where official prices end (`predictedFrom`).
 */
export function computeRollingWindow(
  points: SlotSourcePoint[],
  { now, durationHours, readyBy, horizonEndMs, excludePredicted = false }: RollingWindowOptions
): RollingWindowResult {
  const nowFloorMs = Math.floor(now.getTime() / SLOT_MS) * SLOT_MS;
  const horizon = normalizeTo15MinSlots(points, horizonEndMs).filter((s) => s.startMs >= nowFloorMs);
  // Official prices end where the trailing run of predicted slots starts. A predicted
  // fill inside official data (one missing 15-min point) does not end them.
  let trailingStart = horizon.length;
  while (trailingStart > 0 && horizon[trailingStart - 1].isPredicted) trailingStart--;
  const predictedFrom = trailingStart < horizon.length ? new Date(horizon[trailingStart].startMs) : null;
  // Predictions excluded: the search (not the horizon stats) uses official slots only;
  // a skipped fill is a hole that findCheapestSlotWindow never spans
  const searchSlots = excludePredicted
    ? horizon.slice(0, trailingStart).filter((s) => !s.isPredicted)
    : horizon;
  const { limit: readyByLimit, rolledOver: readyByRolledOver } = resolveReadyByLimit(
    readyBy,
    now,
    durationHours
  );

  const empty: RollingWindowResult = {
    best: null,
    bestIgnoresDeadline: false,
    startingNowPrice: null,
    horizonAvgPrice: null,
    horizonMaxPrice: null,
    isPredicted: false,
    readyByLimit,
    readyByRolledOver,
    startingNowEnd: null,
    predictedFrom,
  };
  if (horizon.length === 0) return empty;

  let sum = 0;
  let max = -Infinity;
  for (const s of horizon) {
    sum += s.displayPrice;
    if (s.displayPrice > max) max = s.displayPrice;
  }
  const result: RollingWindowResult = {
    ...empty,
    horizonAvgPrice: sum / horizon.length,
    horizonMaxPrice: max,
  };

  if (!(durationHours > 0)) return result;
  const slotCount = Math.max(1, Math.round(durationHours * 4));

  // "Starting now": same-length window from now floored to 15 min (averages available slots)
  const nowEndMs = nowFloorMs + slotCount * SLOT_MS;
  result.startingNowEnd = new Date(nowEndMs);
  let nowSum = 0;
  let nowCount = 0;
  for (const s of horizon) {
    if (s.startMs >= nowEndMs) break;
    nowSum += s.displayPrice;
    nowCount++;
  }
  result.startingNowPrice = nowCount > 0 ? nowSum / nowCount : null;

  let best = findCheapestSlotWindow(
    searchSlots,
    slotCount,
    nowFloorMs,
    readyByLimit ? readyByLimit.getTime() : null
  );
  // Nothing fits before the deadline (e.g. 00:16, 8 h, ready by 07:00): still recommend
  // the cheapest full-length window rather than nothing — the UI flags that it finishes late.
  if (best === null && readyByLimit !== null) {
    best = findCheapestSlotWindow(searchSlots, slotCount, nowFloorMs, null);
    result.bestIgnoresDeadline = best !== null;
  }
  result.best = best;
  result.isPredicted = best?.isPredicted ?? false;
  return result;
}
