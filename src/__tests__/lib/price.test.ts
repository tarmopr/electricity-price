import { describe, it, expect } from "vitest";
import { eurMwhToCentsKwh, applyVat, CHUNK_SIZE_MS } from "@/lib/price";

describe("eurMwhToCentsKwh", () => {
  it("converts 100 EUR/MWh to 10 cents/kWh", () => {
    expect(eurMwhToCentsKwh(100)).toBe(10);
  });

  it("converts 0 EUR/MWh to 0 cents/kWh", () => {
    expect(eurMwhToCentsKwh(0)).toBe(0);
  });

  it("handles negative prices", () => {
    expect(eurMwhToCentsKwh(-50)).toBe(-5);
  });

  it("handles decimal values", () => {
    expect(eurMwhToCentsKwh(123.45)).toBe(12.345);
  });

  it("returns exact 3-decimal result for values that cause floating point errors", () => {
    expect(eurMwhToCentsKwh(12.43)).toBe(1.243);
  });
});

describe("applyVat", () => {
  it("applies default 22% VAT", () => {
    expect(applyVat(100)).toBeCloseTo(122);
  });

  it("applies custom VAT rate", () => {
    expect(applyVat(100, 0.1)).toBeCloseTo(110);
  });

  it("handles zero price", () => {
    expect(applyVat(0)).toBe(0);
  });

  it("handles negative price", () => {
    expect(applyVat(-10)).toBeCloseTo(-12.2);
  });

  it("handles zero VAT rate", () => {
    expect(applyVat(100, 0)).toBe(100);
  });
});

describe("CHUNK_SIZE_MS", () => {
  it("equals approximately 90 days in milliseconds", () => {
    expect(CHUNK_SIZE_MS).toBe(90 * 24 * 60 * 60 * 1000);
  });
});
