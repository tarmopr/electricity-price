import { describe, it, expect } from "vitest";
import { anchoredScrollLeft, nextZoomLevel, prevZoomLevel } from "@/lib/chartZoom";

describe("nextZoomLevel", () => {
    it("steps 1 → 2 → 4 → 8 and stops at 8", () => {
        expect(nextZoomLevel(1)).toBe(2);
        expect(nextZoomLevel(2)).toBe(4);
        expect(nextZoomLevel(4)).toBe(8);
        expect(nextZoomLevel(8)).toBe(8);
    });
});

describe("prevZoomLevel", () => {
    it("steps 8 → 4 → 2 → 1 and stops at 1", () => {
        expect(prevZoomLevel(8)).toBe(4);
        expect(prevZoomLevel(4)).toBe(2);
        expect(prevZoomLevel(2)).toBe(1);
        expect(prevZoomLevel(1)).toBe(1);
    });
});

describe("anchoredScrollLeft", () => {
    it("keeps the viewport centre in place when zooming in", () => {
        expect(anchoredScrollLeft(0, 340, 1, 2)).toBe(170);
        expect(anchoredScrollLeft(170, 340, 2, 4)).toBe(510);
        expect(anchoredScrollLeft(1020, 340, 4, 8)).toBe(2210);
    });

    it("keeps the viewport centre in place when zooming out", () => {
        expect(anchoredScrollLeft(510, 340, 4, 2)).toBe(170);
        expect(anchoredScrollLeft(170, 340, 2, 1)).toBe(0);
    });

    it("leaves the scroll position unchanged at the end when the zoom does not change", () => {
        expect(anchoredScrollLeft(2380, 340, 8, 8)).toBe(2380);
    });

    it("clamps a result past the end to clientWidth × (newZoom − 1)", () => {
        expect(anchoredScrollLeft(5000, 340, 2, 4)).toBe(1020);
    });

    it("keeps the time at the viewport centre in place with plot insets", () => {
        // Price chart plot area: 40 px from the left (YAxis 60 px − 20 px margin), 10 px from the right
        const insets = { left: 40, right: 10 };
        const cw = 340;
        // Fraction of the plot width at the viewport centre
        const centreFraction = (scrollLeft: number, zoom: number) =>
            (scrollLeft + cw / 2 - insets.left) / (cw * zoom - insets.left - insets.right);
        expect(anchoredScrollLeft(0, cw, 1, 2, insets)).toBeCloseTo(152.41, 2);
        for (const [s, from, to] of [[0, 1, 2], [300, 2, 4], [1000, 4, 8], [1200, 8, 4], [400, 4, 2]] as const) {
            const next = anchoredScrollLeft(s, cw, from, to, insets);
            expect(centreFraction(next, to)).toBeCloseTo(centreFraction(s, from), 6);
        }
    });

    it("clamps to [0, clientWidth × (newZoom − 1)] with plot insets", () => {
        const insets = { left: 40, right: 10 };
        expect(anchoredScrollLeft(170, 340, 2, 1, insets)).toBe(0);
        expect(anchoredScrollLeft(20, 340, 4, 2, insets)).toBe(0);
        expect(anchoredScrollLeft(5000, 340, 2, 4, insets)).toBe(1020);
    });

    it("returns 0 when the box has no width", () => {
        expect(anchoredScrollLeft(100, 0, 1, 2)).toBe(0);
    });
});
