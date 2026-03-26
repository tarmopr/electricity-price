import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ELERING_API,
  errorResponse,
  successResponse,
  fetchFromElering,
} from "@/lib/elering";

describe("ELERING_API constant", () => {
  it("points to the correct Elering endpoint", () => {
    expect(ELERING_API).toBe("https://dashboard.elering.ee/api/nps/price");
  });
});

describe("errorResponse", () => {
  it("returns JSON response with error message and status", async () => {
    const response = errorResponse("Not found", 404);
    expect(response.status).toBe(404);
    const body = await response.json() as { error: string; details?: string };
    expect(body.error).toBe("Not found");
    expect(body.details).toBeUndefined();
  });

  it("includes details when provided", async () => {
    const response = errorResponse("Bad request", 400, "Missing field: name");
    const body = await response.json() as { error: string; details?: string };
    expect(body.error).toBe("Bad request");
    expect(body.details).toBe("Missing field: name");
  });

  it("returns correct status codes", async () => {
    expect(errorResponse("err", 400).status).toBe(400);
    expect(errorResponse("err", 500).status).toBe(500);
    expect(errorResponse("err", 502).status).toBe(502);
  });
});

describe("successResponse", () => {
  it("returns JSON response with success flag and data", async () => {
    const data = { prices: [1, 2, 3] };
    const response = successResponse(data);
    expect(response.status).toBe(200);
    const body = await response.json() as { success: boolean; data: unknown };
    expect(body.success).toBe(true);
    expect(body.data).toEqual(data);
  });

  it("handles array data", async () => {
    const response = successResponse([1, 2, 3]);
    const body = await response.json() as { data: unknown };
    expect(body.data).toEqual([1, 2, 3]);
  });

  it("handles null data", async () => {
    const response = successResponse(null);
    const body = await response.json() as { data: unknown };
    expect(body.data).toBeNull();
  });
});

describe("fetchFromElering", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches and returns price data", async () => {
    const mockResponse = {
      success: true,
      data: {
        ee: [
          { timestamp: 1704067200, price: 50.0 },
          { timestamp: 1704070800, price: 60.0 },
        ],
      },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })
    );

    const result = await fetchFromElering(
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-01-01T02:00:00Z")
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ timestamp: 1704067200, priceEurMwh: 50.0 });
    expect(result[1]).toEqual({ timestamp: 1704070800, priceEurMwh: 60.0 });
  });

  it("deduplicates by timestamp", async () => {
    const mockResponse = {
      success: true,
      data: {
        ee: [
          { timestamp: 1704067200, price: 50.0 },
          { timestamp: 1704067200, price: 50.0 }, // duplicate
        ],
      },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })
    );

    const result = await fetchFromElering(
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-01-01T02:00:00Z")
    );
    expect(result).toHaveLength(1);
  });

  it("throws on API error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      })
    );

    await expect(
      fetchFromElering(new Date("2024-01-01"), new Date("2024-01-02"))
    ).rejects.toThrow("Elering API error");
  });

  it("throws on invalid response format", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: false }),
      })
    );

    await expect(
      fetchFromElering(new Date("2024-01-01"), new Date("2024-01-02"))
    ).rejects.toThrow("Invalid Elering API response format");
  });

  it("makes a single fetch call for a range within CHUNK_SIZE_MS", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: { ee: [{ timestamp: 1704067200, price: 50.0 }] },
        }),
    });

    vi.stubGlobal("fetch", mockFetch);

    // 30-day range is well within the ~90-day chunk size
    await fetchFromElering(
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-01-31T00:00:00Z")
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("makes exactly two fetch calls for a range spanning two chunks", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: { ee: [] },
        }),
    });

    vi.stubGlobal("fetch", mockFetch);

    // ~100-day range exceeds the 90-day CHUNK_SIZE_MS, requiring exactly two chunks
    await fetchFromElering(
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-04-10T00:00:00Z")
    );

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("deduplicates prices that appear in both chunks at a boundary", async () => {
    // Simulate two chunks that each return the same timestamp at the boundary
    const sharedTimestamp = 1704067200;
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              ee: [{ timestamp: sharedTimestamp, price: callCount === 1 ? 50.0 : 60.0 }],
            },
          }),
      });
    });

    vi.stubGlobal("fetch", mockFetch);

    // ~100-day range to get two chunks
    const result = await fetchFromElering(
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-04-10T00:00:00Z")
    );

    expect(mockFetch).toHaveBeenCalledTimes(2);
    // The shared timestamp should appear only once (first-seen wins)
    const matching = result.filter((p) => p.timestamp === sharedTimestamp);
    expect(matching).toHaveLength(1);
    expect(matching[0].priceEurMwh).toBe(50.0);
  });

  it("chunks requests for large date ranges", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: { ee: [{ timestamp: 1704067200, price: 50.0 }] },
        }),
    });

    vi.stubGlobal("fetch", mockFetch);

    // 200-day range should require 3 chunks (~90 days each)
    await fetchFromElering(
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-07-19T00:00:00Z")
    );

    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("builds correct URL with encoded dates", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: { ee: [] },
        }),
    });

    vi.stubGlobal("fetch", mockFetch);

    await fetchFromElering(
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-01-02T00:00:00Z")
    );

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain(ELERING_API);
    expect(calledUrl).toContain("start=");
    expect(calledUrl).toContain("end=");
  });
});
