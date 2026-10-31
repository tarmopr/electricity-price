import { describe, it, expect } from "vitest";
import {
  clampNumber,
  evaluateDraft,
  formatDuration,
  formatNumber,
  parseNumericInput,
  roundPrecision,
} from "@/lib/numericInput";

describe("numericInput", () => {
  describe("parseNumericInput", () => {
    it("parses integers and decimals", () => {
      expect(parseNumericInput("8")).toBe(8);
      expect(parseNumericInput("12.5")).toBe(12.5);
      expect(parseNumericInput(".5")).toBe(0.5);
    });

    it("accepts comma as decimal separator", () => {
      expect(parseNumericInput("12,5")).toBe(12.5);
    });

    it("accepts a trailing separator", () => {
      expect(parseNumericInput("12,")).toBe(12);
      expect(parseNumericInput("12.")).toBe(12);
    });

    it("trims whitespace", () => {
      expect(parseNumericInput("  3,25 ")).toBe(3.25);
    });

    it("returns null for empty or unparseable drafts", () => {
      expect(parseNumericInput("")).toBeNull();
      expect(parseNumericInput("   ")).toBeNull();
      expect(parseNumericInput("abc")).toBeNull();
      expect(parseNumericInput("-")).toBeNull();
      expect(parseNumericInput(",")).toBeNull();
      expect(parseNumericInput("1,2,3")).toBeNull();
      expect(parseNumericInput("12a")).toBeNull();
    });

    it("parses negative numbers (bounds handled by evaluateDraft)", () => {
      expect(parseNumericInput("-2")).toBe(-2);
    });
  });

  describe("clampNumber", () => {
    it("clamps to bounds", () => {
      expect(clampNumber(30, 0.25, 24)).toBe(24);
      expect(clampNumber(0, 0.25, 24)).toBe(0.25);
      expect(clampNumber(5, 0.25, 24)).toBe(5);
    });
  });

  describe("roundPrecision", () => {
    it("removes float noise", () => {
      expect(roundPrecision(0.1 + 0.2)).toBe(0.3);
    });
  });

  describe("formatNumber / formatDuration", () => {
    it("formats compactly", () => {
      expect(formatNumber(8)).toBe("8");
      expect(formatNumber(2.5)).toBe("2.5");
      expect(formatNumber(1.25)).toBe("1.25");
    });

    it("formats durations with unit", () => {
      expect(formatDuration(8)).toBe("8 h");
      expect(formatDuration(2.5)).toBe("2.5 h");
    });
  });

  describe("evaluateDraft", () => {
    it("returns the value when in range", () => {
      expect(evaluateDraft("12,5", 0, 200)).toEqual({ value: 12.5, outOfRange: null });
    });

    it("clamps and flags values above max", () => {
      expect(evaluateDraft("30", 0.25, 24)).toEqual({ value: 24, outOfRange: "max" });
    });

    it("clamps and flags values below min", () => {
      expect(evaluateDraft("0", 0.25, 24)).toEqual({ value: 0.25, outOfRange: "min" });
    });

    it("returns null value for empty drafts", () => {
      expect(evaluateDraft("", 0, 200)).toEqual({ value: null, outOfRange: null });
    });

    it("supports an unbounded max", () => {
      expect(evaluateDraft("9999", 0, Infinity)).toEqual({ value: 9999, outOfRange: null });
    });
  });
});
