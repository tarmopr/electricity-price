/**
 * Share / export utilities.
 *
 * Encodes dashboard state into URL search params and decodes them back.
 * This enables sharing specific views via URL.
 */

import { Timeframe, ViewMode } from "@/components/Dashboard";

export interface ShareableState {
  timeframe: Timeframe;
  includeVat: boolean;
  viewMode: ViewMode;
  customStart?: string;
  customEnd?: string;
  showCheapestPeriod?: boolean;
  cheapestPeriodHours?: number;
}

const PARAM_MAP = {
  timeframe: "tf",
  includeVat: "vat",
  viewMode: "vm",
  customStart: "cs",
  customEnd: "ce",
  showCheapestPeriod: "cp",
  cheapestPeriodHours: "cph",
} as const;

/**
 * Encode dashboard state into URL search params string.
 */
export function encodeStateToParams(state: ShareableState): string {
  const params = new URLSearchParams();

  params.set(PARAM_MAP.timeframe, state.timeframe);
  params.set(PARAM_MAP.includeVat, state.includeVat ? "1" : "0");
  params.set(PARAM_MAP.viewMode, state.viewMode);

  if (state.timeframe === "custom" && state.customStart) {
    params.set(PARAM_MAP.customStart, state.customStart);
  }
  if (state.timeframe === "custom" && state.customEnd) {
    params.set(PARAM_MAP.customEnd, state.customEnd);
  }
  if (state.showCheapestPeriod) {
    params.set(PARAM_MAP.showCheapestPeriod, "1");
    if (state.cheapestPeriodHours) {
      params.set(
        PARAM_MAP.cheapestPeriodHours,
        state.cheapestPeriodHours.toString()
      );
    }
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
  const tf = searchParams.get(PARAM_MAP.timeframe);
  if (!tf) return null; // No share params present

  const state: Partial<ShareableState> = {};

  const validTimeframes: Timeframe[] = [
    "yesterday",
    "today",
    "tomorrow",
    "next_week",
    "week",
    "month",
    "quarter",
    "custom",
  ];
  if (validTimeframes.includes(tf as Timeframe)) {
    state.timeframe = tf as Timeframe;
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

  const cp = searchParams.get(PARAM_MAP.showCheapestPeriod);
  if (cp === "1") {
    state.showCheapestPeriod = true;
    const cph = searchParams.get(PARAM_MAP.cheapestPeriodHours);
    if (cph) {
      const hours = parseInt(cph, 10);
      if (!isNaN(hours) && hours >= 1 && hours <= 8) {
        state.cheapestPeriodHours = hours;
      }
    }
  }

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
