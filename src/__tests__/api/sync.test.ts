import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock getCloudflareContext before importing routes
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(),
}));

describe("POST /api/sync", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("returns 400 when start date is after end date", async () => {
    const { POST } = await import("@/app/api/sync/route");
    const request = new Request(
      "http://localhost/api/sync?start=2025-06-01T00:00:00Z&end=2025-01-01T00:00:00Z"
    );
    const response = await POST(request as never);
    expect(response.status).toBe(400);
    const body = await response.json() as { error: string };
    expect(body.error).toBe("Start date must be before end date");
  });

  it("returns 400 when start equals end", async () => {
    const { POST } = await import("@/app/api/sync/route");
    const request = new Request(
      "http://localhost/api/sync?start=2025-06-01T00:00:00Z&end=2025-06-01T00:00:00Z"
    );
    const response = await POST(request as never);
    expect(response.status).toBe(400);
    const body = await response.json() as { error: string };
    expect(body.error).toBe("Start date must be before end date");
  });

  it("returns 400 when date range exceeds 31 days", async () => {
    // Workers Free: 10 ms CPU, 50 D1 queries and 100k rows written per day
    const { POST } = await import("@/app/api/sync/route");
    const request = new Request(
      "http://localhost/api/sync?start=2025-01-01T00:00:00Z&end=2025-02-01T01:00:01Z" // 31 days + 1 h + 1 s
    );
    const response = await POST(request as never);
    expect(response.status).toBe(400);
    const body = await response.json() as { error: string };
    expect(body.error).toBe("Date range exceeds maximum of 31 days");
  });

  it("accepts a whole Tallinn October (31 days plus the fall-back hour)", async () => {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    vi.mocked(getCloudflareContext).mockResolvedValue({
      env: {
        DB: {
          prepare: vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue({ latest: null, aggregatedThrough: null }) }),
          batch: vi.fn(),
        },
      },
      cf: {},
      ctx: {},
    } as never);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { ee: [] } }),
    }));
    const { POST } = await import("@/app/api/sync/route");
    // 2025-10-01 00:00 EEST → 2025-11-01 00:00 EET
    const request = new Request(
      "http://localhost/api/sync?start=2025-09-30T21:00:00Z&end=2025-10-31T22:00:00Z"
    );
    const response = await POST(request as never);
    expect(response.status).toBe(200);
  });

  it("returns 401 when SYNC_SECRET is set and the bearer token is missing or wrong", async () => {
    vi.stubEnv("SYNC_SECRET", "s3cret");
    try {
      const { POST } = await import("@/app/api/sync/route");
      const wrong = new Request("http://localhost/api/sync", { method: "POST", headers: { Authorization: "Bearer nope" } });
      expect((await POST(wrong as never)).status).toBe(401);
      expect((await POST(new Request("http://localhost/api/sync", { method: "POST" }) as never)).status).toBe(401);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("returns 400 for invalid start date format", async () => {
    const { POST } = await import("@/app/api/sync/route");
    const request = new Request(
      "http://localhost/api/sync?start=not-a-date&end=2025-01-01T00:00:00Z"
    );
    const response = await POST(request as never);
    expect(response.status).toBe(400);
    const body = await response.json() as { error: string };
    expect(body.error).toContain("Invalid start date format");
  });

  it("returns 400 for invalid end date format", async () => {
    const { POST } = await import("@/app/api/sync/route");
    const request = new Request(
      "http://localhost/api/sync?start=2025-01-01T00:00:00Z&end=not-a-date"
    );
    const response = await POST(request as never);
    expect(response.status).toBe(400);
    const body = await response.json() as { error: string };
    expect(body.error).toContain("Invalid end date format");
  });

  it("accepts a range of exactly 31 days", async () => {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const mockFirst = vi.fn().mockResolvedValue({ latest: null });
    const mockBind = vi.fn().mockReturnValue({ run: vi.fn() });
    const mockDB = {
      prepare: vi.fn().mockReturnValue({
        first: mockFirst,
        bind: mockBind,
      }),
      batch: vi.fn(),
    };

    vi.mocked(getCloudflareContext).mockResolvedValue({
      env: { DB: mockDB },
      cf: {},
      ctx: {},
    } as never);

    // Mock global fetch for Elering API call
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { ee: [] },
          }),
      })
    );

    const { POST } = await import("@/app/api/sync/route");
    const request = new Request(
      "http://localhost/api/sync?start=2025-01-01T00:00:00Z&end=2025-02-01T00:00:00Z"
    );
    const response = await POST(request as never);
    expect(response.status).toBe(200);
    const body = await response.json() as { success: boolean };
    expect(body.success).toBe(true);
  });
});

describe("GET /api/sync", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("returns sync status when DB is available", async () => {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const mockFirst = vi.fn().mockResolvedValue({
      latest: 1704067200,
      earliest: 1704000000,
      total: 96,
    });
    const mockDB = {
      prepare: vi.fn().mockReturnValue({
        first: mockFirst,
      }),
    };

    vi.mocked(getCloudflareContext).mockResolvedValue({
      env: { DB: mockDB },
      cf: {},
      ctx: {},
    } as never);

    const { GET } = await import("@/app/api/sync/route");
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json() as { success: boolean; data: { totalPricePoints: number } };
    expect(body.success).toBe(true);
    expect(body.data.totalPricePoints).toBe(96);
  });
});
