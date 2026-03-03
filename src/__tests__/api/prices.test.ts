import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock getCloudflareContext before importing routes
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(),
}));

describe("GET /api/prices", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 400 when start parameter is missing", async () => {
    const { GET } = await import("@/app/api/prices/route");
    const request = new Request("http://localhost/api/prices?end=2024-01-02");
    const response = await GET(request as never);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Missing required query parameters");
  });

  it("returns 400 when end parameter is missing", async () => {
    const { GET } = await import("@/app/api/prices/route");
    const request = new Request("http://localhost/api/prices?start=2024-01-01");
    const response = await GET(request as never);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Missing required query parameters");
  });

  it("proxies to Elering API when both params provided", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { ee: [{ timestamp: 1704067200, price: 50 }] },
          }),
      })
    );

    const { GET } = await import("@/app/api/prices/route");
    const request = new Request(
      "http://localhost/api/prices?start=2024-01-01T00:00:00Z&end=2024-01-02T00:00:00Z"
    );
    const response = await GET(request as never);
    expect(response.status).toBe(200);
  });
});

describe("GET /api/prices/current", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("falls back to Elering API when D1 is unavailable", async () => {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    vi.mocked(getCloudflareContext).mockRejectedValue(
      new Error("D1 unavailable")
    );

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: [{ timestamp: 1704067200, price: 42.5 }],
          }),
      })
    );

    const { GET } = await import("@/app/api/prices/current/route");
    const response = await GET();
    expect(response.status).toBe(200);
  });
});

describe("GET /api/prices/daily", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("returns 400 when parameters are missing", async () => {
    const { GET } = await import("@/app/api/prices/daily/route");
    const request = new Request("http://localhost/api/prices/daily");
    const response = await GET(request as never);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Missing required query parameters");
  });
});

describe("GET /api/prices/hourly", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("returns 400 when parameters are missing", async () => {
    const { GET } = await import("@/app/api/prices/hourly/route");
    const request = new Request("http://localhost/api/prices/hourly");
    const response = await GET(request as never);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Missing required query parameters");
  });
});

describe("GET /api/prices/weekly", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("returns 400 when year is missing", async () => {
    const { GET } = await import("@/app/api/prices/weekly/route");
    const request = new Request("http://localhost/api/prices/weekly");
    const response = await GET(request as never);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Missing required query parameter: year");
  });
});

describe("GET /api/prices/monthly", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("returns 400 when year is missing", async () => {
    const { GET } = await import("@/app/api/prices/monthly/route");
    const request = new Request("http://localhost/api/prices/monthly");
    const response = await GET(request as never);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Missing required query parameter: year");
  });
});

describe("GET /api/prices/weekday-pattern", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("returns 400 when year is missing", async () => {
    const { GET } = await import("@/app/api/prices/weekday-pattern/route");
    const request = new Request("http://localhost/api/prices/weekday-pattern");
    const response = await GET(request as never);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Missing required query parameter: year");
  });
});
