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

  it("returns 400 when date range exceeds 2 years", async () => {
    const { POST } = await import("@/app/api/sync/route");
    const request = new Request(
      "http://localhost/api/sync?start=2022-01-01T00:00:00Z&end=2025-01-01T00:00:00Z"
    );
    const response = await POST(request as never);
    expect(response.status).toBe(400);
    const body = await response.json() as { error: string };
    expect(body.error).toBe("Date range exceeds maximum of 2 years");
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

  it("accepts a valid date range under 2 years", async () => {
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
      "http://localhost/api/sync?start=2025-01-01T00:00:00Z&end=2025-06-01T00:00:00Z"
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
