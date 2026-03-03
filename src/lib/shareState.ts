/**
 * Share / export utilities.
 *
 * Encodes dashboard state into URL search params and decodes them back.
 * This enables sharing specific views via URL.
 */

import { Period, ViewMode } from "@/components/Dashboard";

export interface ShareableState {
  period: Period;
  includeVat: boolean;
  viewMode: ViewMode;
  customStart?: string;
  customEnd?: string;
}

const PARAM_MAP = {
  period: "tf",
  includeVat: "vat",
  viewMode: "vm",
  customStart: "cs",
  customEnd: "ce",
} as const;

/**
 * Encode dashboard state into URL search params string.
 */
export function encodeStateToParams(state: ShareableState): string {
  const params = new URLSearchParams();

  params.set(PARAM_MAP.period, state.period);
  params.set(PARAM_MAP.includeVat, state.includeVat ? "1" : "0");
  params.set(PARAM_MAP.viewMode, state.viewMode);

  if (state.period === "custom" && state.customStart) {
    params.set(PARAM_MAP.customStart, state.customStart);
  }
  if (state.period === "custom" && state.customEnd) {
    params.set(PARAM_MAP.customEnd, state.customEnd);
  }

  return params.toString();
}

/**
 * Build a full shareable URL from current location and state.
 */
export function buildShareUrl(
  baseUrl: string,
  state: ShareableState
): string {
  const params = encodeStateToParams(state);
  const url = new URL(baseUrl);
  url.search = params;
  return url.toString();
}

/**
 * Decode URL search params back into a partial ShareableState.
 * Returns null if no share params are present.
 */
export function decodeParamsToState(
  searchParams: URLSearchParams
): Partial<ShareableState> | null {
  const tf = searchParams.get(PARAM_MAP.period);
  if (!tf) return null; // No share params present

  const state: Partial<ShareableState> = {};

  const validPeriods: Period[] = [
    "yesterday",
    "today",
    "tomorrow",
    "this_week",
    "next_week",
    "week",
    "month",
    "quarter",
    "custom",
  ];
  if (validPeriods.includes(tf as Period)) {
    state.period = tf as Period;
  }

  const vat = searchParams.get(PARAM_MAP.includeVat);
  if (vat !== null) {
    state.includeVat = vat === "1";
  }

  const vm = searchParams.get(PARAM_MAP.viewMode);
  if (vm === "chart" || vm === "heatmap") {
    state.viewMode = vm;
  }

  const cs = searchParams.get(PARAM_MAP.customStart);
  if (cs) state.customStart = cs;

  const ce = searchParams.get(PARAM_MAP.customEnd);
  if (ce) state.customEnd = ce;

  return state;
}

/**
 * Copy text to clipboard. Returns true if successful.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback for older browsers
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    return true;
  } catch {
    return false;
  }
}
