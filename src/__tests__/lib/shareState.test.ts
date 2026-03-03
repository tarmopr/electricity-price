import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  encodeStateToParams,
  buildShareUrl,
  decodeParamsToState,
  copyToClipboard,
  ShareableState,
} from "@/lib/shareState";

describe("shareState", () => {
  describe("encodeStateToParams", () => {
    it("encodes basic state", () => {
      const state: ShareableState = {
        timeframe: "today",
        includeVat: true,
        viewMode: "chart",
      };
      const params = encodeStateToParams(state);
      expect(params).toContain("tf=today");
      expect(params).toContain("vat=1");
      expect(params).toContain("vm=chart");
    });

    it("encodes VAT off as 0", () => {
      const state: ShareableState = {
        timeframe: "today",
        includeVat: false,
        viewMode: "chart",
      };
      const params = encodeStateToParams(state);
      expect(params).toContain("vat=0");
    });

    it("includes custom dates when timeframe is custom", () => {
      const state: ShareableState = {
        timeframe: "custom",
        includeVat: true,
        viewMode: "chart",
        customStart: "2024-06-01",
        customEnd: "2024-06-07",
      };
      const params = encodeStateToParams(state);
      expect(params).toContain("cs=2024-06-01");
      expect(params).toContain("ce=2024-06-07");
    });

    it("omits custom dates when timeframe is not custom", () => {
      const state: ShareableState = {
        timeframe: "week",
        includeVat: true,
        viewMode: "chart",
        customStart: "2024-06-01",
        customEnd: "2024-06-07",
      };
      const params = encodeStateToParams(state);
      expect(params).not.toContain("cs=");
      expect(params).not.toContain("ce=");
    });

    it("includes cheapest period settings when enabled", () => {
      const state: ShareableState = {
        timeframe: "today",
        includeVat: true,
        viewMode: "chart",
        showCheapestPeriod: true,
        cheapestPeriodHours: 3,
      };
      const params = encodeStateToParams(state);
      expect(params).toContain("cp=1");
      expect(params).toContain("cph=3");
    });

    it("omits cheapest period when not enabled", () => {
      const state: ShareableState = {
        timeframe: "today",
        includeVat: true,
        viewMode: "chart",
        showCheapestPeriod: false,
        cheapestPeriodHours: 3,
      };
      const params = encodeStateToParams(state);
      expect(params).not.toContain("cp=");
      expect(params).not.toContain("cph=");
    });

    it("encodes heatmap view mode", () => {
      const state: ShareableState = {
        timeframe: "week",
        includeVat: false,
        viewMode: "heatmap",
      };
      const params = encodeStateToParams(state);
      expect(params).toContain("vm=heatmap");
    });
  });

  describe("buildShareUrl", () => {
    it("builds a complete URL with params", () => {
      const state: ShareableState = {
        timeframe: "today",
        includeVat: true,
        viewMode: "chart",
      };
      const url = buildShareUrl("https://example.com", state);
      expect(url).toContain("https://example.com");
      expect(url).toContain("tf=today");
      expect(url).toContain("vat=1");
    });

    it("replaces existing search params", () => {
      const state: ShareableState = {
        timeframe: "week",
        includeVat: false,
        viewMode: "heatmap",
      };
      const url = buildShareUrl("https://example.com?old=param", state);
      expect(url).not.toContain("old=param");
      expect(url).toContain("tf=week");
    });
  });

  describe("decodeParamsToState", () => {
    it("returns null when no share params present", () => {
      const params = new URLSearchParams("");
      expect(decodeParamsToState(params)).toBeNull();
    });

    it("returns null when only non-share params present", () => {
      const params = new URLSearchParams("foo=bar");
      expect(decodeParamsToState(params)).toBeNull();
    });

    it("decodes basic state", () => {
      const params = new URLSearchParams("tf=today&vat=1&vm=chart");
      const state = decodeParamsToState(params);
      expect(state).not.toBeNull();
      expect(state!.timeframe).toBe("today");
      expect(state!.includeVat).toBe(true);
      expect(state!.viewMode).toBe("chart");
    });

    it("decodes VAT off correctly", () => {
      const params = new URLSearchParams("tf=today&vat=0");
      const state = decodeParamsToState(params);
      expect(state!.includeVat).toBe(false);
    });

    it("decodes custom dates", () => {
      const params = new URLSearchParams(
        "tf=custom&cs=2024-06-01&ce=2024-06-07"
      );
      const state = decodeParamsToState(params);
      expect(state!.timeframe).toBe("custom");
      expect(state!.customStart).toBe("2024-06-01");
      expect(state!.customEnd).toBe("2024-06-07");
    });

    it("decodes cheapest period settings", () => {
      const params = new URLSearchParams("tf=today&cp=1&cph=4");
      const state = decodeParamsToState(params);
      expect(state!.showCheapestPeriod).toBe(true);
      expect(state!.cheapestPeriodHours).toBe(4);
    });

    it("ignores invalid timeframe values", () => {
      const params = new URLSearchParams("tf=invalid_timeframe");
      const state = decodeParamsToState(params);
      expect(state).not.toBeNull();
      expect(state!.timeframe).toBeUndefined();
    });

    it("ignores invalid view mode values", () => {
      const params = new URLSearchParams("tf=today&vm=invalid");
      const state = decodeParamsToState(params);
      expect(state!.viewMode).toBeUndefined();
    });

    it("clamps cheapest period hours to valid range", () => {
      const params = new URLSearchParams("tf=today&cp=1&cph=99");
      const state = decodeParamsToState(params);
      expect(state!.cheapestPeriodHours).toBeUndefined(); // 99 > 8, rejected
    });

    it("roundtrips encode/decode correctly", () => {
      const original: ShareableState = {
        timeframe: "custom",
        includeVat: false,
        viewMode: "heatmap",
        customStart: "2024-01-15",
        customEnd: "2024-02-20",
        showCheapestPeriod: true,
        cheapestPeriodHours: 5,
      };

      const encoded = encodeStateToParams(original);
      const decoded = decodeParamsToState(new URLSearchParams(encoded));

      expect(decoded!.timeframe).toBe(original.timeframe);
      expect(decoded!.includeVat).toBe(original.includeVat);
      expect(decoded!.viewMode).toBe(original.viewMode);
      expect(decoded!.customStart).toBe(original.customStart);
      expect(decoded!.customEnd).toBe(original.customEnd);
      expect(decoded!.showCheapestPeriod).toBe(true);
      expect(decoded!.cheapestPeriodHours).toBe(5);
    });
  });

  describe("copyToClipboard", () => {
    beforeEach(() => {
      // Mock clipboard API
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined),
        },
      });
    });

    it("copies text using clipboard API", async () => {
      const result = await copyToClipboard("test text");
      expect(result).toBe(true);
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("test text");
    });

    it("returns false when clipboard fails", async () => {
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockRejectedValue(new Error("denied")),
        },
      });
      const result = await copyToClipboard("test");
      expect(result).toBe(false);
    });
  });
});
