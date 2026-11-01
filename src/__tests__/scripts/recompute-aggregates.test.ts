// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { monthsBetween, parseArgs, recomputeMonths, tallinnMonth } from "../../../scripts/recompute-aggregates.mjs";

describe("tallinnMonth", () => {
  it("uses the Tallinn calendar month, not the UTC one", () => {
    expect(tallinnMonth("2025-10-31T21:30:00Z")).toBe("2025-10"); // 23:30 EET
    expect(tallinnMonth("2025-10-31T22:00:00Z")).toBe("2025-11"); // 00:00 EET
    expect(tallinnMonth("2025-12-31T22:15:00Z")).toBe("2026-01");
    expect(tallinnMonth("2025-04-30T20:59:00Z")).toBe("2025-04"); // 23:59 EEST
    expect(tallinnMonth("2025-04-30T21:00:00Z")).toBe("2025-05"); // 00:00 EEST
  });
});

describe("monthsBetween", () => {
  it("lists every month from first to last inclusive, across years", () => {
    expect(monthsBetween("2025-11", "2026-02")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(monthsBetween("2025-10", "2025-10")).toEqual(["2025-10"]);
    expect(monthsBetween("2025-10", "2025-09")).toEqual([]);
  });
});

describe("parseArgs", () => {
  it("reads --url, --from and --to and strips a trailing slash", () => {
    expect(parseArgs(["--url", "https://x.dev/", "--from", "2025-01", "--to=2025-03"])).toEqual({
      url: "https://x.dev",
      from: "2025-01",
      to: "2025-03",
    });
  });

  it("rejects a missing url and malformed months", () => {
    expect(() => parseArgs([])).toThrow(/--url/);
    expect(() => parseArgs(["--url", "https://x.dev", "--from", "2025-1"])).toThrow(/YYYY-MM/);
  });

  it("rejects unknown flags and flags without a value", () => {
    expect(() => parseArgs(["--url", "https://x.dev", "--form", "2025-01"])).toThrow(/Unknown option --form/);
    expect(() => parseArgs(["--url", "https://x.dev", "--from"])).toThrow(/--from needs a value/);
  });

  it("refuses plain http except for localhost (the secret would travel in cleartext)", () => {
    expect(() => parseArgs(["--url", "http://x.dev"])).toThrow(/https/);
    expect(parseArgs(["--url", "http://localhost:3000"]).url).toBe("http://localhost:3000");
  });
});

describe("recomputeMonths", () => {
  const json = (status: number, body: unknown) =>
    ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

  it("derives the range from GET /api/sync and posts one month at a time with the secret", async () => {
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      if (!init?.method) {
        return json(200, { success: true, data: { earliestTimestamp: "2025-10-31T22:00:00.000Z", latestTimestamp: "2026-01-02T21:45:00.000Z" } });
      }
      return json(200, { success: true, data: { month: new URL(url).searchParams.get("month"), rows: { monthly: 1 } } });
    });
    const log = vi.fn();
    const result = await recomputeMonths({ url: "https://x.dev", secret: "s3cret", fetchFn, log });

    expect(result).toEqual({ done: ["2025-11", "2025-12", "2026-01"], skipped: [] });
    const posts = fetchFn.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(posts.map(([url]) => url)).toEqual([
      "https://x.dev/api/sync/recompute?month=2025-11",
      "https://x.dev/api/sync/recompute?month=2025-12",
      "https://x.dev/api/sync/recompute?month=2026-01",
    ]);
    expect(posts[0][1]?.headers).toEqual({ Authorization: "Bearer s3cret" });
  });

  it("skips months without data (404) and stops at the first other failure", async () => {
    const statuses: Record<string, number> = { "2025-01": 200, "2025-02": 404, "2025-03": 500, "2025-04": 200 };
    const fetchFn = vi.fn(async (url: string) => {
      const month = new URL(url).searchParams.get("month")!;
      return json(statuses[month], statuses[month] === 500 ? { success: false, error: "D1 down" } : { success: true, data: { rows: {} } });
    });
    await expect(
      recomputeMonths({ url: "https://x.dev", secret: "", from: "2025-01", to: "2025-04", fetchFn, log: vi.fn() })
    ).rejects.toThrow(/2025-03.*500.*D1 down.*--from 2025-03/);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("stops at once on 401/403 with an auth hint instead of a resume hint", async () => {
    const fetchFn = vi.fn(async () => json(401, { success: false, error: "Unauthorized" }));
    await expect(
      recomputeMonths({ url: "https://x.dev", secret: "", from: "2025-01", to: "2025-04", fetchFn, log: vi.fn() })
    ).rejects.toThrow(/SYNC_SECRET/);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("reports a non-JSON 200 (e.g. a login page) with the month and resume hint", async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("Unexpected token <"); } }) as unknown as Response);
    await expect(
      recomputeMonths({ url: "https://x.dev", secret: "s", from: "2025-01", to: "2025-01", fetchFn, log: vi.fn() })
    ).rejects.toThrow(/2025-01.*invalid response.*--from 2025-01/);
  });
});
