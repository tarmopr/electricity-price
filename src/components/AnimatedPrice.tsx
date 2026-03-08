'use client';

import { useEffect } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';

interface AnimatedPriceProps {
    value: number;
    decimals?: number;
    className?: string;
}

export default function AnimatedPrice({ value, decimals = 2, className }: AnimatedPriceProps) {
    const motionValue = useMotionValue(0);
    const displayed = useTransform(motionValue, (v) => v.toFixed(decimals));

    useEffect(() => {
        const controls = animate(motionValue, value, {
            duration: 0.6,
            ease: 'easeOut',
        });
        return () => controls.stop();
    }, [value, motionValue]);

    return <motion.span className={className}>{displayed}</motion.span>;
}
