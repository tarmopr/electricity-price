'use client';

import { useState, useEffect } from 'react';
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

    useEffect(() => {
        if (showAvg7d && !avg7dPattern) {
            getHourlyAveragePattern(7).then(setAvg7dPattern).catch(() => {});
        }
        if (showAvg30d && !avg30dPattern) {
            getHourlyAveragePattern(30).then(setAvg30dPattern).catch(() => {});
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
