import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePersistedState } from "@/lib/usePersistedState";

describe("usePersistedState", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("returns default value when localStorage is empty", () => {
    const { result } = renderHook(() => usePersistedState("test_key", true));
    expect(result.current[0]).toBe(true);
  });

  it("reads stored value from localStorage", async () => {
    localStorage.setItem("eprice_test_key", JSON.stringify(false));
    const { result } = renderHook(() => usePersistedState("test_key", true));

    // Wait for hydration effect
    await vi.waitFor(() => {
      expect(result.current[0]).toBe(false);
    });
  });

  it("persists value to localStorage when updated", async () => {
    const { result } = renderHook(() =>
      usePersistedState("test_key", "initial")
    );

    act(() => {
      result.current[1]("updated");
    });

    await vi.waitFor(() => {
      expect(localStorage.getItem("eprice_test_key")).toBe('"updated"');
    });
  });

  it("handles number values", async () => {
    const { result } = renderHook(() => usePersistedState("num_key", 5));

    act(() => {
      result.current[1](10);
    });

    await vi.waitFor(() => {
      expect(result.current[0]).toBe(10);
      expect(localStorage.getItem("eprice_num_key")).toBe("10");
    });
  });

  it("handles object values", async () => {
    const defaultVal = { a: 1, b: "hello" };
    const { result } = renderHook(() =>
      usePersistedState("obj_key", defaultVal)
    );

    const newVal = { a: 2, b: "world" };
    act(() => {
      result.current[1](newVal);
    });

    await vi.waitFor(() => {
      expect(result.current[0]).toEqual(newVal);
    });
  });

  it("handles functional updates", async () => {
    const { result } = renderHook(() => usePersistedState("counter", 0));

    act(() => {
      result.current[1]((prev) => prev + 1);
    });

    await vi.waitFor(() => {
      expect(result.current[0]).toBe(1);
    });

    act(() => {
      result.current[1]((prev) => prev + 1);
    });

    await vi.waitFor(() => {
      expect(result.current[0]).toBe(2);
    });
  });

  it("falls back to default on invalid JSON in localStorage", () => {
    localStorage.setItem("eprice_bad_key", "not-valid-json{{{");
    const { result } = renderHook(() =>
      usePersistedState("bad_key", "default")
    );
    expect(result.current[0]).toBe("default");
  });

  it("uses correct storage prefix", async () => {
    const { result } = renderHook(() =>
      usePersistedState("my_setting", true)
    );

    act(() => {
      result.current[1](false);
    });

    await vi.waitFor(() => {
      expect(localStorage.getItem("eprice_my_setting")).toBe("false");
    });
    // Should NOT exist without prefix
    expect(localStorage.getItem("my_setting")).toBeNull();
  });

  it("handles localStorage being unavailable", () => {
    const getItemSpy = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("localStorage disabled");
      });

    const { result } = renderHook(() =>
      usePersistedState("unavailable", "fallback")
    );
    expect(result.current[0]).toBe("fallback");

    getItemSpy.mockRestore();
  });
});
