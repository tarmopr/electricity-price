/**
 * Numeric text-input helpers.
 *
 * Inputs keep a free-form draft string so users can clear the field or type
 * intermediate values ("12,") without the value being coerced on every keystroke.
 */

/**
 * Parse a user-typed number. Accepts "," as the decimal separator ("12,5" → 12.5)
 * and a trailing separator ("12," → 12). Returns null for empty or unparseable drafts.
 */
export function parseNumericInput(draft: string): number | null {
  const normalized = draft.trim().replace(",", ".");
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Clamp `value` to [min, max]. */
export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Round away binary float noise (e.g. 0.1 + 0.2) to 3 decimals. */
export function roundPrecision(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Format a number compactly: 8 → "8", 2.5 → "2.5", 1.25 → "1.25". */
export function formatNumber(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** Format a duration in hours for display: 8 → "8 h", 2.5 → "2.5 h". */
export function formatDuration(hours: number): string {
  return `${formatNumber(hours)} h`;
}

export interface DraftEvaluation {
  /** Value to commit (clamped), or null when the draft is empty/unparseable */
  value: number | null;
  /** Which bound the raw draft exceeded, if any */
  outOfRange: "min" | "max" | null;
}

/** Evaluate a draft against bounds: parse, then clamp and report out-of-range. */
export function evaluateDraft(draft: string, min: number, max: number): DraftEvaluation {
  const parsed = parseNumericInput(draft);
  if (parsed === null) return { value: null, outOfRange: null };
  if (parsed > max) return { value: max, outOfRange: "max" };
  if (parsed < min) return { value: min, outOfRange: "min" };
  return { value: parsed, outOfRange: null };
}

/** Snap `value` to the nearest multiple of `step` (precision-safe). */
export function snapToStep(value: number, step: number): number {
  return roundPrecision(Math.round(value / step) * step);
}

/**
 * Duration as actually searched: rounded to 15-minute slots, at least one slot.
 * Mirrors the slot count used by the cheapest-window search.
 */
export function snapDurationHours(hours: number): number {
  return Math.max(0.25, snapToStep(hours, 0.25));
}
