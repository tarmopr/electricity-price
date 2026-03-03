import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  evaluateAlert,
  requestNotificationPermission,
  showAlertNotification,
  DEFAULT_ALERT_CONFIG,
  AlertConfig,
  AlertState,
} from "@/lib/priceAlerts";

describe("priceAlerts", () => {
  describe("DEFAULT_ALERT_CONFIG", () => {
    it("has alerts disabled by default", () => {
      expect(DEFAULT_ALERT_CONFIG.enabled).toBe(false);
    });

    it("defaults to below direction with 5 ¢/kWh threshold", () => {
      expect(DEFAULT_ALERT_CONFIG.direction).toBe("below");
      expect(DEFAULT_ALERT_CONFIG.threshold).toBe(5);
    });
  });

  describe("evaluateAlert", () => {
    it("returns null when alerts are disabled", () => {
      const config: AlertConfig = { enabled: false, threshold: 5, direction: "below" };
      expect(evaluateAlert(config, 3)).toBeNull();
    });

    it("triggers 'cheap' alert when price is below threshold", () => {
      const config: AlertConfig = { enabled: true, threshold: 5, direction: "below" };
      const result = evaluateAlert(config, 3);
      expect(result).not.toBeNull();
      expect(result!.triggered).toBe(true);
      expect(result!.type).toBe("cheap");
      expect(result!.message).toContain("3.00");
      expect(result!.message).toContain("below");
    });

    it("triggers 'cheap' alert when price equals threshold (below direction)", () => {
      const config: AlertConfig = { enabled: true, threshold: 5, direction: "below" };
      const result = evaluateAlert(config, 5);
      expect(result).not.toBeNull();
      expect(result!.triggered).toBe(true);
      expect(result!.type).toBe("cheap");
    });

    it("returns null when price is above threshold in 'below' direction", () => {
      const config: AlertConfig = { enabled: true, threshold: 5, direction: "below" };
      expect(evaluateAlert(config, 7)).toBeNull();
    });

    it("triggers 'expensive' alert when price is above threshold", () => {
      const config: AlertConfig = { enabled: true, threshold: 10, direction: "above" };
      const result = evaluateAlert(config, 15);
      expect(result).not.toBeNull();
      expect(result!.triggered).toBe(true);
      expect(result!.type).toBe("expensive");
      expect(result!.message).toContain("15.00");
      expect(result!.message).toContain("above");
    });

    it("triggers 'expensive' alert when price equals threshold (above direction)", () => {
      const config: AlertConfig = { enabled: true, threshold: 10, direction: "above" };
      const result = evaluateAlert(config, 10);
      expect(result).not.toBeNull();
      expect(result!.triggered).toBe(true);
      expect(result!.type).toBe("expensive");
    });

    it("returns null when price is below threshold in 'above' direction", () => {
      const config: AlertConfig = { enabled: true, threshold: 10, direction: "above" };
      expect(evaluateAlert(config, 5)).toBeNull();
    });

    it("formats threshold with two decimal places in message", () => {
      const config: AlertConfig = { enabled: true, threshold: 5, direction: "below" };
      const result = evaluateAlert(config, 3.5);
      expect(result!.message).toContain("5.00");
      expect(result!.message).toContain("3.50");
    });
  });

  describe("requestNotificationPermission", () => {
    beforeEach(() => {
      // Reset Notification mock
      vi.stubGlobal("Notification", {
        permission: "default",
        requestPermission: vi.fn(),
      });
    });

    it("returns false when window is undefined", async () => {
      const origWindow = globalThis.window;
      // @ts-expect-error - testing SSR
      delete globalThis.window;
      const result = await requestNotificationPermission();
      expect(result).toBe(false);
      globalThis.window = origWindow;
    });

    it("returns true when permission is already granted", async () => {
      vi.stubGlobal("Notification", {
        permission: "granted",
        requestPermission: vi.fn(),
      });
      const result = await requestNotificationPermission();
      expect(result).toBe(true);
    });

    it("returns false when permission is denied", async () => {
      vi.stubGlobal("Notification", {
        permission: "denied",
        requestPermission: vi.fn(),
      });
      const result = await requestNotificationPermission();
      expect(result).toBe(false);
    });

    it("requests permission and returns true if granted", async () => {
      const requestPermission = vi.fn().mockResolvedValue("granted");
      vi.stubGlobal("Notification", {
        permission: "default",
        requestPermission,
      });
      const result = await requestNotificationPermission();
      expect(requestPermission).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("requests permission and returns false if denied", async () => {
      const requestPermission = vi.fn().mockResolvedValue("denied");
      vi.stubGlobal("Notification", {
        permission: "default",
        requestPermission,
      });
      const result = await requestNotificationPermission();
      expect(result).toBe(false);
    });
  });

  describe("showAlertNotification", () => {
    it("does nothing when Notification is not supported", () => {
      const origNotification = globalThis.Notification;
      // @ts-expect-error - removing Notification
      delete globalThis.Notification;
      const alert: AlertState = { triggered: true, message: "test", type: "cheap" };
      // Should not throw
      expect(() => showAlertNotification(alert)).not.toThrow();
      globalThis.Notification = origNotification;
    });

    it("does nothing when permission is not granted", () => {
      vi.stubGlobal("Notification", vi.fn());
      (Notification as unknown as { permission: string }).permission = "denied";
      const alert: AlertState = { triggered: true, message: "test", type: "cheap" };
      showAlertNotification(alert);
      expect(Notification).not.toHaveBeenCalled();
    });

    it("creates a notification with correct body and tag for cheap alert", () => {
      const NotificationMock = vi.fn();
      NotificationMock.permission = "granted";
      vi.stubGlobal("Notification", NotificationMock);

      const alert: AlertState = { triggered: true, message: "Price is low", type: "cheap" };
      showAlertNotification(alert);

      expect(NotificationMock).toHaveBeenCalledWith(
        expect.stringContaining("Electricity Price Alert"),
        expect.objectContaining({
          body: "Price is low",
          tag: "price-alert",
        })
      );
    });

    it("creates a notification with correct title for expensive alert", () => {
      const NotificationMock = vi.fn();
      NotificationMock.permission = "granted";
      vi.stubGlobal("Notification", NotificationMock);

      const alert: AlertState = { triggered: true, message: "Price is high", type: "expensive" };
      showAlertNotification(alert);

      expect(NotificationMock).toHaveBeenCalledWith(
        expect.stringContaining("Electricity Price Alert"),
        expect.objectContaining({
          body: "Price is high",
        })
      );
    });
  });
});
