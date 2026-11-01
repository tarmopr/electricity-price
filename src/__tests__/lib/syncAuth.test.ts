import { describe, it, expect, afterEach, vi } from "vitest";
import { isSyncAuthorized } from "@/lib/syncAuth";

const req = (auth?: string) =>
  new Request("http://localhost/api/sync", { headers: auth ? { Authorization: auth } : {} });

describe("isSyncAuthorized", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("allows any request when SYNC_SECRET is not set (local dev)", () => {
    vi.stubEnv("SYNC_SECRET", "");
    expect(isSyncAuthorized(req())).toBe(true);
  });

  it("requires the exact bearer token when SYNC_SECRET is set", () => {
    vi.stubEnv("SYNC_SECRET", "s3cret");
    expect(isSyncAuthorized(req("Bearer s3cret"))).toBe(true);
    expect(isSyncAuthorized(req("Bearer wrong"))).toBe(false);
    expect(isSyncAuthorized(req("s3cret"))).toBe(false);
    expect(isSyncAuthorized(req())).toBe(false);
  });
});
