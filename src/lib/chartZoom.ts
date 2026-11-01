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

/**
 * scrollLeft that keeps the time at the viewport centre in place when the chart
 * width changes from oldZoom × clientWidth to newZoom × clientWidth.
 * Clamped to [0, clientWidth × (newZoom − 1)].
 */
export function anchoredScrollLeft(scrollLeft: number, clientWidth: number, oldZoom: number, newZoom: number): number {
    if (clientWidth <= 0) return 0;
    const ratio = (scrollLeft + clientWidth / 2) / (clientWidth * oldZoom);
    const target = ratio * clientWidth * newZoom - clientWidth / 2;
    const max = clientWidth * (newZoom - 1);
    return Math.min(Math.max(target, 0), max);
}
