/**
 * Price alert threshold logic.
 *
 * Users can set a price boundary. When the current price crosses the
 * threshold, an alert is shown. The alert state is evaluated purely
 * from the current price and user settings — no persistent alert history.
 */

export type AlertDirection = "below" | "above";

export interface AlertConfig {
  /** Whether alerts are enabled */
  enabled: boolean;
  /** Price threshold in ¢/kWh */
  threshold: number;
  /** Alert when price is "below" or "above" the threshold */
  direction: AlertDirection;
}

export interface AlertState {
  /** Whether the alert condition is currently met */
  triggered: boolean;
  /** Human-readable message */
  message: string;
  /** "cheap" = below threshold, "expensive" = above threshold */
  type: "cheap" | "expensive";
}

export const DEFAULT_ALERT_CONFIG: AlertConfig = {
  enabled: false,
  threshold: 5,
  direction: "below",
};

/**
 * Evaluate whether the current price triggers the alert.
 */
export function evaluateAlert(
  config: AlertConfig,
  currentPriceCentsKwh: number
): AlertState | null {
  if (!config.enabled) return null;

  if (config.direction === "below") {
    if (currentPriceCentsKwh <= config.threshold) {
      return {
        triggered: true,
        message: `Price is ${currentPriceCentsKwh.toFixed(2)} ¢/kWh — below your ${config.threshold.toFixed(2)} ¢ threshold`,
        type: "cheap",
      };
    }
  } else {
    if (currentPriceCentsKwh >= config.threshold) {
      return {
        triggered: true,
        message: `Price is ${currentPriceCentsKwh.toFixed(2)} ¢/kWh — above your ${config.threshold.toFixed(2)} ¢ threshold`,
        type: "expensive",
      };
    }
  }

  return null;
}

/**
 * Request browser notification permission.
 * Returns true if permission is granted.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;

  const permission = await Notification.requestPermission();
  return permission === "granted";
}

/**
 * Show a browser notification for a price alert.
 * Only works if the user has granted notification permission.
 */
export function showAlertNotification(alert: AlertState): void {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ) {
    return;
  }

  const icon = alert.type === "cheap" ? "🟢" : "🔴";
  new Notification(`${icon} Electricity Price Alert`, {
    body: alert.message,
    tag: "price-alert", // prevents duplicate notifications
  });
}
