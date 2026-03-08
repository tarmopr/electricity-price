'use client';

import { useState, useEffect, useRef } from 'react';
import { getHourlyAveragePattern, HourlyAveragePattern } from '@/lib/api';
import { usePersistedState } from '@/lib/usePersistedState';

interface UsePatternOverlaysResult {
    showAvg7d: boolean;
    setShowAvg7d: (v: boolean) => void;
    showAvg30d: boolean;
    setShowAvg30d: (v: boolean) => void;
    avg7dPattern: HourlyAveragePattern | null;
    avg30dPattern: HourlyAveragePattern | null;
}

export function usePatternOverlays(): UsePatternOverlaysResult {
    const [showAvg7d, setShowAvg7d] = usePersistedState<boolean>('showAvg7d', false);
    const [showAvg30d, setShowAvg30d] = usePersistedState<boolean>('showAvg30d', false);
    const [avg7dPattern, setAvg7dPattern] = useState<HourlyAveragePattern | null>(null);
    const [avg30dPattern, setAvg30dPattern] = useState<HourlyAveragePattern | null>(null);

    // Track whether a fetch has been attempted to prevent infinite retries on error
    const fetchedRef = useRef({ avg7d: false, avg30d: false });

    useEffect(() => {
        if (showAvg7d && !avg7dPattern && !fetchedRef.current.avg7d) {
            fetchedRef.current.avg7d = true;
            getHourlyAveragePattern(7)
                .then(setAvg7dPattern)
                .catch(() => {});
        }
        if (showAvg30d && !avg30dPattern && !fetchedRef.current.avg30d) {
            fetchedRef.current.avg30d = true;
            getHourlyAveragePattern(30)
                .then(setAvg30dPattern)
                .catch(() => {});
        }
    }, [showAvg7d, showAvg30d, avg7dPattern, avg30dPattern]);

    return {
        showAvg7d,
        setShowAvg7d,
        showAvg30d,
        setShowAvg30d,
        avg7dPattern,
        avg30dPattern,
    };
}
