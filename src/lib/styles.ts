/**
 * Shared Tailwind class string constants for consistent UI styling.
 *
 * Used by Controls, CostCalculator, and other components that render
 * toggle pills or buttons with the same visual pattern.
 */

export const PILL_BASE =
  "px-3 py-1.5 rounded-lg text-sm transition-all border font-medium";

export const PILL_ACTIVE =
  "bg-emerald-400/20 text-emerald-300 border-emerald-400/50";

export const PILL_INACTIVE =
  "bg-zinc-800/50 text-zinc-400 border-zinc-700 hover:bg-zinc-800";

/** Returns PILL_ACTIVE or PILL_INACTIVE based on condition. */
export function pillClass(isActive: boolean): string {
  return isActive ? PILL_ACTIVE : PILL_INACTIVE;
}
