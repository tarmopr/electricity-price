/** Chart zoom factors: chart width as a multiple of the visible width. */
export const ZOOM_LEVELS = [1, 2, 4, 8] as const;
export type ZoomLevel = (typeof ZOOM_LEVELS)[number];

/** Next larger level, or the same level at the maximum. */
export function nextZoomLevel(level: ZoomLevel): ZoomLevel {
    const i = ZOOM_LEVELS.indexOf(level);
    return ZOOM_LEVELS[Math.min(i + 1, ZOOM_LEVELS.length - 1)];
}

/** Next smaller level, or the same level at the minimum. */
export function prevZoomLevel(level: ZoomLevel): ZoomLevel {
    const i = ZOOM_LEVELS.indexOf(level);
    return ZOOM_LEVELS[Math.max(i - 1, 0)];
}

/** Fixed space between the chart's edges and its plot area, in px; it does not scale with zoom. */
export interface PlotInsets {
    left: number;
    right: number;
}

/**
 * scrollLeft that keeps the time at the viewport centre in place when the chart
 * width changes from oldZoom × clientWidth to newZoom × clientWidth. Time maps to
 * the plot area, which is the chart width minus the fixed insets.
 * Clamped to [0, clientWidth × (newZoom − 1)].
 */
export function anchoredScrollLeft(
    scrollLeft: number,
    clientWidth: number,
    oldZoom: number,
    newZoom: number,
    insets: PlotInsets = { left: 0, right: 0 }
): number {
    if (clientWidth <= 0) return 0;
    const plotWidth = (zoom: number) => Math.max(clientWidth * zoom - insets.left - insets.right, 1);
    const ratio = (scrollLeft + clientWidth / 2 - insets.left) / plotWidth(oldZoom);
    const target = ratio * plotWidth(newZoom) + insets.left - clientWidth / 2;
    const max = clientWidth * (newZoom - 1);
    return Math.min(Math.max(target, 0), max);
}
