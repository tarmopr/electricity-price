/**
 * Chart label layout helpers (pure, unit-testable).
 *
 * Recharts can't measure SVG text before render, so label widths are estimated
 * from character count. The cheapest-window label is 12px bold; ~0.6 × font size
 * per character (≈ 7.2px/char at 12px) covers its digits and separators.
 */

/** Width per character as a fraction of font size (bold text). */
const CHAR_WIDTH_FACTOR = 0.6;
/** Minimum clearance (px) around the label: band edges and the Now pill. */
const LABEL_PADDING = 8;
/** Offset from the band top, matching Recharts' position="insideTop". */
const TOP_OFFSET = 5;

/** Rough rendered width of `text` in px at `fontSize` (bold). */
export function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * CHAR_WIDTH_FACTOR;
}

/** Horizontal pixel span [left, right]. */
export interface Span {
  left: number;
  right: number;
}

/** Horizontal extent of the "Now" reference-line pill drawn by ChartReferenceLabel. */
export function nowPillSpan(lineX: number, text: string): Span {
  // ChartReferenceLabel: text at lineX + 8, rect from text x - 6, width len × 6.5 + 10
  const left = lineX + 2;
  return { left, right: left + text.length * 6.5 + 10 };
}

export interface WindowLabelFitInput {
  /** Band (ReferenceArea) left edge, px */
  bandX: number;
  /** Band width, px */
  bandWidth: number;
  text: string;
  fontSize: number;
  /** "Now" pill span, if the Now line is shown (the labels share the top strip) */
  nowPill?: Span | null;
}

/**
 * Decide whether the cheapest-window label (centered at the top of the band)
 * can be drawn: it must fit inside the band and not collide with the "Now" pill.
 * Band edges are data points, so a label that fits the band is always inside the
 * plot. Otherwise it's hidden — the band itself and the Best Window card already
 * carry the information.
 */
export function shouldShowWindowLabel({
  bandX,
  bandWidth,
  text,
  fontSize,
  nowPill = null,
}: WindowLabelFitInput): boolean {
  const width = estimateTextWidth(text, fontSize);
  if (width + 2 * LABEL_PADDING > bandWidth) return false;

  const center = bandX + bandWidth / 2;
  const left = center - width / 2;
  const right = center + width / 2;
  if (nowPill && left < nowPill.right + LABEL_PADDING && right > nowPill.left - LABEL_PADDING) return false;
  return true;
}

export interface WindowLabelLayoutInput {
  /** ReferenceArea pixel rect, as injected by Recharts into a custom label */
  viewBox?: { x?: number; y?: number; width?: number; height?: number };
  /** Category indices of the band edges */
  x1Index: number;
  x2Index: number;
  /** Category index and text of the "Now" pill, if shown */
  nowIndex: number | null;
  nowText: string | null;
  text: string;
  fontSize?: number;
}

/**
 * Layout for the cheapest-window label: anchor point (top-center of the band) and
 * whether it fits. Returns null when the rect is missing or the band has no width
 * in category terms.
 *
 * Area charts use a point scale, so category positions are linear in index; the
 * px-per-index step derived from the band locates the Now line.
 */
export function computeWindowLabelLayout({
  viewBox,
  x1Index,
  x2Index,
  nowIndex,
  nowText,
  text,
  fontSize = 12,
}: WindowLabelLayoutInput): { show: boolean; x: number; y: number } | null {
  if (!viewBox || viewBox.x == null || viewBox.y == null || viewBox.width == null) return null;
  const indexSpan = x2Index - x1Index;
  if (indexSpan <= 0) return null;

  const step = viewBox.width / indexSpan;
  const nowPill =
    nowIndex !== null && nowText ? nowPillSpan(viewBox.x + (nowIndex - x1Index) * step, nowText) : null;

  return {
    show: shouldShowWindowLabel({ bandX: viewBox.x, bandWidth: viewBox.width, text, fontSize, nowPill }),
    x: viewBox.x + viewBox.width / 2,
    y: viewBox.y + TOP_OFFSET,
  };
}
