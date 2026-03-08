'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ElectricityPrice } from '@/lib/api';
import { applyVat } from '@/lib/price';
import { usePersistedState } from '@/lib/usePersistedState';
import {
    AlertConfig,
    AlertState,
    DEFAULT_ALERT_CONFIG,
    evaluateAlert,
    requestNotificationPermission,
    showAlertNotification,
} from '@/lib/priceAlerts';

interface UsePriceAlertsResult {
    alertConfig: AlertConfig;
    setAlertConfig: (config: AlertConfig) => void;
    activeAlert: AlertState | null;
    alertDismissed: boolean;
    dismissAlert: () => void;
}

export function usePriceAlerts(
    currentPrice: ElectricityPrice | null,
    includeVat: boolean,
): UsePriceAlertsResult {
    const [alertConfig, setAlertConfigRaw] = usePersistedState<AlertConfig>('alertConfig', DEFAULT_ALERT_CONFIG);
    const [activeAlert, setActiveAlert] = useState<AlertState | null>(null);
    const [alertDismissed, setAlertDismissed] = useState(false);
    const lastNotifiedPriceRef = useRef<number | null>(null);

    const setAlertConfig = useCallback((config: AlertConfig) => {
        setAlertConfigRaw(config);
        if (config.enabled) {
            requestNotificationPermission();
        }
        setAlertDismissed(false);
    }, [setAlertConfigRaw]);

    const dismissAlert = useCallback(() => {
        setAlertDismissed(true);
    }, []);

    // Evaluate alert whenever current price or config changes
    useEffect(() => {
        if (!currentPrice || !alertConfig.enabled) {
            setActiveAlert(null);
            return;
        }

        const price = includeVat
            ? applyVat(currentPrice.priceCentsKwh)
            : currentPrice.priceCentsKwh;

        const alert = evaluateAlert(alertConfig, price);
        setActiveAlert(alert);

        // Browser notification only once per price change
        if (alert && lastNotifiedPriceRef.current !== currentPrice.priceCentsKwh) {
            showAlertNotification(alert);
            lastNotifiedPriceRef.current = currentPrice.priceCentsKwh;
        }

        if (!alert) {
            setAlertDismissed(false);
            lastNotifiedPriceRef.current = null;
        }
    }, [currentPrice, alertConfig, includeVat]);

    return {
        alertConfig,
        setAlertConfig,
        activeAlert,
        alertDismissed,
        dismissAlert,
    };
}
