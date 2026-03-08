import { describe, it, expect, vi, beforeEach } from "vitest";
import { eurMwhToCentsKwh } from "@/lib/price";

// Mock getCloudflareContext since it's not available in test environment
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(),
}));

describe("eurMwhToCentsKwh", () => {
  it("converts 100 EUR/MWh to 10 cents/kWh", () => {
    expect(eurMwhToCentsKwh(100)).toBe(10);
  });

  it("converts 0 EUR/MWh to 0 cents/kWh", () => {
    expect(eurMwhToCentsKwh(0)).toBe(0);
  });

  it("handles negative prices", () => {
    expect(eurMwhToCentsKwh(-30)).toBe(-3);
  });

  it("handles decimal values", () => {
    expect(eurMwhToCentsKwh(55.5)).toBeCloseTo(5.55);
  });
});

// ─── D1 Database function tests (with mock DB) ─────────────────────────────

describe("upsertPrices", () => {
  let mockDb: {
    prepare: ReturnType<typeof vi.fn>;
    batch: ReturnType<typeof vi.fn>;
  };
  let mockStmt: { bind: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockStmt = { bind: vi.fn().mockReturnThis() };
    mockDb = {
      prepare: vi.fn().mockReturnValue(mockStmt),
      batch: vi.fn().mockResolvedValue([]),
    };
  });

  it("does nothing for empty prices array", async () => {
    // Import dynamically to use the mock
    const { upsertPrices } = await import("@/lib/db");
    await upsertPrices(mockDb as unknown as D1Database, []);
    expect(mockDb.prepare).not.toHaveBeenCalled();
  });

  it("batches prices in groups of 100", async () => {
    const { upsertPrices } = await import("@/lib/db");
    const prices = Array.from({ length: 250 }, (_, i) => ({
      timestamp: 1704067200 + i * 900,
      priceEurMwh: 50 + i,
    }));

    await upsertPrices(mockDb as unknown as D1Database, prices);

    // 250 items / 100 batch size = 3 batches
    expect(mockDb.batch).toHaveBeenCalledTimes(3);
  });

  it("binds correct values including computed cents/kWh", async () => {
    const { upsertPrices } = await import("@/lib/db");
    const prices = [{ timestamp: 1704067200, priceEurMwh: 100 }];

    await upsertPrices(mockDb as unknown as D1Database, prices);

    expect(mockStmt.bind).toHaveBeenCalledWith(1704067200, 100, 10); // 100/10 = 10 cents/kWh
  });
});

describe("recomputeHourlyAverages", () => {
  it("rounds timestamps to hour boundaries", async () => {
    const mockRun = vi.fn().mockResolvedValue({});
    const mockBind = vi.fn().mockReturnValue({ run: mockRun });
    const mockDb = {
      prepare: vi.fn().mockReturnValue({ bind: mockBind }),
    };

    const { recomputeHourlyAverages } = await import("@/lib/db");
    // Timestamp in the middle of an hour: 2024-01-01T00:30:00Z = 1704069000
    const midHour = 1704069000;
    // End at 2024-01-01T02:30:00Z = 1704076200
    const endMidHour = 1704076200;

    await recomputeHourlyAverages(
      mockDb as unknown as D1Database,
      midHour,
      endMidHour
    );

    // Should round start down to hour boundary (1704067200) and end up (1704078000)
    const [boundStart, boundEnd] = mockBind.mock.calls[0];
    expect(boundStart).toBe(Math.floor(midHour / 3600) * 3600);
    expect(boundEnd).toBe(Math.ceil(endMidHour / 3600) * 3600);
  });
});

describe("recomputeAllAggregates", () => {
  it("expands range to full months", async () => {
    const mockRun = vi.fn().mockResolvedValue({});
    const mockBind = vi.fn().mockReturnValue({ run: mockRun });
    const mockDb = {
      prepare: vi.fn().mockReturnValue({ bind: mockBind }),
    };

    const { recomputeAllAggregates } = await import("@/lib/db");

    // Mid-March 2024: 2024-03-15T12:00:00Z = 1710504000
    const midMarch = 1710504000;
    // Late March 2024: 2024-03-25T12:00:00Z = 1711368000
    const lateMarch = 1711368000;

    await recomputeAllAggregates(
      mockDb as unknown as D1Database,
      midMarch,
      lateMarch
    );

    // Should call prepare 5 times (hourly, daily, weekly, monthly, weekday-hour)
    expect(mockDb.prepare).toHaveBeenCalledTimes(5);

    // First call (hourly) should use expanded range: March 1 to April 1
    const [expandedStart] = mockBind.mock.calls[0];
    const startDate = new Date(expandedStart * 1000);
    expect(startDate.getUTCDate()).toBe(1); // Should be start of month
    expect(startDate.getUTCMonth()).toBe(2); // March (0-indexed)
  });
});
