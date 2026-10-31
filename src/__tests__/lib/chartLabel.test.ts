import { describe, it, expect } from "vitest";
import {
  computeWindowLabelLayout,
  estimateTextWidth,
  nowPillSpan,
  shouldShowWindowLabel,
} from "@/lib/chartLabel";

const TEXT = "Cheapest 2.75 h: 12.62 ¢/kWh"; // 28 chars → ~202px at 12px bold

describe("chartLabel", () => {
  describe("estimateTextWidth", () => {
    it("uses ~0.6 × font size per character (bold)", () => {
      expect(estimateTextWidth("abcd", 12)).toBeCloseTo(28.8);
      expect(estimateTextWidth("abcd", 20)).toBeCloseTo(48);
    });
  });

  describe("nowPillSpan", () => {
    it("matches ChartReferenceLabel geometry", () => {
      // "Now 18.55 ¢" = 11 chars → width 11 × 6.5 + 10 = 81.5, starting at lineX + 2
      expect(nowPillSpan(100, "Now 18.55 ¢")).toEqual({ left: 102, right: 183.5 });
    });
  });

  describe("shouldShowWindowLabel", () => {
    it("shows the label when the band is wide and clear of the Now pill", () => {
      expect(
        shouldShowWindowLabel({ bandX: 500, bandWidth: 330, text: TEXT, fontSize: 12, nowPill: nowPillSpan(200, "Now 18.55 ¢") })
      ).toBe(true);
    });

    it("hides the label when it (plus 8px padding each side) is wider than the band", () => {
      // 390px phone: 2.75 h band ≈ 38px
      expect(shouldShowWindowLabel({ bandX: 30, bandWidth: 38, text: TEXT, fontSize: 12 })).toBe(false);
      // Just too narrow: text ~201.6 + 16 padding > 210
      expect(shouldShowWindowLabel({ bandX: 0, bandWidth: 210, text: TEXT, fontSize: 12 })).toBe(false);
      expect(shouldShowWindowLabel({ bandX: 0, bandWidth: 220, text: TEXT, fontSize: 12 })).toBe(true);
    });

    it("hides the label when it would collide with the Now pill", () => {
      expect(
        shouldShowWindowLabel({ bandX: 450, bandWidth: 320, text: TEXT, fontSize: 12, nowPill: nowPillSpan(600, "Now 18.55 ¢") })
      ).toBe(false);
    });
  });

  describe("computeWindowLabelLayout", () => {
    const base = { text: TEXT, x1Index: 10, x2Index: 20, nowIndex: null, nowText: null };

    it("returns null without a viewBox or with a zero index span", () => {
      expect(computeWindowLabelLayout({ ...base, viewBox: undefined })).toBeNull();
      expect(computeWindowLabelLayout({ ...base, viewBox: { x: 0, y: 0 } })).toBeNull();
      expect(computeWindowLabelLayout({ ...base, x2Index: 10, viewBox: { x: 0, y: 0, width: 300 } })).toBeNull();
    });

    it("anchors at the band's top-center (insideTop offset 5) and shows when it fits", () => {
      const layout = computeWindowLabelLayout({ ...base, viewBox: { x: 400, y: 20, width: 300, height: 200 } });
      expect(layout).toEqual({ show: true, x: 550, y: 25 });
    });

    it("maps the Now index to pixels via the band's px-per-index step", () => {
      // step = 300 / 10 = 30px; Now at index 15 → x = 400 + 5 × 30 = 550 → collides with centered label
      const colliding = computeWindowLabelLayout({
        ...base,
        nowIndex: 15,
        nowText: "Now 18.55 ¢",
        viewBox: { x: 400, y: 20, width: 300, height: 200 },
      });
      expect(colliding!.show).toBe(false);

      // Now at index 0 → x = 400 - 10 × 30 = 100 → far left of the band, no collision
      const clear = computeWindowLabelLayout({
        ...base,
        nowIndex: 0,
        nowText: "Now 18.55 ¢",
        viewBox: { x: 400, y: 20, width: 300, height: 200 },
      });
      expect(clear!.show).toBe(true);
    });

    it("shows without a Now line when the label fits", () => {
      const layout = computeWindowLabelLayout({
        ...base,
        nowIndex: null,
        nowText: "Now 18.55 ¢",
        viewBox: { x: 400, y: 20, width: 300, height: 200 },
      });
      expect(layout!.show).toBe(true);
    });

    it("hides on a narrow phone band", () => {
      const layout = computeWindowLabelLayout({ ...base, viewBox: { x: 30, y: 20, width: 38, height: 200 } });
      expect(layout!.show).toBe(false);
    });
  });
});
