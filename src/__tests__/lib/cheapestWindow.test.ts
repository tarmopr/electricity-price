import { describe, it, expect } from "vitest";
import {
  getCheapestWindowHours,
  CheapestWindow,
  normalizeTo15MinSlots,
  findCheapestSlotWindow,
  computeRollingWindow,
  getVisibleWindowRange,
  resolveReadyByLimit,
  SLOT_MS,
} from "@/lib/cheapestWindow";

/**
 * Helper to create hourly price data starting at a given date/time.
 * Each entry is 1 hour apart.
 */
function makePrices(
  startDate: Date,
  pricesArray: number[]
): { timestamp: string; displayPrice: number }[] {
  return pricesArray.map((price, i) => {
    const ts = new Date(startDate.getTime() + i * 60 * 60 * 1000);
    return { timestamp: ts.toISOString(), displayPrice: price };
  });
}

describe("cheapestWindow", () => {
  describe("getCheapestWindowHours", () => {
    it("returns empty set when window is null", () => {
      const result = getCheapestWindowHours(null);
      expect(result.size).toBe(0);
    });

    it("returns correct number of keys for a window", () => {
      const start = new Date("2024-06-15T10:00:00Z");
      const prices = makePrices(start, [5, 3, 2, 8, 10]);

      const window: CheapestWindow = {
        startTimestamp: prices[1].timestamp,
        endTimestamp: prices[3].timestamp,
        startHour: 11,
        hours: 2,
        averagePrice: 2.5,
        startIndex: 1,
        endIndex: 2,
      };

      const result = getCheapestWindowHours(window);
      expect(result.size).toBe(2);
    });

    it("generates keys spanning midnight correctly", () => {
      const start = new Date("2024-06-15T22:00:00Z");
      const prices = makePrices(start, [5, 3, 2, 8]);

      const window: CheapestWindow = {
        startTimestamp: prices[0].timestamp,
        endTimestamp: prices[3].timestamp,
        startHour: 22,
        hours: 3,
        averagePrice: 3.33,
        startIndex: 0,
        endIndex: 2,
      };

      const result = getCheapestWindowHours(window);
      // 3 hours starting at 22:00 UTC → covers 3 distinct hour keys
      expect(result.size).toBe(3);
    });

    it("generates correct count for an 8-hour window", () => {
      const start = new Date("2024-06-15T00:00:00Z");
      const prices = makePrices(start, Array.from({ length: 24 }, () => 5));

      const window: CheapestWindow = {
        startTimestamp: prices[2].timestamp,
        endTimestamp: prices[10].timestamp,
        startHour: 2,
        hours: 8,
        averagePrice: 5,
        startIndex: 2,
        endIndex: 9,
      };

      const result = getCheapestWindowHours(window);
      expect(result.size).toBe(8);
    });
  });

  describe("getCheapestWindowHours (15-minute boundaries)", () => {
    it("includes every hour overlapping a window that starts/ends mid-hour", () => {
      // 01:15–03:15 Tallinn (EEST) → overlaps hours 1, 2, 3
      const window: CheapestWindow = {
        startTimestamp: "2024-06-14T22:15:00.000Z",
        endTimestamp: "2024-06-15T00:15:00.000Z",
        startHour: 1,
        hours: 2,
        averagePrice: 3,
        startIndex: 0,
        endIndex: 7,
      };
      const keys = getCheapestWindowHours(window);
      expect([...keys]).toEqual(["2024-06-15:1", "2024-06-15:2", "2024-06-15:3"]);
    });

    it("keys a window crossing Tallinn midnight on both dates", () => {
      // 23:00–01:00 Tallinn
      const window: CheapestWindow = {
        startTimestamp: "2024-06-14T20:00:00.000Z",
        endTimestamp: "2024-06-14T22:00:00.000Z",
        startHour: 23,
        hours: 2,
        averagePrice: 3,
        startIndex: 0,
        endIndex: 7,
      };
      expect([...getCheapestWindowHours(window)]).toEqual(["2024-06-14:23", "2024-06-15:0"]);
    });
  });

  // ─── 15-minute slot normalization ──────────────────────────────────────────

  describe("normalizeTo15MinSlots", () => {
    it("returns empty array for empty input", () => {
      expect(normalizeTo15MinSlots([])).toEqual([]);
    });

    it("expands hourly points into 4 equal 15-minute slots", () => {
      const start = new Date("2024-06-15T00:00:00Z");
      const slots = normalizeTo15MinSlots(makePrices(start, [10, 20]));
      expect(slots).toHaveLength(8);
      expect(slots.slice(0, 4).every((s) => s.displayPrice === 10)).toBe(true);
      expect(slots.slice(4).every((s) => s.displayPrice === 20)).toBe(true);
      expect(slots[1].startMs - slots[0].startMs).toBe(SLOT_MS);
    });

    it("maps 15-minute points 1:1", () => {
      const start = new Date("2024-06-15T00:00:00Z").getTime();
      const points = [1, 2, 3, 4, 5].map((p, i) => ({
        timestamp: new Date(start + i * SLOT_MS).toISOString(),
        displayPrice: p,
      }));
      const slots = normalizeTo15MinSlots(points);
      expect(slots.map((s) => s.displayPrice)).toEqual([1, 2, 3, 4, 5]);
    });

    it("handles 15-minute actuals followed by hour-aligned hourly predictions", () => {
      // Realistic: last official 15-min price at 21:45Z; predictions start at the next
      // full hour (floorToHour(lastActual) + 1h = 22:00Z) and are hourly.
      const last = new Date("2024-06-15T21:45:00Z").getTime();
      const points = [
        { timestamp: new Date(last - 3 * SLOT_MS).toISOString(), displayPrice: 1 },
        { timestamp: new Date(last - 2 * SLOT_MS).toISOString(), displayPrice: 2 },
        { timestamp: new Date(last - SLOT_MS).toISOString(), displayPrice: 3 },
        { timestamp: new Date(last).toISOString(), displayPrice: 4 },
        { timestamp: "2024-06-15T22:00:00.000Z", displayPrice: 9, isPredicted: true },
        { timestamp: "2024-06-15T23:00:00.000Z", displayPrice: 7, isPredicted: true },
      ];
      const slots = normalizeTo15MinSlots(points);
      expect(slots).toHaveLength(12);
      expect(slots.map((s) => s.displayPrice)).toEqual([1, 2, 3, 4, 9, 9, 9, 9, 7, 7, 7, 7]);
      expect(slots.slice(0, 4).every((s) => !s.isPredicted)).toBe(true);
      expect(slots.slice(4).every((s) => s.isPredicted)).toBe(true);
    });

    it("never fabricates official prices: fills beyond a point's native span are predicted", () => {
      // Unaligned: predictions start at lastActual + 1h (21:45Z → 22:45Z).
      // The 22:00–22:30Z fill slots extend the last official price but are not official.
      const last = new Date("2024-06-15T21:45:00Z").getTime();
      const points = [
        { timestamp: new Date(last - 2 * SLOT_MS).toISOString(), displayPrice: 2 },
        { timestamp: new Date(last - SLOT_MS).toISOString(), displayPrice: 3 },
        { timestamp: new Date(last).toISOString(), displayPrice: 4 },
        { timestamp: "2024-06-15T22:45:00.000Z", displayPrice: 9, isPredicted: true },
      ];
      const slots = normalizeTo15MinSlots(points);
      const byTime = new Map(slots.map((s) => [new Date(s.startMs).toISOString(), s]));
      expect(byTime.get("2024-06-15T21:45:00.000Z")!.isPredicted).toBe(false);
      for (const t of ["22:00", "22:15", "22:30"]) {
        const slot = byTime.get(`2024-06-15T${t}:00.000Z`)!;
        expect(slot.displayPrice).toBe(4);
        expect(slot.isPredicted).toBe(true);
      }
    });

    it("keeps hourly official points fully official (native span = 1 h)", () => {
      const slots = normalizeTo15MinSlots(makePrices(new Date("2024-06-15T00:00:00Z"), [10, 20, 30]));
      expect(slots.every((s) => !s.isPredicted)).toBe(true);
    });

    it("clips slots at the horizon end", () => {
      const points = makePrices(new Date("2024-06-15T20:00:00Z"), [10, 20]);
      const endMs = new Date("2024-06-15T21:30:00Z").getTime();
      const slots = normalizeTo15MinSlots(points, endMs);
      expect(slots).toHaveLength(6);
      expect(slots[slots.length - 1].startMs).toBe(new Date("2024-06-15T21:15:00Z").getTime());
    });

    it("sorts unsorted input", () => {
      const start = new Date("2024-06-15T00:00:00Z");
      const points = makePrices(start, [10, 20]).reverse();
      const slots = normalizeTo15MinSlots(points);
      expect(slots[0].displayPrice).toBe(10);
    });

    it("leaves gaps larger than one hour as holes", () => {
      const points = [
        { timestamp: "2024-06-15T00:00:00.000Z", displayPrice: 1 },
        { timestamp: "2024-06-15T03:00:00.000Z", displayPrice: 2 },
      ];
      const slots = normalizeTo15MinSlots(points);
      // 4 slots for the first (gap capped at 1h) + 4 for the last (prev spacing capped at 1h)
      expect(slots).toHaveLength(8);
      expect(slots[4].startMs - slots[3].startMs).toBeGreaterThan(SLOT_MS);
    });
  });

  // ─── Slot window search ────────────────────────────────────────────────────

  describe("findCheapestSlotWindow", () => {
    function slotsFrom(startIso: string, prices: number[], predicted: boolean[] = []) {
      const start = new Date(startIso).getTime();
      return prices.map((p, i) => ({
        startMs: start + i * SLOT_MS,
        displayPrice: p,
        isPredicted: predicted[i] ?? false,
      }));
    }

    it("returns null for empty slots or non-positive count", () => {
      expect(findCheapestSlotWindow([], 4, 0, null)).toBeNull();
      expect(findCheapestSlotWindow(slotsFrom("2024-06-15T00:00:00Z", [1, 2]), 0, 0, null)).toBeNull();
    });

    it("finds the cheapest run with 15-minute resolution", () => {
      const slots = slotsFrom("2024-06-15T00:00:00Z", [5, 5, 1, 1, 1, 5, 5]);
      const w = findCheapestSlotWindow(slots, 3, slots[0].startMs, null)!;
      expect(w.startIndex).toBe(2);
      expect(w.endIndex).toBe(4);
      expect(w.hours).toBe(0.75);
      expect(w.averagePrice).toBeCloseTo(1);
      expect(w.startTimestamp).toBe("2024-06-15T00:30:00.000Z");
      expect(w.endTimestamp).toBe("2024-06-15T01:15:00.000Z");
    });

    it("respects the end limit (window must end at or before it)", () => {
      const slots = slotsFrom("2024-06-15T00:00:00Z", [5, 3, 3, 9, 1, 1]);
      const limit = slots[0].startMs + 3 * SLOT_MS; // window must end by 00:45
      const w = findCheapestSlotWindow(slots, 2, slots[0].startMs, limit)!;
      expect(w.startIndex).toBe(1);
      expect(w.endTimestamp).toBe("2024-06-15T00:45:00.000Z");
    });

    it("returns null when no window fits the end limit", () => {
      const slots = slotsFrom("2024-06-15T00:00:00Z", [5, 3, 3]);
      expect(findCheapestSlotWindow(slots, 3, slots[0].startMs, slots[0].startMs + SLOT_MS)).toBeNull();
    });

    it("skips windows spanning a data gap", () => {
      const a = slotsFrom("2024-06-15T00:00:00Z", [1, 1]);
      const b = slotsFrom("2024-06-15T02:00:00Z", [4, 4]);
      const w = findCheapestSlotWindow([...a, ...b], 2, a[0].startMs, null)!;
      expect(w.startIndex).toBe(0);
      expect(findCheapestSlotWindow([...a, ...b], 3, a[0].startMs, null)).toBeNull();
    });

    it("keeps the earliest window on ties", () => {
      const slots = slotsFrom("2024-06-15T00:00:00Z", [2, 2, 2, 2]);
      expect(findCheapestSlotWindow(slots, 2, slots[0].startMs, null)!.startIndex).toBe(0);
    });

    it("flags windows containing predicted slots", () => {
      const slots = slotsFrom("2024-06-15T00:00:00Z", [5, 5, 1, 1], [false, false, false, true]);
      expect(findCheapestSlotWindow(slots, 2, slots[0].startMs, null)!.isPredicted).toBe(true);
      expect(findCheapestSlotWindow(slots, 1, slots[0].startMs, null)!.isPredicted).toBe(false);
    });
  });

  // ─── Rolling horizon ───────────────────────────────────────────────────────

  describe("computeRollingWindow", () => {
    /** Hourly prices starting at a Tallinn-local hour on 2024-06-14 (EEST, UTC+3). */
    function hourlyFromTallinn(tallinnHour: number, prices: number[], predictedFrom = Infinity) {
      const start = new Date(Date.UTC(2024, 5, 14, tallinnHour - 3));
      return prices.map((p, i) => ({
        timestamp: new Date(start.getTime() + i * 3_600_000).toISOString(),
        displayPrice: p,
        isPredicted: i >= predictedFrom,
      }));
    }

    it("returns empty result when there is no data", () => {
      const r = computeRollingWindow([], { now: new Date(), durationHours: 2, readyBy: null });
      expect(r.best).toBeNull();
      expect(r.startingNowPrice).toBeNull();
      expect(r.horizonAvgPrice).toBeNull();
      expect(r.isPredicted).toBe(false);
    });

    it("finds a night window crossing midnight (independent of chart day)", () => {
      // From 20:00 Tallinn: 20,21,22,23 expensive; 00–05 cheap; then expensive
      const prices = [20, 20, 15, 10, 2, 1, 1, 1, 2, 3, 30, 30];
      const points = hourlyFromTallinn(20, prices);
      const now = new Date(points[0].timestamp); // 20:00 Tallinn
      const r = computeRollingWindow(points, { now, durationHours: 4, readyBy: null });
      // Cheapest 4h: 00:00–04:00 Tallinn (2,1,1,1)
      expect(r.best!.startTimestamp).toBe("2024-06-14T21:00:00.000Z");
      expect(r.best!.endTimestamp).toBe("2024-06-15T01:00:00.000Z");
      expect(r.best!.averagePrice).toBeCloseTo(1.25);
    });

    it("finds a window spanning 23:00 → 01:00 across midnight", () => {
      const prices = [9, 9, 9, 1, 1, 9, 9]; // 20..02 Tallinn, cheap at 23 and 00
      const points = hourlyFromTallinn(20, prices);
      const r = computeRollingWindow(points, {
        now: new Date(points[0].timestamp),
        durationHours: 2,
        readyBy: null,
      });
      expect(r.best!.startHour).toBe(23);
      expect([...getCheapestWindowHours(r.best)]).toEqual(["2024-06-14:23", "2024-06-15:0"]);
    });

    it("applies the ready-by deadline (next occurrence after now)", () => {
      // 20:00 → 09:00 Tallinn; cheapest hours at 06–08, but must be ready by 07:00
      const prices = [9, 9, 9, 9, 5, 5, 9, 9, 9, 9, 1, 1, 1];
      const points = hourlyFromTallinn(20, prices);
      const now = new Date(points[0].timestamp);
      const r = computeRollingWindow(points, { now, durationHours: 2, readyBy: "07:00" });
      expect(r.readyByLimit!.toISOString()).toBe("2024-06-15T04:00:00.000Z");
      // Best 2h ending by 07:00 → 00:00–02:00 (5,5)
      expect(r.best!.startTimestamp).toBe("2024-06-14T21:00:00.000Z");
      expect(new Date(r.best!.endTimestamp).getTime()).toBeLessThanOrEqual(r.readyByLimit!.getTime());
    });

    it("rolls the deadline to the following day when today's is too soon for the duration", () => {
      // 05:00 Tallinn, EV 8 h ready by 07:00 → today's 07:00 is only 2 h away → use tomorrow 07:00
      const points = hourlyFromTallinn(5, Array(30).fill(5).map((p, i) => (i >= 20 && i < 28 ? 1 : p)));
      const r = computeRollingWindow(points, {
        now: new Date(points[0].timestamp),
        durationHours: 8,
        readyBy: "07:00",
      });
      expect(r.readyByRolledOver).toBe(true);
      expect(r.readyByLimit!.toISOString()).toBe("2024-06-15T04:00:00.000Z");
      // Cheap block is 01:00–09:00 tomorrow, but the window must end by 07:00
      expect(r.best!.startTimestamp).toBe("2024-06-14T20:00:00.000Z"); // 23:00 Tallinn
      expect(r.best!.endTimestamp).toBe("2024-06-15T04:00:00.000Z"); // 07:00 Tallinn
      expect(r.startingNowPrice).toBeCloseTo(5);
    });

    it("late evening EV: nothing fits before 07:00 → falls back to the best full window, flagged", () => {
      // Fri 23:30 Tallinn, flat prices through Saturday evening
      const points = hourlyFromTallinn(23, Array(20).fill(5));
      const now = new Date(new Date(points[0].timestamp).getTime() + 30 * 60_000);
      const r = computeRollingWindow(points, { now, durationHours: 8, readyBy: "07:00" });
      expect(r.readyByRolledOver).toBe(false);
      expect(r.bestIgnoresDeadline).toBe(true);
      expect(r.best).not.toBeNull();
      expect(r.startingNowEnd!.toISOString()).toBe("2024-06-15T04:30:00.000Z"); // 07:30 Tallinn
    });

    it("00:16, 8 h, ready by 07:00 → cheapest full-length window ignoring the deadline", () => {
      // From 00:00 Tallinn Sat: 00–08 at 10, 09–17 cheap (2), rest 10
      const prices = Array.from({ length: 24 }, (_, i) => (i >= 9 && i < 17 ? 2 : 10));
      const start = new Date(Date.UTC(2024, 5, 14, 21)); // 2024-06-15 00:00 Tallinn
      const points = prices.map((p, i) => ({
        timestamp: new Date(start.getTime() + i * 3_600_000).toISOString(),
        displayPrice: p,
        isPredicted: i >= 12,
      }));
      const now = new Date(start.getTime() + 16 * 60_000); // 00:16
      const r = computeRollingWindow(points, { now, durationHours: 8, readyBy: "07:00" });
      expect(r.readyByRolledOver).toBe(false);
      expect(r.readyByLimit!.toISOString()).toBe("2024-06-15T04:00:00.000Z");
      expect(r.bestIgnoresDeadline).toBe(true);
      expect(r.best!.startTimestamp).toBe("2024-06-15T06:00:00.000Z"); // 09:00 Tallinn
      expect(r.best!.averagePrice).toBeCloseTo(2);
      expect(new Date(r.best!.endTimestamp).getTime()).toBeGreaterThan(r.readyByLimit!.getTime());
      // Predicted flag and starting-now still apply to the fallback
      expect(r.isPredicted).toBe(true);
      expect(r.startingNowPrice).toBeCloseTo(10);
      expect(r.startingNowEnd!.toISOString()).toBe("2024-06-15T05:15:00.000Z"); // 08:15 Tallinn
    });

    it("bestIgnoresDeadline is false when a window fits before the deadline", () => {
      const points = hourlyFromTallinn(20, Array(14).fill(5));
      const r = computeRollingWindow(points, { now: new Date(points[0].timestamp), durationHours: 8, readyBy: "07:00" });
      expect(r.best).not.toBeNull();
      expect(r.bestIgnoresDeadline).toBe(false);
    });

    it("bestIgnoresDeadline is false without a deadline", () => {
      const points = hourlyFromTallinn(20, Array(14).fill(5));
      const r = computeRollingWindow(points, { now: new Date(points[0].timestamp), durationHours: 8, readyBy: null });
      expect(r.bestIgnoresDeadline).toBe(false);
    });

    it("returns no window when data does not reach far enough before the deadline", () => {
      const points = hourlyFromTallinn(20, [1, 1, 1]); // only 3 h of data
      const r = computeRollingWindow(points, {
        now: new Date(points[0].timestamp),
        durationHours: 8,
        readyBy: "07:00",
      });
      expect(r.best).toBeNull();
      expect(r.readyByRolledOver).toBe(false);
      // Horizon too short for any 8 h window → no fallback either
      expect(r.bestIgnoresDeadline).toBe(false);
    });

    it("clips the horizon so predictions do not extend past horizonEndMs", () => {
      const points = hourlyFromTallinn(20, [9, 9, 9, 1], 3); // last point predicted, 23:00 Tallinn
      const horizonEndMs = new Date(points[3].timestamp).getTime() + 2 * SLOT_MS; // 23:30
      const r = computeRollingWindow(points, {
        now: new Date(points[0].timestamp),
        durationHours: 1,
        readyBy: null,
        horizonEndMs,
      });
      // Only 2 cheap slots remain → best 1 h window must mix in a 9
      expect(r.best!.averagePrice).toBeCloseTo(5);
      expect(new Date(r.best!.endTimestamp).getTime()).toBeLessThanOrEqual(horizonEndMs);
    });

    it("searches at 15-minute resolution and floors now to 15 minutes", () => {
      const points = hourlyFromTallinn(10, [8, 2, 2, 8]);
      // now = 10:20 Tallinn → floor 10:15
      const now = new Date(new Date(points[0].timestamp).getTime() + 20 * 60_000);
      const r = computeRollingWindow(points, { now, durationHours: 1.5, readyBy: null });
      expect(r.best!.hours).toBe(1.5);
      // 1.5h window fully inside the 2,2 block → 11:00–12:30 Tallinn
      expect(r.best!.averagePrice).toBeCloseTo(2);
      // Starting now (10:15, 6 slots): 3×8 + 3×2 → 5
      expect(r.startingNowPrice).toBeCloseTo(5);
    });

    it("rounds duration to the nearest 15 minutes", () => {
      const points = hourlyFromTallinn(10, [1, 1, 1]);
      const r = computeRollingWindow(points, {
        now: new Date(points[0].timestamp),
        durationHours: 1.1, // → 4 slots
        readyBy: null,
      });
      expect(r.best!.hours).toBe(1);
    });

    it("computes horizon average and peak", () => {
      const points = hourlyFromTallinn(10, [2, 4, 12]);
      const r = computeRollingWindow(points, { now: new Date(points[0].timestamp), durationHours: 1, readyBy: null });
      expect(r.horizonAvgPrice).toBeCloseTo(6);
      expect(r.horizonMaxPrice).toBe(12);
    });

    it("ignores data before now", () => {
      const points = hourlyFromTallinn(8, [0, 0, 5, 6]);
      const now = new Date(points[2].timestamp);
      const r = computeRollingWindow(points, { now, durationHours: 1, readyBy: null });
      expect(r.best!.averagePrice).toBe(5);
    });

    it("sets isPredicted when the best window uses predicted prices", () => {
      // Official prices until index 4, predictions afterwards (cheapest overnight)
      const points = hourlyFromTallinn(20, [9, 9, 9, 9, 1, 1, 9], 4);
      const r = computeRollingWindow(points, { now: new Date(points[0].timestamp), durationHours: 2, readyBy: null });
      expect(r.isPredicted).toBe(true);
    });

    it("isPredicted is false when the best window is all official", () => {
      const points = hourlyFromTallinn(20, [1, 1, 9, 9, 9, 9, 9], 4);
      const r = computeRollingWindow(points, { now: new Date(points[0].timestamp), durationHours: 2, readyBy: null });
      expect(r.isPredicted).toBe(false);
    });

    it("returns no window for zero duration but still reports horizon stats", () => {
      const points = hourlyFromTallinn(10, [2, 4]);
      const r = computeRollingWindow(points, { now: new Date(points[0].timestamp), durationHours: 0, readyBy: null });
      expect(r.best).toBeNull();
      expect(r.horizonAvgPrice).toBeCloseTo(3);
    });

    it("ignores an invalid readyBy string", () => {
      const points = hourlyFromTallinn(10, [2, 4]);
      const r = computeRollingWindow(points, { now: new Date(points[0].timestamp), durationHours: 1, readyBy: "25:99" });
      expect(r.readyByLimit).toBeNull();
      expect(r.best).not.toBeNull();
    });
  });

  // ─── Ready-by resolution ───────────────────────────────────────────────────

  describe("resolveReadyByLimit", () => {
    it("returns null limit for null/invalid readyBy", () => {
      expect(resolveReadyByLimit(null, new Date(), 8)).toEqual({ limit: null, rolledOver: false });
      expect(resolveReadyByLimit("7am", new Date(), 8)).toEqual({ limit: null, rolledOver: false });
    });

    it("keeps the next occurrence when it is at least the duration away", () => {
      const now = new Date("2024-06-14T17:00:00Z"); // 20:00 Tallinn
      const r = resolveReadyByLimit("07:00", now, 8);
      expect(r.rolledOver).toBe(false);
      expect(r.limit!.toISOString()).toBe("2024-06-15T04:00:00.000Z");
    });

    it("keeps the next occurrence when exactly the duration away", () => {
      const now = new Date("2024-06-14T20:00:00Z"); // 23:00 Tallinn, 8 h before 07:00
      expect(resolveReadyByLimit("07:00", now, 8).rolledOver).toBe(false);
    });

    it("does NOT roll over late evening (23:30, 8 h, 07:00): keeps the near deadline", () => {
      const now = new Date("2024-06-14T20:30:00Z"); // Fri 23:30 Tallinn
      const r = resolveReadyByLimit("07:00", now, 8);
      expect(r.rolledOver).toBe(false);
      expect(r.limit!.toISOString()).toBe("2024-06-15T04:00:00.000Z");
    });

    it("does not roll over with exactly half the duration left (03:00, 8 h, 07:00)", () => {
      const now = new Date("2024-06-15T00:00:00Z"); // 03:00 Tallinn
      const r = resolveReadyByLimit("07:00", now, 8);
      expect(r.rolledOver).toBe(false);
      expect(r.limit!.toISOString()).toBe("2024-06-15T04:00:00.000Z");
    });

    it("rolls over at 06:30 with 07:00 and 8 h", () => {
      const now = new Date("2024-06-15T03:30:00Z"); // 06:30 Tallinn
      const r = resolveReadyByLimit("07:00", now, 8);
      expect(r.rolledOver).toBe(true);
      expect(r.limit!.toISOString()).toBe("2024-06-16T04:00:00.000Z");
    });

    it("rolls over DST-safely across the autumn fall-back", () => {
      // Sat 26 Oct 2024, 06:30 EEST → next-day 07:00 is EET (UTC+2)
      const now = new Date("2024-10-26T03:30:00Z");
      const r = resolveReadyByLimit("07:00", now, 8);
      expect(r.rolledOver).toBe(true);
      expect(r.limit!.toISOString()).toBe("2024-10-27T05:00:00.000Z");
    });

    it("rolls over DST-safely across the spring-forward", () => {
      // Sat 30 Mar 2024, 06:30 EET → next-day 07:00 is EEST (UTC+3)
      const now = new Date("2024-03-30T04:30:00Z");
      const r = resolveReadyByLimit("07:00", now, 8);
      expect(r.rolledOver).toBe(true);
      expect(r.limit!.toISOString()).toBe("2024-03-31T04:00:00.000Z");
    });
  });

  // ─── Chart clipping ────────────────────────────────────────────────────────

  describe("getVisibleWindowRange", () => {
    const data = makePrices(new Date("2024-06-15T00:00:00Z"), Array(24).fill(5));
    const win = (start: string, end: string): CheapestWindow => ({
      startTimestamp: start,
      endTimestamp: end,
      startHour: 0,
      hours: 2,
      averagePrice: 1,
      startIndex: 0,
      endIndex: 0,
    });

    it("returns null for null window or empty data", () => {
      expect(getVisibleWindowRange(null, data)).toBeNull();
      expect(getVisibleWindowRange(win("2024-06-15T02:00:00Z", "2024-06-15T04:00:00Z"), [])).toBeNull();
    });

    it("maps a fully visible window to exact data timestamps", () => {
      const r = getVisibleWindowRange(win("2024-06-15T02:00:00.000Z", "2024-06-15T04:00:00.000Z"), data);
      expect(r).toEqual({ x1: "2024-06-15T02:00:00.000Z", x2: "2024-06-15T04:00:00.000Z", clipped: false });
    });

    it("clips a window that starts before the chart range", () => {
      const r = getVisibleWindowRange(win("2024-06-14T22:00:00.000Z", "2024-06-15T03:00:00.000Z"), data);
      expect(r).toEqual({ x1: data[0].timestamp, x2: "2024-06-15T03:00:00.000Z", clipped: true });
    });

    it("clips a window that ends after the chart range", () => {
      const r = getVisibleWindowRange(win("2024-06-15T22:00:00.000Z", "2024-06-16T04:00:00.000Z"), data);
      expect(r).toEqual({ x1: "2024-06-15T22:00:00.000Z", x2: data[23].timestamp, clipped: true });
    });

    it("returns null when the window is entirely outside the chart range", () => {
      expect(getVisibleWindowRange(win("2024-06-16T02:00:00.000Z", "2024-06-16T04:00:00.000Z"), data)).toBeNull();
      expect(getVisibleWindowRange(win("2024-06-14T20:00:00.000Z", "2024-06-15T00:00:00.000Z"), data)).toBeNull();
    });

    it("hourly data: a window ending exactly at the data end (last point + 1 h) is not clipped", () => {
      // data: 00:00..23:00Z hourly → covers through 24:00Z
      const r = getVisibleWindowRange(win("2024-06-15T22:00:00.000Z", "2024-06-16T00:00:00.000Z"), data);
      expect(r).toEqual({ x1: "2024-06-15T22:00:00.000Z", x2: data[23].timestamp, clipped: false });
    });

    it("hourly data: a window ending beyond the data end is clipped", () => {
      const r = getVisibleWindowRange(win("2024-06-15T22:00:00.000Z", "2024-06-16T00:15:00.000Z"), data);
      expect(r!.clipped).toBe(true);
    });

    it("15-min data: a 22:00–24:00 window with the last point at 23:45 is not clipped", () => {
      const start = new Date("2024-06-15T00:00:00Z").getTime();
      const quarter = Array.from({ length: 96 }, (_, i) => ({
        timestamp: new Date(start + i * SLOT_MS).toISOString(),
      }));
      const end = getVisibleWindowRange(win("2024-06-15T22:00:00.000Z", "2024-06-16T00:00:00.000Z"), quarter);
      expect(end).toEqual({ x1: "2024-06-15T22:00:00.000Z", x2: "2024-06-15T23:45:00.000Z", clipped: false });

      const beyond = getVisibleWindowRange(win("2024-06-15T22:00:00.000Z", "2024-06-16T00:15:00.000Z"), quarter);
      expect(beyond!.clipped).toBe(true);
    });

    it("a data hole before the last point doesn't inflate the bucket: past-end window is clipped", () => {
      // hourly 00:00..20:00Z, then a 3 h hole, last point 23:00Z → bucket = 1 h, data end 24:00Z
      const holey = [...data.slice(0, 21), data[23]];
      const r = getVisibleWindowRange(win("2024-06-15T21:00:00.000Z", "2024-06-16T00:30:00.000Z"), holey);
      expect(r!.clipped).toBe(true);
      const exact = getVisibleWindowRange(win("2024-06-15T21:00:00.000Z", "2024-06-16T00:00:00.000Z"), holey);
      expect(exact!.clipped).toBe(false);
    });

    it("6 h aggregated data: a window ending exactly at the data end is not clipped", () => {
      const start = new Date("2024-06-15T00:00:00Z").getTime();
      const sixH = Array.from({ length: 4 }, (_, i) => ({
        timestamp: new Date(start + i * 6 * 60 * 60 * 1000).toISOString(),
      }));
      const end = getVisibleWindowRange(win("2024-06-15T12:00:00.000Z", "2024-06-16T00:00:00.000Z"), sixH);
      expect(end).toEqual({ x1: "2024-06-15T12:00:00.000Z", x2: "2024-06-15T18:00:00.000Z", clipped: false });
      const beyond = getVisibleWindowRange(win("2024-06-15T12:00:00.000Z", "2024-06-16T01:00:00.000Z"), sixH);
      expect(beyond!.clipped).toBe(true);
    });

    it("single data point: nothing to draw (x1 === x2), so the 15-min bucket default is moot", () => {
      const one = [{ timestamp: "2024-06-15T10:00:00.000Z" }];
      expect(getVisibleWindowRange(win("2024-06-15T10:00:00.000Z", "2024-06-15T10:15:00.000Z"), one)).toBeNull();
    });

    it("maps a mid-hour window onto the hourly bucket containing its start", () => {
      const r = getVisibleWindowRange(win("2024-06-15T02:15:00.000Z", "2024-06-15T04:15:00.000Z"), data);
      expect(r).toEqual({ x1: "2024-06-15T02:00:00.000Z", x2: "2024-06-15T05:00:00.000Z", clipped: false });
    });
  });
});

describe("computeRollingWindow across DST nights and negative prices", () => {
  /** Flat hourly points from a UTC start */
  function hourlyUtc(startIso: string, prices: number[]) {
    const start = new Date(startIso).getTime();
    return prices.map((p, i) => ({
      timestamp: new Date(start + i * 3_600_000).toISOString(),
      displayPrice: p,
      isPredicted: false,
    }));
  }

  it("fits 8 h before 07:00 on the fall-back night (9 real hours available)", () => {
    // Sat 24 Oct 2026 23:00 EEST = 20:00Z; 07:00 EET Sun = 05:00Z
    const points = hourlyUtc("2026-10-24T20:00:00Z", Array(30).fill(5));
    const r = computeRollingWindow(points, { now: new Date("2026-10-24T20:00:00Z"), durationHours: 8, readyBy: "07:00" });
    expect(r.readyByLimit!.toISOString()).toBe("2026-10-25T05:00:00.000Z");
    expect(r.bestIgnoresDeadline).toBe(false);
    expect(new Date(r.best!.endTimestamp).getTime()).toBeLessThanOrEqual(r.readyByLimit!.getTime());
  });

  it("flags the deadline as missed on the spring-forward night (only 7 real hours)", () => {
    // Sat 28 Mar 2026 23:00 EET = 21:00Z; 07:00 EEST Sun = 04:00Z
    const points = hourlyUtc("2026-03-28T21:00:00Z", Array(30).fill(5));
    const r = computeRollingWindow(points, { now: new Date("2026-03-28T21:00:00Z"), durationHours: 8, readyBy: "07:00" });
    expect(r.readyByLimit!.toISOString()).toBe("2026-03-29T04:00:00.000Z");
    expect(r.readyByRolledOver).toBe(false);
    expect(r.bestIgnoresDeadline).toBe(true);
    expect(r.best).not.toBeNull();
  });

  it("picks a negative-price window and computes savings against a positive start", () => {
    // 2 h window; prices 5, -2, -3, 4 → cheapest is hours 1–2, average -2.5
    const points = hourlyUtc("2024-06-14T17:00:00Z", [5, -2, -3, 4]);
    const r = computeRollingWindow(points, { now: new Date("2024-06-14T17:00:00Z"), durationHours: 2, readyBy: null });
    expect(r.best!.startTimestamp).toBe("2024-06-14T18:00:00.000Z");
    expect(r.best!.averagePrice).toBeCloseTo(-2.5);
    expect(r.startingNowPrice).toBeCloseTo(1.5);
  });
});
