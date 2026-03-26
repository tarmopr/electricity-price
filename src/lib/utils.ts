import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Class name utility for shadcn/ui component variants.
 * Application components use raw Tailwind string concatenation instead —
 * see src/lib/styles.ts for shared style constants.
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
