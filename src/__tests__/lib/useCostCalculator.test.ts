import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ElectricityPrice } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  getPricesWithPrediction: vi.fn(),
}));

const { getPricesWithPrediction } = vi.mocked(await import("@/lib/api"));
const { useCostCalculator, migrateLegacyReadyBy } = await import("@/lib/useCostCalculator");

function makePrice(tsIso: string, centsKwh: number, isPredicted = false): ElectricityPrice {
  return {
    timestamp: tsIso,
    date: new Date(tsIso),
    priceEurMwh: centsKwh * 10,
    priceCentsKwh: centsKwh,
    isPredicted,
  };
}

/** Hourly prices starting at the given UTC ISO hour. */
function hourly(startIso: string, cents: number[], predictedFrom = Infinity): ElectricityPrice[] {
  const start = new Date(startIso).getTime();
  return cents.map((c, i) =>
    makePrice(new Date(start + i * 3_600_000).toISOString(), c, i >= predictedFrom)
  );
}

// ─── migrateLegacyReadyBy ────────────────────────────────────────────────────

describe("migrateLegacyReadyBy", () => {
  function memoryStorage(initial: Record<string, string>) {
    const data = { ...initial };
    return {
      data,
      getItem: (k: string) => (k in data ? data[k] : null),
      setItem: (k: string, v: string) => {
        data[k] = v;
      },
    };
  }

  it("migrates a user-chosen legacy integer hour to HH:00", () => {
    const storage = memoryStorage({ eprice_costUntil: "21" });
    migrateLegacyReadyBy(storage);
    expect(storage.data.eprice_costReadyBy).toBe(JSON.stringify("21:00"));
  });

  it("skips the untouched legacy default (22) so the 07:00 default applies", () => {
    const storage = memoryStorage({ eprice_costUntil: "22" });
    migrateLegacyReadyBy(storage);
    expect(storage.data.eprice_costReadyBy).toBeUndefined();
  });

  it("migrates legacy null ('no limit') to null", () => {
    const storage = memoryStorage({ eprice_costUntil: "null" });
    migrateLegacyReadyBy(storage);
    expect(storage.data.eprice_costReadyBy).toBe("null");
  });

  it("pads single-digit hours", () => {
    const storage = memoryStorage({ eprice_costUntil: "7" });
    migrateLegacyReadyBy(storage);
    expect(storage.data.eprice_costReadyBy).toBe(JSON.stringify("07:00"));
  });

  it("does not overwrite an existing ready-by value", () => {
    const storage = memoryStorage({ eprice_costUntil: "22", eprice_costReadyBy: "null" });
    migrateLegacyReadyBy(storage);
    expect(storage.data.eprice_costReadyBy).toBe("null");
  });

  it("does nothing without a legacy value or with a non-numeric legacy value", () => {
    const empty = memoryStorage({});
    migrateLegacyReadyBy(empty);
    expect(empty.data.eprice_costReadyBy).toBeUndefined();

    const stringLegacy = memoryStorage({ eprice_costUntil: JSON.stringify("22") });
    migrateLegacyReadyBy(stringLegacy);
    expect(stringLegacy.data.eprice_costReadyBy).toBeUndefined();

    const garbage = memoryStorage({ eprice_costUntil: "{oops" });
    migrateLegacyReadyBy(garbage);
    expect(garbage.data.eprice_costReadyBy).toBeUndefined();
  });
});

// ─── useCostCalculator ───────────────────────────────────────────────────────

describe("useCostCalculator", () => {
  beforeEach(() => {
    localStorage.clear();
    getPricesWithPrediction.mockReset();
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["Date", "setInterval", "clearInterval"] });
    // Fri 14 Jun 2024, 20:10 Tallinn (EEST)
    vi.setSystemTime(new Date("2024-06-14T17:10:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("defaults to the EV Charge preset (40 kWh, 8 h, ready by 07:00)", () => {
    getPricesWithPrediction.mockResolvedValue([]);
    const { result } = renderHook(() => useCostCalculator(false));
    expect(result.current.costConsumptionKwh).toBe(40);
    expect(result.current.costDurationHours).toBe(8);
    expect(result.current.costReadyBy).toBe("07:00");
    expect(result.current.costActivePreset).toBe("EV Charge");
  });

  it("fetches its own horizon: start of current hour → end of tomorrow (Tallinn)", async () => {
    getPricesWithPrediction.mockResolvedValue([]);
    renderHook(() => useCostCalculator(false));
    await waitFor(() => expect(getPricesWithPrediction).toHaveBeenCalled());
    const [start, end] = getPricesWithPrediction.mock.calls[0];
    expect(start.toISOString()).toBe("2024-06-14T17:00:00.000Z");
    // End of Sat 15 Jun Tallinn = 2024-06-15T20:59:59.999Z
    expect(end.toISOString()).toBe("2024-06-15T20:59:59.999Z");
  });

  it("finds an overnight window crossing midnight, ready by 07:00", async () => {
    // 20:00 Tallinn → 09:00: cheap 23:00–07:00 (8 h), cheaper still after 07:00 (excluded)
    const cents = [20, 20, 20, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1];
    getPricesWithPrediction.mockResolvedValue(hourly("2024-06-14T17:00:00.000Z", cents));
    const { result } = renderHook(() => useCostCalculator(false));
    await waitFor(() => expect(result.current.cheapestWindow).not.toBeNull());
    const w = result.current.cheapestWindow!;
    expect(w.startTimestamp).toBe("2024-06-14T20:00:00.000Z"); // 23:00 Tallinn
    expect(w.endTimestamp).toBe("2024-06-15T04:00:00.000Z"); // 07:00 Tallinn
    expect(w.averagePrice).toBeCloseTo(2);
    expect(result.current.costLoading).toBe(false);
  });

  it("falls back to the best full window when nothing fits before ready-by (00:16, 8 h, 07:00)", async () => {
    vi.setSystemTime(new Date("2024-06-14T21:16:00.000Z")); // 00:16 Tallinn Sat
    // From 00:00 Tallinn: 10 until 09:00, then 2 for 8 h, then 10
    const cents = Array.from({ length: 24 }, (_, i) => (i >= 9 && i < 17 ? 2 : 10));
    getPricesWithPrediction.mockResolvedValue(hourly("2024-06-14T21:00:00.000Z", cents));
    const { result } = renderHook(() => useCostCalculator(false));
    await waitFor(() => expect(result.current.cheapestWindow).not.toBeNull());
    expect(result.current.bestIgnoresDeadline).toBe(true);
    expect(result.current.cheapestWindow!.startTimestamp).toBe("2024-06-15T06:00:00.000Z");
    expect(new Date(result.current.startingNowEndMs!).toISOString()).toBe("2024-06-15T05:15:00.000Z");
  });

  it("bestIgnoresDeadline is false when a window fits", async () => {
    getPricesWithPrediction.mockResolvedValue(hourly("2024-06-14T17:00:00.000Z", Array(14).fill(5)));
    const { result } = renderHook(() => useCostCalculator(false));
    await waitFor(() => expect(result.current.cheapestWindow).not.toBeNull());
    expect(result.current.bestIgnoresDeadline).toBe(false);
  });

  it("applies VAT to all prices when enabled", async () => {
    getPricesWithPrediction.mockResolvedValue(hourly("2024-06-14T17:00:00.000Z", Array(14).fill(10)));
    const { result } = renderHook(() => useCostCalculator(true));
    await waitFor(() => expect(result.current.cheapestWindow).not.toBeNull());
    expect(result.current.cheapestWindow!.averagePrice).toBeCloseTo(12.2);
    expect(result.current.horizonMaxPrice).toBeCloseTo(12.2);
  });

  it("exposes isPredicted when the window uses predicted prices", async () => {
    const cents = [20, 20, 20, 2, 2, 2, 2, 2, 2, 2, 2, 9, 9, 9];
    getPricesWithPrediction.mockResolvedValue(hourly("2024-06-14T17:00:00.000Z", cents, 7));
    const { result } = renderHook(() => useCostCalculator(false));
    await waitFor(() => expect(result.current.cheapestWindow).not.toBeNull());
    expect(result.current.isPredicted).toBe(true);
  });

  it("allows predicted prices by default", () => {
    getPricesWithPrediction.mockResolvedValue([]);
    const { result } = renderHook(() => useCostCalculator(false));
    expect(result.current.costAllowPredicted).toBe(true);
  });

  it("excluding predicted prices keeps the window on official prices", async () => {
    // Official 20:00–02:59 Tallinn, predicted from 03:00 (00:00Z)
    const cents = [20, 20, 20, 2, 2, 2, 2, 2, 2, 2, 2, 9, 9, 9];
    getPricesWithPrediction.mockResolvedValue(hourly("2024-06-14T17:00:00.000Z", cents, 7));
    const { result } = renderHook(() => useCostCalculator(false));
    await waitFor(() => expect(result.current.cheapestWindow).not.toBeNull());

    act(() => result.current.setCostAllowPredicted(false));
    // 8 h does not fit before 03:00 Tallinn
    await waitFor(() => expect(result.current.cheapestWindow).toBeNull());
    expect(result.current.costNoData).toBe(false);
    expect(result.current.predictedFromMs).toBe(Date.parse("2024-06-15T00:00:00.000Z")); // 03:00 Tallinn

    act(() => result.current.setCostDurationHours(2));
    await waitFor(() => expect(result.current.cheapestWindow).not.toBeNull());
    const w = result.current.cheapestWindow!;
    expect(w.startTimestamp).toBe("2024-06-14T20:00:00.000Z"); // 23:00 Tallinn
    expect(w.endTimestamp).toBe("2024-06-14T22:00:00.000Z"); // 01:00 Tallinn
    expect(w.isPredicted).toBe(false);
  });

  it("persists the predicted-price choice", async () => {
    getPricesWithPrediction.mockResolvedValue([]);
    const { result } = renderHook(() => useCostCalculator(false));
    act(() => result.current.setCostAllowPredicted(false));
    await waitFor(() => expect(localStorage.getItem("eprice_costAllowPredicted")).toBe("false"));
  });

  it("migrates a legacy 'costUntil' setting into costReadyBy", async () => {
    localStorage.setItem("eprice_costUntil", "6");
    getPricesWithPrediction.mockResolvedValue([]);
    const { result } = renderHook(() => useCostCalculator(false));
    await waitFor(() => expect(result.current.costReadyBy).toBe("06:00"));
  });

  it("legacy default 22 is ignored and legacy null becomes no limit", async () => {
    localStorage.setItem("eprice_costUntil", "22");
    getPricesWithPrediction.mockResolvedValue([]);
    const first = renderHook(() => useCostCalculator(false));
    await waitFor(() => expect(getPricesWithPrediction).toHaveBeenCalled());
    expect(first.result.current.costReadyBy).toBe("07:00");
    first.unmount();

    localStorage.clear();
    localStorage.setItem("eprice_costUntil", "null");
    const second = renderHook(() => useCostCalculator(false));
    await waitFor(() => expect(second.result.current.costReadyBy).toBeNull());
  });

  it("rolls the deadline over and exposes readyByLimitMs", async () => {
    // 06:30 Tallinn, EV 8 h ready by 07:00 → tomorrow 07:00
    vi.setSystemTime(new Date("2024-06-14T03:30:00.000Z"));
    getPricesWithPrediction.mockResolvedValue(hourly("2024-06-14T03:00:00.000Z", Array(30).fill(5)));
    const { result } = renderHook(() => useCostCalculator(false));
    await waitFor(() => expect(result.current.cheapestWindow).not.toBeNull());
    expect(new Date(result.current.readyByLimitMs!).toISOString()).toBe("2024-06-15T04:00:00.000Z");
  });

  it("ignores predictions past the end of tomorrow (Tallinn)", async () => {
    // 29 hourly points from 20:00 Tallinn today; the last one (00:00 the day after
    // tomorrow, 21:00Z) is very cheap but outside the horizon.
    const cents = Array.from({ length: 29 }, (_, i) => (i === 28 ? 0 : 10));
    getPricesWithPrediction.mockResolvedValue(hourly("2024-06-14T17:00:00.000Z", cents, 10));
    const { result } = renderHook(() => useCostCalculator(false));
    act(() => result.current.setCostDurationHours(1));
    act(() => result.current.setCostReadyBy(null));
    await waitFor(() => expect(result.current.cheapestWindow).not.toBeNull());
    const w = result.current.cheapestWindow!;
    expect(new Date(w.endTimestamp).getTime()).toBeLessThanOrEqual(new Date("2024-06-15T21:00:00.000Z").getTime());
    expect(w.averagePrice).toBe(10);
  });

  it("exposes 'now' floored to the 15-minute slot", async () => {
    getPricesWithPrediction.mockResolvedValue([]);
    const { result } = renderHook(() => useCostCalculator(false));
    await waitFor(() => expect(result.current.costNowMs).not.toBeNull());
    // System time 17:10Z → slot 17:00Z
    expect(new Date(result.current.costNowMs!).toISOString()).toBe("2024-06-14T17:00:00.000Z");
  });

  it("a tick inside the same 15-minute slot does not change state (no re-render)", async () => {
    getPricesWithPrediction.mockResolvedValue([]);
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useCostCalculator(false);
    });
    await waitFor(() => expect(result.current.costLoading).toBe(false));
    const rendersBefore = renders;
    const nowBefore = result.current.costNowMs;
    // 17:10 → 17:13: still in the 17:00 slot
    const counts: number[] = [];
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        vi.advanceTimersByTime(60 * 1000);
      });
      counts.push(renders - rendersBefore);
    }
    expect(counts).toEqual([0, 0, 0]);
    expect(result.current.costNowMs).toBe(nowBefore);
  });

  it("a tick across a 15-minute boundary advances 'now'", async () => {
    getPricesWithPrediction.mockResolvedValue([]);
    const { result } = renderHook(() => useCostCalculator(false));
    await waitFor(() => expect(result.current.costLoading).toBe(false));
    // 17:10 → 17:16: crosses into the 17:15 slot
    await act(async () => {
      vi.advanceTimersByTime(6 * 60 * 1000);
    });
    expect(new Date(result.current.costNowMs!).toISOString()).toBe("2024-06-14T17:15:00.000Z");
    expect(getPricesWithPrediction).toHaveBeenCalledTimes(1);
  });

  it("ignores a stale in-flight response that resolves after a newer one", async () => {
    let resolveSlow: (v: ElectricityPrice[]) => void = () => {};
    const slow = new Promise<ElectricityPrice[]>((r) => {
      resolveSlow = r;
    });
    const fresh = hourly("2024-06-14T17:00:00.000Z", Array(14).fill(3));
    const stale = hourly("2024-06-14T17:00:00.000Z", Array(14).fill(99));
    getPricesWithPrediction.mockReturnValueOnce(slow).mockResolvedValueOnce(fresh);

    const { result } = renderHook(() => useCostCalculator(false));
    await waitFor(() => expect(getPricesWithPrediction).toHaveBeenCalledTimes(1));

    // Second (newer) load — from the 15-min refresh interval — completes first
    await act(async () => {
      vi.advanceTimersByTime(15 * 60 * 1000);
    });
    expect(getPricesWithPrediction).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(result.current.cheapestWindow?.averagePrice).toBeCloseTo(3));
    const nowAfterFresh = result.current.costNowMs;

    // The stale first load resolves late — must be ignored
    await act(async () => {
      resolveSlow(stale);
      await slow;
    });
    expect(result.current.cheapestWindow!.averagePrice).toBeCloseTo(3);
    expect(result.current.costNowMs).toBe(nowAfterFresh);
  });

  it("refetches on becoming visible once the last load is ≥ 60 s old, and stops listening on unmount", async () => {
    getPricesWithPrediction.mockResolvedValue([]);
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const { unmount } = renderHook(() => useCostCalculator(false));
    await waitFor(() => expect(getPricesWithPrediction).toHaveBeenCalledTimes(1));

    visibility.mockReturnValue("hidden");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(getPricesWithPrediction).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(60 * 1000);
    });
    visibility.mockReturnValue("visible");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitFor(() => expect(getPricesWithPrediction).toHaveBeenCalledTimes(2));

    unmount();
    await act(async () => {
      vi.advanceTimersByTime(60 * 1000);
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(getPricesWithPrediction).toHaveBeenCalledTimes(2);
    visibility.mockRestore();
  });

  it("skips the refetch when becoming visible within 60 s of the last successful load", async () => {
    getPricesWithPrediction.mockResolvedValue([]);
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const { result } = renderHook(() => useCostCalculator(false));
    await waitFor(() => expect(result.current.costLoading).toBe(false));

    await act(async () => {
      vi.advanceTimersByTime(59 * 1000);
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    // Give any (unexpected) load a chance to start
    await act(async () => {});
    expect(getPricesWithPrediction).toHaveBeenCalledTimes(1);
    visibility.mockRestore();
  });

  it("advances 'now' to the current slot on becoming visible even when the refetch is skipped", async () => {
    vi.setSystemTime(new Date("2024-06-14T17:14:50.000Z"));
    getPricesWithPrediction.mockResolvedValue([]);
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const { result } = renderHook(() => useCostCalculator(false));
    await waitFor(() => expect(result.current.costLoading).toBe(false));
    expect(new Date(result.current.costNowMs!).toISOString()).toBe("2024-06-14T17:00:00.000Z");

    // 30 s later (device asleep, no tick fired) the clock is in the next slot
    vi.setSystemTime(new Date("2024-06-14T17:15:20.000Z"));
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(new Date(result.current.costNowMs!).toISOString()).toBe("2024-06-14T17:15:00.000Z");
    await act(async () => {});
    expect(getPricesWithPrediction).toHaveBeenCalledTimes(1); // refetch throttled
    visibility.mockRestore();
  });

  it("on-visible refetches after a failed interval load when the last success is ≥ 60 s old", async () => {
    getPricesWithPrediction
      .mockResolvedValueOnce(hourly("2024-06-14T17:00:00.000Z", Array(14).fill(3)))
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue([]);
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const { result } = renderHook(() => useCostCalculator(false));
    await waitFor(() => expect(result.current.costLoading).toBe(false));

    await act(async () => {
      vi.advanceTimersByTime(61 * 1000);
    });
    expect(getPricesWithPrediction).toHaveBeenCalledTimes(1);
    // The interval load (at 15 min) fails — not in flight anymore, last success is old
    await act(async () => {
      vi.advanceTimersByTime(15 * 60 * 1000 - 61 * 1000);
    });
    await waitFor(() => expect(result.current.costError).not.toBeNull());
    expect(getPricesWithPrediction).toHaveBeenCalledTimes(2);

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitFor(() => expect(getPricesWithPrediction).toHaveBeenCalledTimes(3));
    visibility.mockRestore();
  });

  it("on-visible refetches within 60 s when the very first load failed", async () => {
    getPricesWithPrediction.mockRejectedValueOnce(new Error("boom")).mockResolvedValue([]);
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const { result } = renderHook(() => useCostCalculator(false));
    await waitFor(() => expect(result.current.costError).not.toBeNull());

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitFor(() => expect(getPricesWithPrediction).toHaveBeenCalledTimes(2));
    visibility.mockRestore();
  });

  it("on-visible does not start a second fetch while the initial load is pending", async () => {
    let resolveFirst: (v: ElectricityPrice[]) => void = () => {};
    const first = new Promise<ElectricityPrice[]>((r) => {
      resolveFirst = r;
    });
    getPricesWithPrediction.mockReturnValueOnce(first).mockResolvedValue([]);
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const { result } = renderHook(() => useCostCalculator(false));
    await waitFor(() => expect(getPricesWithPrediction).toHaveBeenCalledTimes(1));

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(getPricesWithPrediction).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirst(hourly("2024-06-14T17:00:00.000Z", Array(14).fill(3)));
      await first;
    });
    await waitFor(() => expect(result.current.costLoading).toBe(false));
    expect(getPricesWithPrediction).toHaveBeenCalledTimes(1);
    visibility.mockRestore();
  });

  it("falls back to the default for a malformed persisted ready-by", async () => {
    localStorage.setItem("eprice_costReadyBy", JSON.stringify("nope"));
    getPricesWithPrediction.mockResolvedValue([]);
    const { result } = renderHook(() => useCostCalculator(false));
    await waitFor(() => expect(getPricesWithPrediction).toHaveBeenCalled());
    expect(result.current.costReadyBy).toBe("07:00");
  });

  it("reports fetch errors without throwing", async () => {
    getPricesWithPrediction.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useCostCalculator(false));
    await waitFor(() => expect(result.current.costError).toBe("boom"));
    expect(result.current.cheapestWindow).toBeNull();
    expect(result.current.costLoading).toBe(false);
  });

  it("refreshes every 15 minutes and stops on unmount", async () => {
    getPricesWithPrediction.mockResolvedValue([]);
    const { unmount } = renderHook(() => useCostCalculator(false));
    await waitFor(() => expect(getPricesWithPrediction).toHaveBeenCalledTimes(1));
    await act(async () => {
      vi.advanceTimersByTime(15 * 60 * 1000);
    });
    await waitFor(() => expect(getPricesWithPrediction).toHaveBeenCalledTimes(2));
    unmount();
    await act(async () => {
      vi.advanceTimersByTime(15 * 60 * 1000);
    });
    expect(getPricesWithPrediction).toHaveBeenCalledTimes(2);
  });

  it("a stale request that fails after a newer success does not raise an error", async () => {
    let rejectSlow: (e: Error) => void = () => {};
    const slow = new Promise<ElectricityPrice[]>((_, rej) => {
      rejectSlow = rej;
    });
    const fresh = hourly("2024-06-14T17:00:00.000Z", Array(14).fill(3));
    getPricesWithPrediction.mockReturnValueOnce(slow).mockResolvedValueOnce(fresh);
    const { result } = renderHook(() => useCostCalculator(false));
    await waitFor(() => expect(getPricesWithPrediction).toHaveBeenCalledTimes(1));
    await act(async () => {
      vi.advanceTimersByTime(15 * 60 * 1000);
    });
    await waitFor(() => expect(result.current.cheapestWindow?.averagePrice).toBeCloseTo(3));
    await act(async () => {
      rejectSlow(new Error("late failure"));
      await slow.catch(() => {});
    });
    expect(result.current.costError).toBeNull();
  });

  it("clamps out-of-range persisted values to the field limits", async () => {
    localStorage.setItem("eprice_costKwh", JSON.stringify(500));
    localStorage.setItem("eprice_costDuration", JSON.stringify(30));
    getPricesWithPrediction.mockResolvedValue([]);
    const { result } = renderHook(() => useCostCalculator(false));
    await waitFor(() => expect(result.current.costLoading).toBe(false));
    expect(result.current.costConsumptionKwh).toBe(200);
    expect(result.current.costDurationHours).toBe(24);
  });

  it("flags a successful load with no prices as no data (not as 'no window fits')", async () => {
    getPricesWithPrediction.mockResolvedValue([]);
    const { result } = renderHook(() => useCostCalculator(false));
    await waitFor(() => expect(result.current.costLoading).toBe(false));
    expect(result.current.costNoData).toBe(true);
    expect(result.current.costError).toBeNull();
  });

  it("is loading again while a refetch is pending, so a long-asleep tab doesn't show 'no window fits'", async () => {
    getPricesWithPrediction.mockResolvedValueOnce(hourly("2024-06-14T17:00:00.000Z", Array(14).fill(3)));
    const { result } = renderHook(() => useCostCalculator(false));
    await waitFor(() => expect(result.current.costLoading).toBe(false));
    getPricesWithPrediction.mockReturnValueOnce(new Promise<ElectricityPrice[]>(() => {}));
    await act(async () => {
      vi.advanceTimersByTime(15 * 60 * 1000);
    });
    expect(result.current.costLoading).toBe(true);
  });

  it("retries as soon as the browser comes back online after a failed load", async () => {
    getPricesWithPrediction.mockRejectedValueOnce(new Error("offline")).mockResolvedValue([]);
    const { result } = renderHook(() => useCostCalculator(false));
    await waitFor(() => expect(result.current.costError).not.toBeNull());
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    await waitFor(() => expect(getPricesWithPrediction).toHaveBeenCalledTimes(2));
  });

  it("clears the error once a later load succeeds", async () => {
    getPricesWithPrediction
      .mockRejectedValueOnce(new Error("transient 500"))
      .mockResolvedValue(hourly("2024-06-14T17:00:00.000Z", Array(14).fill(3)));
    const { result } = renderHook(() => useCostCalculator(false));
    await waitFor(() => expect(result.current.costError).not.toBeNull());
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    await waitFor(() => expect(result.current.cheapestWindow).not.toBeNull());
    expect(result.current.costError).toBeNull();
  });

  it("does not flag no-data when prices exist but no full window fits", async () => {
    // 2 h of prices, 8 h preset: data exists, window doesn't
    getPricesWithPrediction.mockResolvedValue(hourly("2024-06-14T17:00:00.000Z", [3, 3]));
    const { result } = renderHook(() => useCostCalculator(false));
    await waitFor(() => expect(result.current.costLoading).toBe(false));
    expect(result.current.cheapestWindow).toBeNull();
    expect(result.current.costNoData).toBe(false);
  });

  it("an online event does not start a second fetch while one is pending", async () => {
    getPricesWithPrediction.mockReturnValueOnce(new Promise<ElectricityPrice[]>(() => {}));
    renderHook(() => useCostCalculator(false));
    await waitFor(() => expect(getPricesWithPrediction).toHaveBeenCalledTimes(1));
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(getPricesWithPrediction).toHaveBeenCalledTimes(1);
  });
});
