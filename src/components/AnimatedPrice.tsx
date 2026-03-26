'use client';

import React, { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { animate, useMotionValue, useTransform } from 'framer-motion';

const MotionSpan = dynamic(
  () => import('framer-motion').then((mod) => mod.motion.span),
  { ssr: false, loading: () => <span>{/* placeholder */}</span> }
);

interface AnimatedPriceProps {
    value: number;
    decimals?: number;
    className?: string;
}

function AnimatedPrice({ value, decimals = 2, className }: AnimatedPriceProps) {
    const motionValue = useMotionValue(0);
    const displayed = useTransform(motionValue, (v) => v.toFixed(decimals));

    useEffect(() => {
        const controls = animate(motionValue, value, {
            duration: 0.6,
            ease: 'easeOut',
        });
        return () => controls.stop();
    }, [value, motionValue]);

    return <MotionSpan className={className}>{displayed}</MotionSpan>;
}

export default React.memo(AnimatedPrice);
